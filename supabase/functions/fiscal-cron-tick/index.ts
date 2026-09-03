import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

/**
 * Orquestrador único das rotinas automáticas.
 *
 * Antes: 4+ jobs pg_cron concorrentes esgotavam os background workers do Postgres
 * ("job startup timeout") e derrubavam a validação de token das APIs.
 * Agora: um único agendamento por minuto chama esta função, que decide o que roda,
 * respeitando trava de execução (sem sobreposição) e disjuntor (SEFAZ/API2 fora).
 */

type Tarefa = {
  nome: string;
  fn: string;              // edge function alvo
  cadaSegundos: number;    // intervalo mínimo entre execuções
  ttlSegundos: number;     // validade da trava
  circuito: string;        // chave do disjuntor compartilhado
  body?: Record<string, unknown>;
};

const TAREFAS: Tarefa[] = [
  { nome: 'fila-nfce',      fn: 'process-nfce-queue',        cadaSegundos: 120,  ttlSegundos: 600, circuito: 'sefaz-api2' },
  { nome: 'fila-nfe',       fn: 'process-nfe-queue',         cadaSegundos: 120,  ttlSegundos: 600, circuito: 'sefaz-api2' },
  { nome: 'fila-mdfe',      fn: 'process-mdfe-queue',        cadaSegundos: 180,  ttlSegundos: 600, circuito: 'sefaz-api2' },
  { nome: 'fila-cte',       fn: 'process-cte-queue',         cadaSegundos: 180,  ttlSegundos: 600, circuito: 'sefaz-api2' },
  { nome: 'fila-nfse',      fn: 'process-nfse-queue',        cadaSegundos: 300,  ttlSegundos: 600, circuito: 'sefin-nfse' },
  { nome: 'contingencia',   fn: 'nfce-contingencia-worker',  cadaSegundos: 300,  ttlSegundos: 600, circuito: 'sefaz-api2' },
  { nome: 'sweep-539',      fn: 'fiscal-api',                cadaSegundos: 3600, ttlSegundos: 900, circuito: 'sefaz-api2', body: { action: 'sweep_539' } },
  { nome: 'sweep-presos',   fn: 'fiscal-api',                cadaSegundos: 900,  ttlSegundos: 900, circuito: 'sefaz-api2', body: { action: 'sweep_presos' } },
];

const CIRCUITO_LIMITE = 5;      // falhas consecutivas antes de abrir
const CIRCUITO_PAUSA = 300;     // segundos de pausa quando abre

async function jaRodouRecentemente(nome: string, segundos: number): Promise<boolean> {
  const desde = new Date(Date.now() - segundos * 1000).toISOString();
  const { data } = await supabase
    .from('job_runs')
    .select('id')
    .eq('job', nome)
    .neq('status', 'skipped')
    .gte('started_at', desde)
    .limit(1);
  return !!(data && data.length > 0);
}

async function chamarFuncao(fn: string, body: Record<string, unknown>, timeoutMs: number) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SERVICE_KEY}`,
        apikey: SERVICE_KEY,
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const texto = await res.text();
    let json: any = null;
    try { json = JSON.parse(texto); } catch { /* resposta não-JSON */ }
    return { ok: res.ok, status: res.status, json, texto: texto.slice(0, 500) };
  } finally {
    clearTimeout(t);
  }
}

async function executarTarefa(tarefa: Tarefa, forcar: boolean) {
  const owner = `${crypto.randomUUID()}`;
  const lockKey = `job:${tarefa.nome}`;

  // 1) disjuntor
  if (!forcar) {
    const { data: aberto } = await supabase.rpc('circuit_is_open', { p_key: tarefa.circuito });
    if (aberto === true) {
      return { tarefa: tarefa.nome, resultado: 'circuito_aberto' };
    }
    // 2) intervalo mínimo
    if (await jaRodouRecentemente(tarefa.nome, tarefa.cadaSegundos)) {
      return { tarefa: tarefa.nome, resultado: 'intervalo' };
    }
  }

  // 3) trava (single-flight)
  const { data: pegou } = await supabase.rpc('acquire_job_lock', {
    p_key: lockKey,
    p_owner: owner,
    p_ttl_seconds: tarefa.ttlSegundos,
  });
  if (pegou !== true) {
    return { tarefa: tarefa.nome, resultado: 'em_execucao' };
  }

  const { data: runId } = await supabase.rpc('job_run_start', { p_job: tarefa.nome });

  try {
    const r = await chamarFuncao(tarefa.fn, tarefa.body ?? {}, Math.min(tarefa.ttlSegundos, 240) * 1000);
    const processed = Number(r.json?.processed ?? r.json?.data?.processed ?? 0) || 0;
    const errors = Number(r.json?.errors ?? r.json?.data?.errors ?? 0) || 0;

    if (!r.ok) throw new Error(`HTTP ${r.status}: ${r.texto}`);

    await supabase.rpc('job_run_finish', {
      p_run_id: runId,
      p_status: 'ok',
      p_processed: processed,
      p_errors: errors,
      p_erro: null,
      p_detalhes: r.json ?? null,
    });

    // erros pontuais de item não abrem o disjuntor; só falha total da chamada abre
    await supabase.rpc('circuit_record', {
      p_key: tarefa.circuito,
      p_ok: true,
      p_error: null,
      p_threshold: CIRCUITO_LIMITE,
      p_cooldown_seconds: CIRCUITO_PAUSA,
    });

    return { tarefa: tarefa.nome, resultado: 'ok', processed, errors };
  } catch (e) {
    const msg = (e as Error)?.message ?? String(e);
    await supabase.rpc('job_run_finish', {
      p_run_id: runId,
      p_status: 'error',
      p_processed: 0,
      p_errors: 1,
      p_erro: msg.slice(0, 1000),
      p_detalhes: null,
    });
    await supabase.rpc('circuit_record', {
      p_key: tarefa.circuito,
      p_ok: false,
      p_error: msg.slice(0, 500),
      p_threshold: CIRCUITO_LIMITE,
      p_cooldown_seconds: CIRCUITO_PAUSA,
    });
    return { tarefa: tarefa.nome, resultado: 'erro', erro: msg.slice(0, 300) };
  } finally {
    await supabase.rpc('release_job_lock', { p_key: lockKey, p_owner: owner });
  }
}

/** Rotinas próprias do banco (não passam por edge function) */
async function rotinasBanco(forcar: boolean) {
  const saidas: unknown[] = [];

  // DF-e: a cada 15 min
  if (forcar || !(await jaRodouRecentemente('dfe-sync', 900))) {
    const owner = crypto.randomUUID();
    const { data: pegou } = await supabase.rpc('acquire_job_lock', { p_key: 'job:dfe-sync', p_owner: owner, p_ttl_seconds: 600 });
    if (pegou === true) {
      const { data: runId } = await supabase.rpc('job_run_start', { p_job: 'dfe-sync' });
      try {
        const { error } = await supabase.rpc('dfe_sync_all_empresas');
        if (error) throw new Error(error.message);
        await supabase.rpc('job_run_finish', { p_run_id: runId, p_status: 'ok', p_processed: 0, p_errors: 0, p_erro: null, p_detalhes: null });
        saidas.push({ tarefa: 'dfe-sync', resultado: 'ok' });
      } catch (e) {
        const msg = (e as Error)?.message ?? String(e);
        await supabase.rpc('job_run_finish', { p_run_id: runId, p_status: 'error', p_processed: 0, p_errors: 1, p_erro: msg.slice(0, 1000), p_detalhes: null });
        saidas.push({ tarefa: 'dfe-sync', resultado: 'erro', erro: msg.slice(0, 300) });
      } finally {
        await supabase.rpc('release_job_lock', { p_key: 'job:dfe-sync', p_owner: owner });
      }
    } else {
      saidas.push({ tarefa: 'dfe-sync', resultado: 'em_execucao' });
    }
  } else {
    saidas.push({ tarefa: 'dfe-sync', resultado: 'intervalo' });
  }

  // Expurgo de históricos: 1x por dia
  if (!(await jaRodouRecentemente('purga-historico', 86400))) {
    const owner = crypto.randomUUID();
    const { data: pegou } = await supabase.rpc('acquire_job_lock', { p_key: 'job:purga-historico', p_owner: owner, p_ttl_seconds: 900 });
    if (pegou === true) {
      const { data: runId } = await supabase.rpc('job_run_start', { p_job: 'purga-historico' });
      try {
        const { data, error } = await supabase.rpc('purge_operational_history', { p_dias: 60 });
        if (error) throw new Error(error.message);
        await supabase.rpc('job_run_finish', { p_run_id: runId, p_status: 'ok', p_processed: 0, p_errors: 0, p_erro: null, p_detalhes: data ?? null });
        saidas.push({ tarefa: 'purga-historico', resultado: 'ok', detalhes: data });
      } catch (e) {
        const msg = (e as Error)?.message ?? String(e);
        await supabase.rpc('job_run_finish', { p_run_id: runId, p_status: 'error', p_processed: 0, p_errors: 1, p_erro: msg.slice(0, 1000), p_detalhes: null });
        saidas.push({ tarefa: 'purga-historico', resultado: 'erro', erro: msg.slice(0, 300) });
      } finally {
        await supabase.rpc('release_job_lock', { p_key: 'job:purga-historico', p_owner: owner });
      }
    }
  }

  return saidas;
}

/** Dispara alerta quando o pulso ficou parado por muito tempo. */
async function alertarSeParado() {
  try {
    const { data } = await supabase
      .from('job_runs')
      .select('started_at')
      .eq('job', 'tick')
      .order('started_at', { ascending: false })
      .limit(1);
    const ultimo = data?.[0]?.started_at ? new Date(data[0].started_at).getTime() : null;
    if (!ultimo) return null;
    const minutos = Math.round((Date.now() - ultimo) / 60000);
    if (minutos <= 10) return null;

    console.error(`ALERTA: pulso das rotinas parado por ${minutos} minutos`);
    const alvo = Deno.env.get('ALERT_WEBHOOK_URL');
    if (alvo) {
      await fetch(alvo, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          evento: 'rotinas.degradado',
          minutos_parado: minutos,
          ultimo_tick: new Date(ultimo).toISOString(),
          ts: new Date().toISOString(),
        }),
      }).catch(() => {});
    }
    return minutos;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);

  // Health leve: não toca em tabelas
  if (req.method === 'GET' && url.pathname.endsWith('/health')) {
    return new Response(JSON.stringify({ status: 'ok', service: 'fiscal-cron-tick', ts: new Date().toISOString() }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  // Saúde das rotinas (consulta agregada)
  if (req.method === 'GET' && url.pathname.endsWith('/status')) {
    const { data, error } = await supabase.rpc('job_health');
    return new Response(JSON.stringify(error ? { error: error.message } : data),
      { status: error ? 500 : 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const body = await req.json().catch(() => ({} as any));
  const forcar = body?.forcar === true || url.searchParams.get('forcar') === '1';
  const somente: string[] | null = Array.isArray(body?.tarefas) ? body.tarefas : null;

  const inicio = Date.now();
  const resultados: unknown[] = [];
  let tickRunId: string | null = null;

  try {
    // Trava global do tick: se o anterior ainda roda, este sai imediatamente.
    const tickOwner = crypto.randomUUID();
    const { data: pegouTick } = await supabase.rpc('acquire_job_lock', {
      p_key: 'job:tick',
      p_owner: tickOwner,
      p_ttl_seconds: 300,
    });
    if (pegouTick !== true) {
      return new Response(JSON.stringify({ success: true, skipped: 'tick_em_execucao' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Detecta parada do pulso antes de registrar a execução atual
    const minutosParado = await alertarSeParado();

    // Registro do próprio pulso: torna visível quando ele deixa de rodar
    const { data: rid } = await supabase.rpc('job_run_start', { p_job: 'tick' });
    tickRunId = (rid as string) ?? null;


    try {
      // Tarefas sequenciais — nunca em paralelo, para não repetir a saturação.
      for (const tarefa of TAREFAS) {
        if (somente && !somente.includes(tarefa.nome)) continue;
        resultados.push(await executarTarefa(tarefa, forcar));
      }
      if (!somente) {
        resultados.push(...(await rotinasBanco(forcar)));
      }
    } finally {
      await supabase.rpc('release_job_lock', { p_key: 'job:tick', p_owner: tickOwner });
    }

    const erros = resultados.filter((r: any) => r?.resultado === 'erro').length;
    if (tickRunId) {
      await supabase.rpc('job_run_finish', {
        p_run_id: tickRunId,
        p_status: erros > 0 ? 'error' : 'ok',
        p_processed: resultados.length,
        p_errors: erros,
        p_erro: erros > 0 ? 'uma ou mais tarefas falharam' : null,
        p_detalhes: { resultados, minutos_parado: minutosParado },
      });
    }

    return new Response(
      JSON.stringify({ success: true, duracao_ms: Date.now() - inicio, minutos_parado: minutosParado, resultados }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error('tick erro:', e);
    const msg = (e as Error)?.message ?? String(e);
    if (tickRunId) {
      await supabase.rpc('job_run_finish', {
        p_run_id: tickRunId, p_status: 'error', p_processed: 0, p_errors: 1,
        p_erro: msg.slice(0, 1000), p_detalhes: null,
      }).catch?.(() => {});
    }
    return new Response(
      JSON.stringify({ success: false, error: msg, resultados }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

});
