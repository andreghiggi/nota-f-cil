// Worker genérico de fila fiscal (MDF-e, CT-e/CT-e OS, NFS-e).
//
// Mesmo padrão já usado em process-nfe-queue / process-nfce-queue:
//  - sweep de órfãos ('processando' parado há X minutos volta para 'pendente' e reenfileira)
//  - lote limitado por execução
//  - backoff exponencial por tentativa, teto de tentativas
//  - falha transitória (timeout/rede/SEFAZ fora) não queima o documento: reagenda
//  - estado terminal remove o item da fila
//
// A devolução da numeração ao pool (series_numeros_liberados) é feita pelos
// gatilhos trg_pool_numero_* no banco quando o status vira 'rejeitada'.

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

export type FilaConfig = {
  label: string;              // 'MDF-e'
  tabela: 'mdfe' | 'cte' | 'nfse';
  fila: string;               // 'fila_processamento_mdfe'
  fk: string;                 // 'mdfe_id'
  action: string;             // 'emit_mdfe'
  idParam: string;            // 'mdfe_id'
  campoNumero: string;        // 'numero' | 'numero_dps'
  lote?: number;
};

const TERMINAIS = ['autorizada', 'cancelada', 'inutilizada', 'encerrada', 'denegada', 'abortada'];
const TRANSITORIO = /timeout|timed out|resolving timed out|connection reset|recv failure|could not resolve|ssl connect|empty reply|soap|502|503|504|indispon/i;

async function sweepOrfaos(supabase: SupabaseClient, cfg: FilaConfig) {
  const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { data: orfaos } = await supabase
    .from(cfg.tabela)
    .select(`id, ${cfg.campoNumero}`)
    .eq('status', 'processando')
    .lt('updated_at', cutoff)
    .limit(50);

  for (const o of (orfaos || []) as any[]) {
    const { data: jaNaFila } = await supabase
      .from(cfg.fila).select('id').eq(cfg.fk, o.id).maybeSingle();
    if (jaNaFila) continue;
    await supabase.from(cfg.tabela).update({
      status: 'pendente',
      erro_processamento: 'Timeout/interrupção durante emissão anterior — reprocessando automaticamente',
    }).eq('id', o.id).eq('status', 'processando');
    await supabase.from(cfg.fila).insert({
      [cfg.fk]: o.id, prioridade: 5, tentativas: 0, max_tentativas: 3,
      proximo_processamento: new Date().toISOString(),
    });
  }
}

export async function processarFila(cfg: FilaConfig) {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const started = Date.now();
  let processed = 0;
  let errors = 0;
  let limpos = 0;

  try {
    await sweepOrfaos(supabase, cfg).catch((e) =>
      console.error(`⚠️ sweep órfãos ${cfg.label}:`, (e as Error)?.message));

    const { data: itens, error: filaErr } = await supabase
      .from(cfg.fila)
      .select('*')
      .lte('proximo_processamento', new Date().toISOString())
      .order('prioridade', { ascending: true })
      .limit(cfg.lote ?? 20);

    if (filaErr) throw new Error(filaErr.message);

    for (const item of (itens || []) as any[]) {
      const docId = item[cfg.fk];
      const { data: doc } = await supabase
        .from(cfg.tabela)
        .select(`id, status, empresa_id, ${cfg.campoNumero}`)
        .eq('id', docId)
        .maybeSingle();

      // Documento sumiu ou já está em estado final: fila é lixo, remove.
      if (!doc || TERMINAIS.includes(String((doc as any).status))) {
        await supabase.from(cfg.fila).delete().eq('id', item.id);
        limpos++;
        continue;
      }
      // Rejeitada e já sem tentativas: não reenvia automaticamente (numeração já devolvida).
      if (String((doc as any).status) === 'rejeitada' && item.tentativas >= item.max_tentativas) {
        await supabase.from(cfg.fila).delete().eq('id', item.id);
        limpos++;
        continue;
      }

      const numero = (doc as any)[cfg.campoNumero];

      try {
        const { data: result, error: invokeError } = await supabase.functions.invoke('fiscal-api', {
          body: { action: cfg.action, [cfg.idParam]: docId },
        });
        if (invokeError) throw new Error(invokeError.message || 'Erro ao invocar API fiscal');

        const status = result?.data?.status || result?.status;
        if (result?.error || ['rejeitada', 'processando', 'pendente'].includes(String(status))) {
          throw new Error(
            result?.error || result?.data?.motivo_retorno || result?.data?.erro_processamento ||
            JSON.stringify(result || {}).slice(0, 400),
          );
        }

        await supabase.from(cfg.fila).delete().eq('id', item.id);
        processed++;
        console.log(`✅ ${cfg.label} ${numero} processado`);
      } catch (e: any) {
        errors++;
        const msg = String(e?.message || e).slice(0, 500);
        const tentativas = item.tentativas + 1;
        console.error(`❌ ${cfg.label} ${numero}:`, msg);

        if (tentativas >= item.max_tentativas) {
          if (TRANSITORIO.test(msg)) {
            // Indisponibilidade não pode queimar o documento: espera 15 min e amplia o teto.
            await supabase.from(cfg.fila).update({
              tentativas,
              max_tentativas: tentativas + 3,
              proximo_processamento: new Date(Date.now() + 15 * 60_000).toISOString(),
              erro_ultimo: msg,
            }).eq('id', item.id);
            await supabase.from(cfg.tabela).update({
              status: 'pendente',
              erro_processamento: `Falha temporária SEFAZ/API2: ${msg}`,
            }).eq('id', docId).not('status', 'in', `(${TERMINAIS.join(',')})`);
            continue;
          }

          await supabase.from(cfg.tabela).update({
            status: 'rejeitada',
            erro_processamento: `Máximo de tentativas atingido: ${msg}`,
          }).eq('id', docId).not('status', 'in', `(${TERMINAIS.join(',')})`);

          await supabase.from(cfg.fila).delete().eq('id', item.id);

          await supabase.rpc('registrar_log', {
            p_empresa_id: (doc as any).empresa_id,
            p_nfce_id: null,
            p_token_api_id: null,
            p_tipo: 'erro',
            p_categoria: 'processamento',
            p_mensagem: `${cfg.label} ${numero} falhou após ${tentativas} tentativas`,
            p_detalhes: { erro: msg, documento_id: docId, modelo: cfg.tabela },
          }).catch?.(() => {});
        } else {
          await supabase.from(cfg.fila).update({
            tentativas,
            proximo_processamento: new Date(Date.now() + Math.pow(2, tentativas) * 60_000).toISOString(),
            erro_ultimo: msg,
          }).eq('id', item.id);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, modelo: cfg.tabela, processed, errors, limpos, duracao_ms: Date.now() - started }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e: any) {
    console.error(`❌ fila ${cfg.label}:`, e?.message || e);
    return new Response(
      JSON.stringify({ success: false, error: String(e?.message || e), processed, errors }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
}
