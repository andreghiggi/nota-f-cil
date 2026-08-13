/**
 * Edge Function v2 — fornecedora de dados para fiscalflow.
 * Deploy no Lovable (projeto nota-f-cil): supabase/functions/monitoring-snapshot/index.ts
 *
 * Secrets: MONITORING_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Opcional: API2_PUBLIC_URL
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-monitoring-key',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const LIMIT = 500;
const STUCK_STATUSES = ['processando', 'pendente'];
const STUCK_HOURS = 2;
const OCCUPIED_STATUSES = ['autorizada', 'cancelada', 'denegada', 'inutilizada'];

function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 60 * 60 * 1000).toISOString();
}
function daysAgo(d: number): string {
  return new Date(Date.now() - d * 24 * 60 * 60 * 1000).toISOString();
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function daysBetween(futureIso: string): number {
  return Math.floor((new Date(futureIso).getTime() - Date.now()) / 86400000);
}

function hoursSince(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 3600000;
}

async function checkHealth(base: string, service: string) {
  const url = `${base}/${service}/health`;
  const started = Date.now();
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    const latencyMs = Date.now() - started;
    let body: unknown = null;
    const text = await res.text();
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text.slice(0, 200);
    }
    const authRequired = res.status === 401 || res.status === 403;
    const ok =
      authRequired ||
      (res.ok &&
        (body == null ||
          typeof body !== 'object' ||
          (body as Record<string, unknown>).status === 'ok' ||
          (body as Record<string, unknown>).status === undefined));
    return { service, url, ok, authRequired, statusCode: res.status, latencyMs, body };
  } catch (e) {
    return {
      service,
      url,
      ok: false,
      authRequired: false,
      latencyMs: Date.now() - started,
      error: (e as Error).message,
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const expectedKey = Deno.env.get('MONITORING_API_KEY');
  const providedKey = req.headers.get('x-monitoring-key');
  if (expectedKey && providedKey !== expectedKey) {
    return json({ error: 'Unauthorized — x-monitoring-key inválida' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceKey);
  const functionsBase = `${supabaseUrl}/functions/v1`;
  const nowIso = new Date().toISOString();
  const since24h = daysAgo(1);
  const since7d = daysAgo(7);
  const stuckSince = hoursAgo(STUCK_HOURS);

  const { data: empresasRaw } = await supabase
    .from('empresas')
    .select(
      'id, razao_social, nome_fantasia, cnpj, ambiente, ativo, enviar_ibs_cbs, nfse_ativo, api_key_fiscal',
    )
    .eq('ativo', true);

  const empresas = empresasRaw ?? [];
  const empresaIds = empresas.map((e) => e.id);

  const healthChecks = await Promise.all(
    ['management-api', 'nfe-api', 'nfce-api', 'fiscal-api'].map((s) => checkHealth(functionsBase, s)),
  );

  const [
    mdfeRes,
    contingencyRes,
    cancelNfeRes,
    cancelNfceRes,
    cceRes,
    dfeRes,
    seriesRes,
    liberadosRes,
    rej539Nfe,
    rej539Nfce,
    certsRes,
    tokensRes,
    webhooksRes,
    whLogsRes,
    filaRes,
    filaNfeRes,
    filaMdfeRes,
    stuckNfe,
    stuckNfce,
    stuckMdfe,
    stuckNfse,
    hygieneNfe,
    hygieneNfce,
    hygieneMdfe,
    hygieneNfse,
    logsRes,
  ] = await Promise.all([
    supabase
      .from('mdfe')
      .select('id, empresa_id, numero, serie, data_autorizacao, created_at')
      .eq('status', 'autorizada')
      .is('data_encerramento', null)
      .limit(LIMIT),
    supabase
      .from('nfce_contingencia_queue')
      .select('id, nfce_id, empresa_id, tentativas, prazo_final, transmitida_em, ultimo_erro')
      .limit(LIMIT),
    supabase
      .from('nfe_eventos')
      .select('id, empresa_id, nfe_id, tipo_evento, sequencia, codigo_retorno, motivo_retorno, created_at')
      .eq('tipo_evento', 'cancelamento')
      .eq('codigo_retorno', '501')
      .gte('created_at', since24h)
      .limit(LIMIT),
    supabase
      .from('nfce_eventos')
      .select('id, empresa_id, nfce_id, tipo_evento, sequencia, codigo_retorno, motivo_retorno, created_at')
      .eq('tipo_evento', 'cancelamento')
      .eq('codigo_retorno', '501')
      .gte('created_at', since24h)
      .limit(LIMIT),
    supabase
      .from('nfe_eventos')
      .select('id, empresa_id, nfe_id, tipo_evento, sequencia, codigo_retorno, motivo_retorno, created_at')
      .eq('tipo_evento', 'carta_correcao')
      .gte('sequencia', 18)
      .limit(LIMIT),
    supabase
      .from('dfe_distribuicao_controle')
      .select('empresa_id, ultima_consulta, ultimo_erro, ultimo_nsu')
      .limit(LIMIT),
    supabase
      .from('series_fiscais')
      .select('id, empresa_id, tipo, serie, numero_atual, ativo')
      .limit(LIMIT),
    supabase
      .from('series_numeros_liberados')
      .select('id, empresa_id, tipo, serie, numero, created_at')
      .is('consumed_at', null)
      .lt('created_at', daysAgo(7))
      .limit(LIMIT),
    supabase
      .from('nfe')
      .select('empresa_id, codigo_retorno, motivo_retorno')
      .eq('status', 'rejeitada')
      .gte('created_at', since24h)
      .or('codigo_retorno.eq.539,motivo_retorno.ilike.%duplicidade%')
      .limit(LIMIT),
    supabase
      .from('nfce')
      .select('empresa_id, codigo_retorno, motivo_retorno')
      .eq('status', 'rejeitada')
      .gte('created_at', since24h)
      .or('codigo_retorno.eq.539,motivo_retorno.ilike.%duplicidade%')
      .limit(LIMIT),
    supabase
      .from('certificados_digitais')
      .select('id, empresa_id, data_vencimento, cnpj_certificado')
      .limit(LIMIT),
    supabase
      .from('tokens_api')
      .select('id, empresa_id, nome, status, expires_at, ultimo_uso')
      .limit(LIMIT),
    supabase
      .from('webhooks')
      .select('id, empresa_id, nome, ativo, falhas_consecutivas, ultimo_envio, ultimo_status')
      .limit(LIMIT),
    supabase
      .from('webhook_logs')
      .select('webhook_id, empresa_id, sucesso')
      .gte('created_at', since24h)
      .limit(2000),
    supabase
      .from('fila_processamento')
      .select('id, empresa_id, tentativas, max_tentativas, proximo_processamento, erro_ultimo')
      .limit(LIMIT),
    supabase
      .from('fila_processamento_nfe')
      .select('id, empresa_id, tentativas, max_tentativas, proximo_processamento, erro_ultimo')
      .limit(LIMIT),
    supabase
      .from('fila_processamento_mdfe')
      .select('id, empresa_id, tentativas, max_tentativas, proximo_processamento, erro_ultimo')
      .limit(LIMIT),
    supabase
      .from('nfe')
      .select('id, empresa_id, status, created_at')
      .in('status', STUCK_STATUSES)
      .lt('created_at', stuckSince)
      .limit(LIMIT),
    supabase
      .from('nfce')
      .select('id, empresa_id, status, created_at')
      .in('status', STUCK_STATUSES)
      .lt('created_at', stuckSince)
      .limit(LIMIT),
    supabase
      .from('mdfe')
      .select('id, empresa_id, status, created_at')
      .in('status', STUCK_STATUSES)
      .lt('created_at', stuckSince)
      .limit(LIMIT),
    supabase
      .from('nfse')
      .select('id, empresa_id, status, created_at')
      .in('status', STUCK_STATUSES)
      .lt('created_at', stuckSince)
      .limit(LIMIT),
    supabase
      .from('nfe')
      .select('id, empresa_id, numero, serie, status, ambiente, xml_retorno, chave_acesso, protocolo')
      .eq('status', 'autorizada')
      .limit(LIMIT),
    supabase
      .from('nfce')
      .select('id, empresa_id, numero, serie, status, ambiente, xml_retorno, chave_acesso, protocolo')
      .eq('status', 'autorizada')
      .limit(LIMIT),
    supabase
      .from('mdfe')
      .select('id, empresa_id, numero, serie, status, ambiente, xml_retorno, chave_acesso, protocolo')
      .eq('status', 'autorizada')
      .limit(LIMIT),
    supabase
      .from('nfse')
      .select('id, empresa_id, numero, serie, status, ambiente, xml_nfse, chave_acesso, protocolo')
      .eq('status', 'autorizada')
      .limit(LIMIT),
    supabase
      .from('logs_fiscais')
      .select('empresa_id, categoria, mensagem')
      .eq('tipo', 'erro')
      .gte('created_at', since24h)
      .limit(500),
  ]);

  const mdfeOpen = (mdfeRes.data ?? []).map((m) => ({
    id: m.id,
    empresa_id: m.empresa_id,
    numero: String(m.numero),
    serie: String(m.serie),
    data_autorizacao: m.data_autorizacao,
    created_at: m.created_at,
    hours_open: hoursSince(m.data_autorizacao ?? m.created_at),
  }));

  const contingencyQueue = (contingencyRes.data ?? []).map((c) => ({
    id: c.id,
    nfce_id: c.nfce_id,
    empresa_id: c.empresa_id,
    tentativas: c.tentativas ?? 0,
    prazo_final: c.prazo_final,
    transmitida_em: c.transmitida_em,
    ultimo_erro: c.ultimo_erro,
    expired: c.prazo_final < nowIso && !c.transmitida_em,
  }));

  const cancelEvents501 = [
    ...(cancelNfeRes.data ?? []).map((e) => ({
      id: e.id,
      empresa_id: e.empresa_id,
      doc_id: e.nfe_id,
      doc_tipo: 'nfe' as const,
      tipo_evento: e.tipo_evento,
      sequencia: e.sequencia,
      codigo_retorno: e.codigo_retorno,
      motivo_retorno: e.motivo_retorno,
      created_at: e.created_at,
    })),
    ...(cancelNfceRes.data ?? []).map((e) => ({
      id: e.id,
      empresa_id: e.empresa_id,
      doc_id: e.nfce_id,
      doc_tipo: 'nfce' as const,
      tipo_evento: e.tipo_evento,
      sequencia: e.sequencia,
      codigo_retorno: e.codigo_retorno,
      motivo_retorno: e.motivo_retorno,
      created_at: e.created_at,
    })),
  ];

  const cceNearLimit = (cceRes.data ?? []).map((e) => ({
    id: e.id,
    empresa_id: e.empresa_id,
    doc_id: e.nfe_id,
    doc_tipo: 'nfe' as const,
    tipo_evento: e.tipo_evento,
    sequencia: e.sequencia,
    codigo_retorno: e.codigo_retorno,
    motivo_retorno: e.motivo_retorno,
    created_at: e.created_at,
  }));

  const dfeControl = dfeRes.data ?? [];

  const seriesRows = seriesRes.data ?? [];
  const series = await Promise.all(
    seriesRows.map(async (s) => {
      const table = s.tipo === 'nfce' ? 'nfce' : s.tipo === 'mdfe' ? 'mdfe' : 'nfe';
      const { count: occupied } = await supabase
        .from(table)
        .select('id', { count: 'exact', head: true })
        .eq('empresa_id', s.empresa_id)
        .eq('serie', s.serie)
        .in('status', OCCUPIED_STATUSES);
      const { count: liberados } = await supabase
        .from('series_numeros_liberados')
        .select('id', { count: 'exact', head: true })
        .eq('empresa_id', s.empresa_id)
        .eq('serie', s.serie)
        .eq('tipo', s.tipo)
        .is('consumed_at', null);
      return {
        id: s.id,
        empresa_id: s.empresa_id,
        tipo: s.tipo,
        serie: String(s.serie),
        numero_atual: s.numero_atual ?? 0,
        ativo: s.ativo ?? true,
        occupied_count: occupied ?? 0,
        liberados_pendentes: liberados ?? 0,
      };
    }),
  );

  const liberadosStale = (liberadosRes.data ?? []).map((l) => ({
    id: l.id,
    empresa_id: l.empresa_id,
    tipo: l.tipo,
    serie: String(l.serie),
    numero: l.numero,
    created_at: l.created_at,
    days_old: Math.floor(hoursSince(l.created_at) / 24),
  }));

  const rej539Map = new Map<string, { count: number; sample: string | null; tipo: string }>();
  for (const r of [...(rej539Nfe.data ?? []), ...(rej539Nfce.data ?? [])]) {
    const tipo = (r as { empresa_id: string }).empresa_id ? ('motivo_retorno' in r && rej539Nfe.data?.includes(r) ? 'nfe' : 'nfce') : 'nfe';
    const key = `${r.empresa_id}:${tipo}`;
    const ex = rej539Map.get(key) ?? { count: 0, sample: r.motivo_retorno, tipo };
    ex.count += 1;
    rej539Map.set(key, ex);
  }
  const rejections539 = [...rej539Map.entries()].map(([key, v]) => {
    const [empresa_id] = key.split(':');
    return { empresa_id, cstat: '539', count: v.count, sample_motivo: v.sample, tipo: v.tipo as 'nfe' | 'nfce' };
  });

  const certificados = (certsRes.data ?? []).map((c) => ({
    id: c.id,
    empresa_id: c.empresa_id,
    data_vencimento: c.data_vencimento,
    cnpj_certificado: c.cnpj_certificado,
    dias_restantes: daysBetween(c.data_vencimento),
  }));

  const certEmpresaIds = new Set((certsRes.data ?? []).map((c) => c.empresa_id));
  const empresasSemCertificado = empresas
    .filter((e) => e.ambiente === 'producao' && !certEmpresaIds.has(e.id))
    .map((e) => e.id);

  const certCnpjMismatch = (certsRes.data ?? [])
    .map((c) => {
      const emp = empresas.find((e) => e.id === c.empresa_id);
      if (!emp?.cnpj || !c.cnpj_certificado) return null;
      const clean = (s: string) => s.replace(/\D/g, '');
      if (clean(c.cnpj_certificado) !== clean(emp.cnpj)) {
        return { empresa_id: c.empresa_id, cert_cnpj: c.cnpj_certificado, empresa_cnpj: emp.cnpj };
      }
      return null;
    })
    .filter(Boolean);

  const tokens = (tokensRes.data ?? []).map((t) => ({
    id: t.id,
    empresa_id: t.empresa_id,
    nome: t.nome,
    status: t.status,
    expires_at: t.expires_at,
    ultimo_uso: t.ultimo_uso,
    dias_para_expirar: t.expires_at ? daysBetween(t.expires_at) : null,
  }));

  const webhooks = webhooksRes.data ?? [];

  const whAgg = new Map<string, { total: number; success: number; empresa_id: string }>();
  for (const log of whLogsRes.data ?? []) {
    const ex = whAgg.get(log.webhook_id) ?? { total: 0, success: 0, empresa_id: log.empresa_id };
    ex.total += 1;
    if (log.sucesso) ex.success += 1;
    whAgg.set(log.webhook_id, ex);
  }
  const webhookDeliveryRate = [...whAgg.entries()].map(([webhook_id, v]) => ({
    webhook_id,
    empresa_id: v.empresa_id,
    total: v.total,
    success: v.success,
    rate: v.total > 0 ? v.success / v.total : 1,
  }));

  const mapFila = (rows: typeof filaRes.data, fila: string) =>
    (rows ?? []).map((f) => ({
      id: f.id,
      empresa_id: f.empresa_id,
      fila,
      tentativas: f.tentativas ?? 0,
      max_tentativas: f.max_tentativas ?? 5,
      proximo_processamento: f.proximo_processamento,
      erro_ultimo: f.erro_ultimo,
      stuck:
        (f.tentativas ?? 0) >= (f.max_tentativas ?? 5) ||
        (f.proximo_processamento != null && f.proximo_processamento < hoursAgo(1)),
    }));

  const filas = [
    ...mapFila(filaRes.data, 'fila_processamento'),
    ...mapFila(filaNfeRes.data, 'fila_processamento_nfe'),
    ...mapFila(filaMdfeRes.data, 'fila_processamento_mdfe'),
  ];

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayIso = todayStart.toISOString();

  const volume: Array<{
    empresa_id: string;
    hoje: number;
    media_7d: number;
    media_14d: number;
    ultima_emissao: string | null;
  }> = [];

  for (const eid of empresaIds.slice(0, 100)) {
    const tables = ['nfe', 'nfce', 'mdfe', 'nfse'] as const;
    let hoje = 0;
    let total7 = 0;
    let total14 = 0;
    let ultima: string | null = null;

    for (const table of tables) {
      const [{ count: cHoje }, { count: c7 }, { count: c14 }, { data: lastDoc }] = await Promise.all([
        supabase.from(table).select('id', { count: 'exact', head: true }).eq('empresa_id', eid).gte('created_at', todayIso),
        supabase.from(table).select('id', { count: 'exact', head: true }).eq('empresa_id', eid).gte('created_at', since7d),
        supabase.from(table).select('id', { count: 'exact', head: true }).eq('empresa_id', eid).gte('created_at', daysAgo(14)),
        supabase.from(table).select('created_at').eq('empresa_id', eid).order('created_at', { ascending: false }).limit(1),
      ]);
      hoje += cHoje ?? 0;
      total7 += c7 ?? 0;
      total14 += c14 ?? 0;
      const last = lastDoc?.[0]?.created_at;
      if (last && (!ultima || last > ultima)) ultima = last;
    }

    volume.push({
      empresa_id: eid,
      hoje,
      media_7d: total7 / 7,
      media_14d: total14 / 14,
      ultima_emissao: ultima,
    });
  }

  const mapStuck = (rows: typeof stuckNfe.data, tipo: string) =>
    (rows ?? []).map((d) => ({
      id: d.id,
      empresa_id: d.empresa_id,
      tipo,
      status: d.status,
      created_at: d.created_at,
      hours_stuck: hoursSince(d.created_at),
    }));

  const stuckDocuments = [
    ...mapStuck(stuckNfe.data, 'nfe'),
    ...mapStuck(stuckNfce.data, 'nfce'),
    ...mapStuck(stuckMdfe.data, 'mdfe'),
    ...mapStuck(stuckNfse.data, 'nfse'),
  ];

  const hygieneDocuments: Array<{
    id: string;
    empresa_id: string;
    tipo: string;
    issue: string;
    numero: string | null;
    serie: string | null;
  }> = [];

  const checkHygiene = (
    rows: Array<Record<string, unknown>>,
    tipo: string,
    xmlField: string,
  ) => {
    for (const d of rows) {
      const emp = empresas.find((e) => e.id === d.empresa_id);
      const xml = d[xmlField];
      if (!xml || String(xml).length < 10) {
        hygieneDocuments.push({
          id: String(d.id),
          empresa_id: String(d.empresa_id),
          tipo,
          issue: 'sem_xml',
          numero: d.numero != null ? String(d.numero) : null,
          serie: d.serie != null ? String(d.serie) : null,
        });
      }
      if (!d.chave_acesso) {
        hygieneDocuments.push({
          id: String(d.id),
          empresa_id: String(d.empresa_id),
          tipo,
          issue: 'sem_chave',
          numero: d.numero != null ? String(d.numero) : null,
          serie: d.serie != null ? String(d.serie) : null,
        });
      }
      if (!d.protocolo) {
        hygieneDocuments.push({
          id: String(d.id),
          empresa_id: String(d.empresa_id),
          tipo,
          issue: 'sem_protocolo',
          numero: d.numero != null ? String(d.numero) : null,
          serie: d.serie != null ? String(d.serie) : null,
        });
      }
      if (emp && d.ambiente && d.ambiente !== emp.ambiente) {
        hygieneDocuments.push({
          id: String(d.id),
          empresa_id: String(d.empresa_id),
          tipo,
          issue: 'ambiente_misturado',
          numero: d.numero != null ? String(d.numero) : null,
          serie: d.serie != null ? String(d.serie) : null,
        });
      }
    }
  };

  checkHygiene(hygieneNfe.data ?? [], 'nfe', 'xml_retorno');
  checkHygiene(hygieneNfce.data ?? [], 'nfce', 'xml_retorno');
  checkHygiene(hygieneMdfe.data ?? [], 'mdfe', 'xml_retorno');
  checkHygiene(hygieneNfse.data ?? [], 'nfse', 'xml_nfse');

  const cstatAgg = new Map<string, { count: number; sample: string | null; tipo: string; empresa_id: string }>();
  for (const table of ['nfe', 'nfce', 'nfse'] as const) {
    const { data: rejRows } = await supabase
      .from(table)
      .select('empresa_id, codigo_retorno, motivo_retorno')
      .eq('status', 'rejeitada')
      .gte('created_at', since24h)
      .limit(500);
    for (const r of rejRows ?? []) {
      const cstat = r.codigo_retorno ?? 'unknown';
      const key = `${r.empresa_id}:${table}:${cstat}`;
      const ex = cstatAgg.get(key) ?? { count: 0, sample: r.motivo_retorno, tipo: table, empresa_id: r.empresa_id };
      ex.count += 1;
      cstatAgg.set(key, ex);
    }
  }
  const rejectionsByCstat = [...cstatAgg.entries()].map(([, v]) => ({
    empresa_id: v.empresa_id,
    cstat: [...cstatAgg.entries()].find(([, val]) => val === v)?.[0]?.split(':')[2] ?? 'unknown',
    count: v.count,
    sample_motivo: v.sample,
    tipo: v.tipo as 'nfe' | 'nfce' | 'nfse',
  }));

  // Fix cstat extraction
  const rejectionsByCstatFixed = [...cstatAgg.entries()].map(([key, v]) => ({
    empresa_id: v.empresa_id,
    cstat: key.split(':')[2] ?? 'unknown',
    count: v.count,
    sample_motivo: v.sample,
    tipo: v.tipo as 'nfe' | 'nfce' | 'nfse',
  }));

  const rejectionRates: Array<{
    empresa_id: string;
    total_24h: number;
    rejeitadas_24h: number;
    taxa: number;
  }> = [];
  for (const eid of empresaIds.slice(0, 100)) {
    let total = 0;
    let rej = 0;
    for (const table of ['nfe', 'nfce', 'nfse'] as const) {
      const [{ count: t }, { count: r }] = await Promise.all([
        supabase.from(table).select('id', { count: 'exact', head: true }).eq('empresa_id', eid).gte('created_at', since24h),
        supabase.from(table).select('id', { count: 'exact', head: true }).eq('empresa_id', eid).eq('status', 'rejeitada').gte('created_at', since24h),
      ]);
      total += t ?? 0;
      rej += r ?? 0;
    }
    if (total > 0) {
      rejectionRates.push({ empresa_id: eid, total_24h: total, rejeitadas_24h: rej, taxa: rej / total });
    }
  }

  const logMap = new Map<string, { count: number; sample: string; empresa_id: string | null; categoria: string }>();
  for (const log of logsRes.data ?? []) {
    const key = `${log.empresa_id ?? 'global'}:${log.categoria ?? 'sem_categoria'}`;
    const ex = logMap.get(key) ?? {
      count: 0,
      sample: log.mensagem ?? '',
      empresa_id: log.empresa_id,
      categoria: log.categoria ?? 'sem_categoria',
    };
    ex.count += 1;
    logMap.set(key, ex);
  }
  const logErrors = [...logMap.values()].sort((a, b) => b.count - a.count).slice(0, 50);

  let api2Snapshot: Record<string, unknown> = {};
  try {
    const api2Url = Deno.env.get('API2_PUBLIC_URL') ?? 'https://api2.agilizeerp.com.br';
    const httpStarted = Date.now();
    const httpRes = await fetch(`${api2Url}/health`).catch(() => null);
    const httpHealth = {
      service: 'api2-http',
      url: `${api2Url}/health`,
      ok: httpRes?.ok ?? false,
      latencyMs: Date.now() - httpStarted,
      statusCode: httpRes?.status,
    };

    let nfseStatus: Record<string, unknown> | undefined;
    const nfseEmpresa = empresas.find((e) => e.nfse_ativo && e.api_key_fiscal);
    if (nfseEmpresa?.api_key_fiscal) {
      const nfseStarted = Date.now();
      const nfseRes = await fetch(`${api2Url}/nfse/status`, {
        headers: { 'X-API-Key': nfseEmpresa.api_key_fiscal },
      }).catch(() => null);
      nfseStatus = {
        service: 'api2-nfse',
        url: `${api2Url}/nfse/status`,
        ok: nfseRes?.ok ?? false,
        latencyMs: Date.now() - nfseStarted,
        statusCode: nfseRes?.status,
      };
    }

    const { data: sshData, error: sshErr } = await supabase.functions.invoke('api2-ssh-exec', {
      body: {
        commands: [
          'curl -sf http://localhost/health || echo HEALTH_FAIL',
          'df -h / | tail -1',
          'systemctl is-active php8.2-fpm 2>/dev/null || systemctl is-active php-fpm 2>/dev/null || echo inactive',
        ],
        timeoutMs: 45000,
      },
    });

    api2Snapshot = {
      httpHealth,
      nfseStatus,
      ssh: sshErr ? { error: sshErr.message } : sshData,
    };
  } catch (e) {
    api2Snapshot = {
      httpHealth: { service: 'api2-http', url: '', ok: false, latencyMs: 0, error: (e as Error).message },
    };
  }

  return json({
    version: 2,
    collectedAt: nowIso,
    empresas,
    datasets: {
      healthChecks,
      api2: api2Snapshot,
      mdfeOpen,
      contingencyQueue,
      cancelEvents501,
      cceNearLimit,
      dfeControl,
      series,
      liberadosStale,
      rejections539,
      certificados,
      empresasSemCertificado,
      certCnpjMismatch,
      tokens,
      webhooks,
      webhookDeliveryRate,
      filas,
      volume,
      stuckDocuments,
      hygieneDocuments: hygieneDocuments.slice(0, LIMIT),
      rejectionsByCstat: rejectionsByCstatFixed,
      rejectionRates,
      logErrors,
    },
    truncated: {
      mdfeOpen: (mdfeRes.data?.length ?? 0) >= LIMIT,
      stuckDocuments: stuckDocuments.length >= LIMIT,
      hygieneDocuments: hygieneDocuments.length >= LIMIT,
    },
  });
});
