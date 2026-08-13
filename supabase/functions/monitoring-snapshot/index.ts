/**
 * Edge Function para deploy no Lovable (projeto nota-f-cil).
 * Cole em supabase/functions/monitoring-snapshot/index.ts no repo nota-f-cil
 * e peça ao Lovable: "Deploy a edge function monitoring-snapshot"
 *
 * Secrets no Supabase (Lovable configura via painel ou chat):
 *   MONITORING_API_KEY = chave que o fiscalflow usa no header x-monitoring-key
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-monitoring-key',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const STUCK_STATUSES = ['processando', 'pendente', 'pendente_transmissao'];
const STUCK_HOURS = 2;
const CONTINGENCY_STALE_MINUTES = 30;

function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 60 * 60 * 1000).toISOString();
}
function minutesAgo(m: number): string {
  return new Date(Date.now() - m * 60 * 1000).toISOString();
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

async function checkHealth(base: string, service: string) {
  const url = `${base}/${service}/health`;
  const started = Date.now();
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    const latencyMs = Date.now() - started;
    let body: unknown = null;
    const text = await res.text();
    try { body = text ? JSON.parse(text) : null; } catch { body = text.slice(0, 200); }

    // 401/403 no /health = API no ar, rota exige token (nfe-api, nfce-api)
    const authRequired = res.status === 401 || res.status === 403;
    const ok =
      authRequired ||
      (res.ok &&
        (body == null ||
          typeof body !== 'object' ||
          (body as Record<string, unknown>).status === 'ok' ||
          (body as Record<string, unknown>).status === undefined));

    return {
      service,
      url,
      ok,
      authRequired,
      statusCode: res.status,
      latencyMs,
      body,
    };
  } catch (e) {
    return { service, url, ok: false, authRequired: false, latencyMs: Date.now() - started, error: (e as Error).message };
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

  const findings: Array<Record<string, unknown>> = [];

  const healthChecks = await Promise.all(
    ['management-api', 'nfe-api', 'nfce-api', 'fiscal-api'].map((s) => checkHealth(functionsBase, s)),
  );

  for (const h of healthChecks) {
    if (!h.ok) {
      findings.push({ severity: 'critical', source: 'fiscal_flow', category: 'health', title: `API ${h.service} indisponível`, detail: (h as { error?: string }).error ?? `HTTP ${h.statusCode}` });
    } else if ((h as { authRequired?: boolean }).authRequired) {
      // API respondendo; health protegido por token — não é falha
    } else if (h.latencyMs > 5000) {
      findings.push({ severity: 'warning', source: 'fiscal_flow', category: 'health', title: `API ${h.service} lenta (${h.latencyMs}ms)` });
    }
  }

  const stuckSince = hoursAgo(STUCK_HOURS);
  const [{ data: stuckNfe }, { data: stuckNfce }] = await Promise.all([
    supabase.from('nfe').select('id, status, created_at').in('status', STUCK_STATUSES).lt('created_at', stuckSince).limit(20),
    supabase.from('nfce').select('id, status, created_at').in('status', STUCK_STATUSES).lt('created_at', stuckSince).limit(20),
  ]);

  const stuckTotal = (stuckNfe?.length ?? 0) + (stuckNfce?.length ?? 0);
  if (stuckTotal > 0) {
    findings.push({
      severity: stuckTotal > 10 ? 'critical' : 'warning',
      source: 'fiscal_flow',
      category: 'documents',
      title: `${stuckTotal} nota(s) presa(s) (> ${STUCK_HOURS}h)`,
      detail: `NF-e: ${stuckNfe?.length ?? 0}, NFC-e: ${stuckNfce?.length ?? 0}`,
    });
  }

  const since24h = daysAgo(1);
  const since7d = daysAgo(7);
  const [{ count: rejNfe24 }, { count: rejNfce24 }, { count: rejNfe7 }, { count: rejNfce7 }] = await Promise.all([
    supabase.from('nfe').select('id', { count: 'exact', head: true }).eq('status', 'rejeitada').gte('created_at', since24h),
    supabase.from('nfce').select('id', { count: 'exact', head: true }).eq('status', 'rejeitada').gte('created_at', since24h),
    supabase.from('nfe').select('id', { count: 'exact', head: true }).eq('status', 'rejeitada').gte('created_at', since7d),
    supabase.from('nfce').select('id', { count: 'exact', head: true }).eq('status', 'rejeitada').gte('created_at', since7d),
  ]);

  const last24hTotal = (rejNfe24 ?? 0) + (rejNfce24 ?? 0);
  const avg7dTotal = ((rejNfe7 ?? 0) + (rejNfce7 ?? 0)) / 7;
  const spike = avg7dTotal > 0 && last24hTotal > avg7dTotal * 2;
  if (spike && last24hTotal >= 3) {
    findings.push({ severity: 'warning', source: 'fiscal_flow', category: 'rejections', title: 'Spike de rejeições (24h)', detail: `${last24hTotal} vs média ${avg7dTotal.toFixed(1)}/dia` });
  }

  const contingencySince = minutesAgo(CONTINGENCY_STALE_MINUTES);
  const { data: contingencyAll } = await supabase.from('nfce').select('id, created_at').eq('status', 'contingencia').limit(50);
  const staleContingency = (contingencyAll ?? []).filter((r) => r.created_at < contingencySince);
  if (staleContingency.length > 0) {
    findings.push({ severity: 'warning', source: 'fiscal_flow', category: 'contingency', title: `${staleContingency.length} NFC-e em contingência stale` });
  }

  const { data: certs } = await supabase.from('certificados_digitais').select('id, empresa_id, status, data_vencimento').in('status', ['expirado', 'expirando']).limit(50);
  const expired = (certs ?? []).filter((c) => c.status === 'expirado');
  const expiringSoon = (certs ?? []).filter((c) => c.status === 'expirando');
  if (expired.length) findings.push({ severity: 'critical', source: 'fiscal_flow', category: 'certificates', title: `${expired.length} certificado(s) expirado(s)` });
  if (expiringSoon.length) findings.push({ severity: 'warning', source: 'fiscal_flow', category: 'certificates', title: `${expiringSoon.length} certificado(s) expirando` });

  const { data: webhooks } = await supabase.from('webhooks').select('id, nome, falhas_consecutivas, empresa_id').eq('ativo', true).gte('falhas_consecutivas', 3).limit(20);
  if ((webhooks ?? []).length) {
    findings.push({ severity: 'warning', source: 'fiscal_flow', category: 'webhooks', title: `${webhooks!.length} webhook(s) falhando` });
  }

  const { data: logErrors } = await supabase.from('logs_fiscais').select('categoria, mensagem').eq('tipo', 'erro').gte('created_at', since24h).limit(200);
  const byCat = new Map<string, { count: number; sample: string }>();
  for (const log of logErrors ?? []) {
    const cat = log.categoria ?? 'sem_categoria';
    const ex = byCat.get(cat) ?? { count: 0, sample: log.mensagem ?? '' };
    ex.count += 1;
    byCat.set(cat, ex);
  }
  const logErrorGroups = [...byCat.entries()].map(([categoria, v]) => ({ categoria, count: v.count, sample: v.sample })).sort((a, b) => b.count - a.count).slice(0, 10);

  // API2 via função existente api2-ssh-exec (secrets já no Supabase do Lovable)
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
    if (!httpHealth.ok) findings.push({ severity: 'critical', source: 'api2', category: 'health', title: 'API2 HTTP offline' });

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

    api2Snapshot = { httpHealth, ssh: sshErr ? { error: sshErr.message } : sshData };
    if (sshErr) findings.push({ severity: 'warning', source: 'api2', category: 'ssh', title: 'SSH API2 indisponível', detail: sshErr.message });
  } catch (e) {
    api2Snapshot = { error: (e as Error).message };
  }

  const fiscalFlowSnapshot = {
    healthChecks,
    stuckDocuments: { nfe: stuckNfe?.length ?? 0, nfce: stuckNfce?.length ?? 0, samples: [] },
    rejectionStats: {
      last24h: { nfe: rejNfe24 ?? 0, nfce: rejNfce24 ?? 0, total: last24hTotal },
      avg7d: { nfe: (rejNfe7 ?? 0) / 7, nfce: (rejNfce7 ?? 0) / 7, total: avg7dTotal },
      spike,
    },
    contingency: { count: contingencyAll?.length ?? 0, staleCount: staleContingency.length, samples: staleContingency.slice(0, 5) },
    certificates: { expired: expired.length, expiringSoon: expiringSoon.length, items: (certs ?? []).slice(0, 10) },
    webhooks: { failingCount: webhooks?.length ?? 0, items: webhooks ?? [] },
    logErrors: { total: logErrors?.length ?? 0, byCategory: logErrorGroups },
  };

  const summary = findings.reduce(
    (acc, f) => {
      const s = f.severity as string;
      if (s === 'critical') acc.critical += 1;
      else if (s === 'warning') acc.warning += 1;
      else acc.info += 1;
      return acc;
    },
    { critical: 0, warning: 0, info: 0 },
  );

  const penalty = summary.critical * 25 + summary.warning * 8 + summary.info;
  const score = Math.max(0, Math.min(100, 100 - penalty));

  return json({
    collectedAt: new Date().toISOString(),
    score,
    summary,
    findings,
    fiscalFlow: fiscalFlowSnapshot,
    api2: api2Snapshot,
  });
});
