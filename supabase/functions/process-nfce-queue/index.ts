import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    console.log('🔄 Processing NFC-e queue...');

    // 🛟 Sweep de órfãs: NFC-e em 'processando' há mais de 5 min sem entrada na fila
    try {
      const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { data: orfas } = await supabase
        .from('nfce')
        .select('id, numero')
        .eq('status', 'processando')
        .lt('updated_at', cutoff)
        .limit(50);
      for (const o of orfas || []) {
        const { data: jaEnfileirada } = await supabase
          .from('fila_processamento')
          .select('id').eq('nfce_id', o.id).maybeSingle();
        if (jaEnfileirada) continue;
        console.log(`🛟 NFC-e ${o.numero} órfã em 'processando' — devolvendo para 'pendente' e reenfileirando`);
        await supabase.from('nfce').update({
          status: 'pendente',
          erro_processamento: 'Timeout/interrupção durante emissão anterior — reprocessando automaticamente',
        }).eq('id', o.id).eq('status', 'processando');
        await supabase.from('fila_processamento').insert({
          nfce_id: o.id,
          prioridade: 5,
          proximo_processamento: new Date().toISOString(),
          tentativas: 0,
          max_tentativas: 3,
        });
      }
    } catch (sweepErr) {
      console.error('⚠️ Sweep órfãs NFC-e falhou:', (sweepErr as Error)?.message);
    }


    // Get pending items from the queue
    const { data: filaItems, error: filaError } = await supabase
      .from('fila_processamento')
      .select('*, nfce(id, numero, serie, status, empresa_id)')
      .lte('proximo_processamento', new Date().toISOString())
      .order('prioridade', { ascending: true })
      .limit(10);

    if (filaError) {
      console.error('Error fetching queue:', filaError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch queue', details: filaError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!filaItems || filaItems.length === 0) {
      console.log('📭 No items in queue');
      return new Response(
        JSON.stringify({ success: true, processed: 0, message: 'No items to process' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📋 Found ${filaItems.length} items in queue`);
    let processed = 0;
    let errors = 0;

    for (const item of filaItems) {
      const nfce = item.nfce;
      if (!nfce || nfce.status !== 'pendente') {
        // Remove from queue if not pending
        await supabase.from('fila_processamento').delete().eq('id', item.id);
        continue;
      }

      try {
        console.log(`📡 Processing NFC-e ${nfce.numero} via fiscal API...`);

        // Call the fiscal-api edge function to emit
        const { data: result, error: invokeError } = await supabase.functions.invoke('fiscal-api', {
          body: {
            action: 'emit_nfce',
            nfce_id: nfce.id,
          }
        });

        if (invokeError) {
          throw new Error(invokeError.message || 'Erro ao invocar API fiscal');
        }

        const status = result?.data?.status || result?.status;
        const errText = JSON.stringify(result || {});
        if (result?.error || status === 'rejeitada' || status === 'processando' || status === 'pendente') {
          throw new Error(result?.error || result?.data?.motivo_retorno || result?.data?.erro_processamento || errText);
        }

        console.log(`✅ NFC-e ${nfce.numero} processed:`, JSON.stringify(result));

        // Remove from queue on success
        await supabase.from('fila_processamento').delete().eq('id', item.id);
        processed++;

      } catch (err: any) {
        console.error(`❌ Error processing NFC-e ${nfce.numero}:`, err.message);
        errors++;

        const newTentativas = item.tentativas + 1;
        
        if (newTentativas >= item.max_tentativas) {
          const transient = /timeout|timed out|resolving timed out|connection reset|recv failure|could not resolve|ssl connect|empty reply|soap/i.test(err.message || '');
          if (transient) {
            const nextProcessing = new Date(Date.now() + 15 * 60 * 1000);
            await supabase
              .from('fila_processamento')
              .update({ tentativas: newTentativas, max_tentativas: newTentativas + 3, proximo_processamento: nextProcessing.toISOString(), erro_ultimo: err.message })
              .eq('id', item.id);
            await supabase.from('nfce').update({ status: 'pendente', erro_processamento: `Falha temporária SEFAZ/API2: ${err.message}` }).eq('id', nfce.id);
            continue;
          }

          // Max retries reached - mark as failed and remove from queue
          await supabase
            .from('nfce')
            .update({ 
              status: 'rejeitada', 
              erro_processamento: `Máximo de tentativas atingido: ${err.message}` 
            })
            .eq('id', nfce.id);

          await supabase.from('fila_processamento').delete().eq('id', item.id);

          await supabase.rpc('registrar_log', {
            p_empresa_id: nfce.empresa_id,
            p_nfce_id: nfce.id,
            p_token_api_id: nfce.id, // placeholder
            p_tipo: 'erro',
            p_categoria: 'processamento',
            p_mensagem: `NFC-e ${nfce.numero} falhou após ${newTentativas} tentativas`,
            p_detalhes: { erro: err.message },
          });
        } else {
          // Schedule retry with exponential backoff
          const backoffMinutes = Math.pow(2, newTentativas);
          const nextProcessing = new Date(Date.now() + backoffMinutes * 60 * 1000);
          
          await supabase
            .from('fila_processamento')
            .update({
              tentativas: newTentativas,
              proximo_processamento: nextProcessing.toISOString(),
              erro_ultimo: err.message,
            })
            .eq('id', item.id);
        }
      }
    }

    console.log(`🏁 Queue processing complete: ${processed} processed, ${errors} errors`);

    return new Response(
      JSON.stringify({ success: true, processed, errors, total: filaItems.length }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Queue processing error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
