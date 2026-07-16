// Worker: retransmissão automática de NFC-e em contingência offline (tpEmis=9).
// Roda periodicamente (cron a cada 2 min). Pega itens pendentes, tenta emitir
// via fiscal-api. Backoff exponencial em caso de falha. Expira em 24h.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-cron',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const started = Date.now();
  const resultado = { processadas: 0, transmitidas: 0, erros: 0, expiradas: 0 };

  try {
    const agora = new Date().toISOString();

    // 1) Expira itens que passaram do prazo legal de 24h
    const { data: expiradas } = await supabase
      .from('nfce_contingencia_queue')
      .update({ status: 'expirada', ultimo_erro: 'Prazo de 24h expirado sem transmissão' })
      .lt('prazo_final', agora)
      .in('status', ['pendente', 'processando'])
      .select('id');
    resultado.expiradas = expiradas?.length || 0;

    // 2) Pega os próximos itens da fila (limite 20 por execução)
    const { data: itens, error: qErr } = await supabase
      .from('nfce_contingencia_queue')
      .select('id, nfce_id, empresa_id, tentativas, emitida_em')
      .eq('status', 'pendente')
      .lte('proxima_tentativa', agora)
      .order('proxima_tentativa', { ascending: true })
      .limit(20);

    if (qErr) throw qErr;
    if (!itens || itens.length === 0) {
      return new Response(JSON.stringify({ ok: true, ...resultado, duracao_ms: Date.now() - started }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    for (const item of itens) {
      resultado.processadas++;

      // Marca como processando para evitar dupla execução
      await supabase
        .from('nfce_contingencia_queue')
        .update({ status: 'processando' })
        .eq('id', item.id);

      try {
        const { data: fiscalResult, error: fiscalError } = await supabase.functions.invoke('fiscal-api', {
          body: { action: 'emit_nfce', nfce_id: item.nfce_id, tp_emis: 9 },
        });

        if (!fiscalError && fiscalResult?.success) {
          await supabase
            .from('nfce_contingencia_queue')
            .update({
              status: 'transmitida',
              transmitida_em: new Date().toISOString(),
              tentativas: item.tentativas + 1,
              ultimo_erro: null,
            })
            .eq('id', item.id);
          resultado.transmitidas++;
        } else {
          const err = fiscalError?.message || fiscalResult?.error || 'Erro desconhecido';
          const tentativas = item.tentativas + 1;
          // Backoff exponencial: 30s, 1min, 2min, 5min, 10min, 15min (teto)
          const backoffSec = Math.min(30 * Math.pow(2, tentativas - 1), 900);
          await supabase
            .from('nfce_contingencia_queue')
            .update({
              status: 'pendente',
              tentativas,
              ultimo_erro: String(err).substring(0, 500),
              proxima_tentativa: new Date(Date.now() + backoffSec * 1000).toISOString(),
            })
            .eq('id', item.id);
          resultado.erros++;
        }
      } catch (e: any) {
        const tentativas = item.tentativas + 1;
        const backoffSec = Math.min(30 * Math.pow(2, tentativas - 1), 900);
        await supabase
          .from('nfce_contingencia_queue')
          .update({
            status: 'pendente',
            tentativas,
            ultimo_erro: String(e?.message || e).substring(0, 500),
            proxima_tentativa: new Date(Date.now() + backoffSec * 1000).toISOString(),
          })
          .eq('id', item.id);
        resultado.erros++;
      }
    }

    return new Response(
      JSON.stringify({ ok: true, ...resultado, duracao_ms: Date.now() - started }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e: any) {
    console.error('worker error:', e);
    return new Response(
      JSON.stringify({ ok: false, error: e?.message || String(e), ...resultado }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
