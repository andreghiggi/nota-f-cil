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
    console.log('🔄 Processing NF-e queue...');

    const { data: filaItems, error: filaError } = await supabase
      .from('fila_processamento_nfe')
      .select('*, nfe(id, numero, serie, status, empresa_id)')
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
      console.log('📭 No items in NF-e queue');
      return new Response(
        JSON.stringify({ success: true, processed: 0, message: 'No items to process' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📋 Found ${filaItems.length} NF-e items in queue`);
    let processed = 0;
    let errors = 0;

    for (const item of filaItems) {
      const nfe = item.nfe;
      if (!nfe || nfe.status !== 'pendente') {
        await supabase.from('fila_processamento_nfe').delete().eq('id', item.id);
        continue;
      }

      try {
        console.log(`📡 Processing NF-e ${nfe.numero} via fiscal API...`);

        const { data: result, error: invokeError } = await supabase.functions.invoke('fiscal-api', {
          body: {
            action: 'emit_nfe',
            nfe_id: nfe.id,
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

        console.log(`✅ NF-e ${nfe.numero} processed:`, JSON.stringify(result));

        await supabase.from('fila_processamento_nfe').delete().eq('id', item.id);
        processed++;

      } catch (err: any) {
        console.error(`❌ Error processing NF-e ${nfe.numero}:`, err.message);
        errors++;

        const newTentativas = item.tentativas + 1;

        if (newTentativas >= item.max_tentativas) {
          const transient = /timeout|timed out|resolving timed out|connection reset|recv failure|could not resolve|ssl connect|empty reply|soap/i.test(err.message || '');
          if (transient) {
            const nextProcessing = new Date(Date.now() + 15 * 60 * 1000);
            await supabase
              .from('fila_processamento_nfe')
              .update({ tentativas: newTentativas, max_tentativas: newTentativas + 3, proximo_processamento: nextProcessing.toISOString(), erro_ultimo: err.message })
              .eq('id', item.id);
            await supabase.from('nfe').update({ status: 'pendente', erro_processamento: `Falha temporária SEFAZ/API2: ${err.message}` }).eq('id', nfe.id);
            continue;
          }

          await supabase
            .from('nfe')
            .update({
              status: 'rejeitada',
              erro_processamento: `Máximo de tentativas atingido: ${err.message}`
            })
            .eq('id', nfe.id);

          await supabase.from('fila_processamento_nfe').delete().eq('id', item.id);

          await supabase.rpc('registrar_log', {
            p_empresa_id: nfe.empresa_id,
            p_nfce_id: nfe.id,
            p_token_api_id: nfe.id,
            p_tipo: 'erro',
            p_categoria: 'processamento',
            p_mensagem: `NF-e ${nfe.numero} falhou após ${newTentativas} tentativas`,
            p_detalhes: { erro: err.message },
          });
        } else {
          const backoffMinutes = Math.pow(2, newTentativas);
          const nextProcessing = new Date(Date.now() + backoffMinutes * 60 * 1000);

          await supabase
            .from('fila_processamento_nfe')
            .update({
              tentativas: newTentativas,
              proximo_processamento: nextProcessing.toISOString(),
              erro_ultimo: err.message,
            })
            .eq('id', item.id);
        }
      }
    }

    console.log(`🏁 NF-e queue processing complete: ${processed} processed, ${errors} errors`);

    return new Response(
      JSON.stringify({ success: true, processed, errors, total: filaItems.length }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ NF-e queue processing error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
