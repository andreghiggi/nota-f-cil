// Rotina de diagnóstico SOMENTE LEITURA.
// Protegida por header x-diag-token (secret FISCAL_DIAG_TOKEN).
// Nunca escreve, nunca retorna certificados, senhas ou secrets.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-diag-token',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

async function safe<T>(label: string, fn: () => Promise<T>): Promise<any> {
  try {
    return await fn();
  } catch (e) {
    return { _erro: `${label}: ${(e as Error)?.message || String(e)}` };
  }
}

function agrupar(rows: any[] | null, campo: string) {
  const out: Record<string, number> = {};
  for (const r of rows || []) {
    const k = String(r?.[campo] ?? 'null');
    out[k] = (out[k] || 0) + 1;
  }
  return out;
}

const MODELOS = ['nfce', 'nfe', 'mdfe', 'cte', 'nfse'] as const;
const FILAS: Record<string, string> = {
  nfce: 'fila_processamento',
  nfe: 'fila_processamento_nfe',
  mdfe: 'fila_processamento_mdfe',
  cte: 'fila_processamento_cte',
  nfse: 'fila_processamento_nfse',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const esperado = Deno.env.get('FISCAL_DIAG_TOKEN');
  const url = new URL(req.url);
  const token = req.headers.get('x-diag-token') || url.searchParams.get('token');
  if (!esperado || token !== esperado) return json({ error: 'unauthorized' }, 401);

  const dias = Math.min(Math.max(parseInt(url.searchParams.get('dias') || '7', 10) || 7, 1), 30);
  const desde = new Date(Date.now() - dias * 86400_000).toISOString();
  const cutoffPreso = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const secao = url.searchParams.get('secao') || 'all';
  const quer = (s: string) => secao === 'all' || secao === s;

  const resultado: Record<string, unknown> = {
    ok: true,
    gerado_em: new Date().toISOString(),
    janela_dias: dias,
  };

  // Empresas (nome para correlacionar)
  const empresasMap: Record<string, string> = {};
  await safe('empresas', async () => {
    const { data } = await supabase.from('empresas').select('id, razao_social, cnpj, ativo').limit(500);
    for (const e of data || []) empresasMap[e.id] = e.razao_social || e.cnpj;
    if (quer('empresas')) resultado.empresas_ativas = (data || []).filter((e: any) => e.ativo).length;
    return null;
  });

  // 1) Situação por modelo
  if (quer('status')) {
    const porModelo: Record<string, unknown> = {};
    for (const m of MODELOS) {
      porModelo[m] = await safe(m, async () => {
        const { data, error } = await supabase
          .from(m)
          .select('status, empresa_id')
          .gte('created_at', desde)
          .limit(20000);
        if (error) throw error;
        return {
          total: (data || []).length,
          por_status: agrupar(data, 'status'),
        };
      });
    }
    resultado.situacao_por_modelo = porModelo;

    // NFC-e por empresa e status
    resultado.nfce_por_empresa = await safe('nfce_por_empresa', async () => {
      const { data, error } = await supabase
        .from('nfce')
        .select('status, empresa_id')
        .gte('created_at', desde)
        .limit(20000);
      if (error) throw error;
      const out: Record<string, Record<string, number>> = {};
      for (const r of data || []) {
        const nome = empresasMap[r.empresa_id] || r.empresa_id;
        out[nome] = out[nome] || {};
        out[nome][r.status] = (out[nome][r.status] || 0) + 1;
      }
      return out;
    });
  }

  // 2) Presos em processando/pendente
  if (quer('presos')) {
    const presos: Record<string, unknown> = {};
    for (const m of MODELOS) {
      presos[m] = await safe(`presos_${m}`, async () => {
        const { data, error } = await supabase
          .from(m)
          .select('id, numero, serie, status, empresa_id, updated_at, created_at, erro_processamento')
          .in('status', ['processando', 'pendente'])
          .lt('updated_at', cutoffPreso)
          .order('updated_at', { ascending: true })
          .limit(50);
        if (error) throw error;
        return (data || []).map((r: any) => ({
          ...r,
          empresa: empresasMap[r.empresa_id] || r.empresa_id,
        }));
      });
    }
    resultado.presos = presos;
  }

  // 3) Últimas abortadas e rejeitadas (motivo real)
  if (quer('erros')) {
    resultado.ultimas_rejeitadas = await safe('rejeitadas', async () => {
      const { data, error } = await supabase
        .from('nfce')
        .select('id, numero, serie, status, empresa_id, created_at, codigo_retorno, motivo_retorno, erro_processamento')
        .in('status', ['rejeitada', 'abortada', 'denegada'])
        .gte('created_at', desde)
        .order('created_at', { ascending: false })
        .limit(60);
      if (error) throw error;
      return (data || []).map((r: any) => ({ ...r, empresa: empresasMap[r.empresa_id] || r.empresa_id }));
    });

    resultado.motivos_agrupados = await safe('motivos', async () => {
      const { data, error } = await supabase
        .from('nfce')
        .select('codigo_retorno, motivo_retorno, erro_processamento, status')
        .in('status', ['rejeitada', 'abortada', 'denegada'])
        .gte('created_at', desde)
        .limit(5000);
      if (error) throw error;
      const out: Record<string, number> = {};
      for (const r of data || []) {
        const chave = `${r.status}|${r.codigo_retorno ?? '-'}|${String(r.motivo_retorno || r.erro_processamento || 'sem motivo').slice(0, 160)}`;
        out[chave] = (out[chave] || 0) + 1;
      }
      return Object.fromEntries(Object.entries(out).sort((a, b) => b[1] - a[1]).slice(0, 40));
    });
  }

  // 4) Filas
  if (quer('filas')) {
    const filas: Record<string, unknown> = {};
    for (const [modelo, tabela] of Object.entries(FILAS)) {
      filas[modelo] = await safe(`fila_${modelo}`, async () => {
        const { data, error } = await supabase
          .from(tabela)
          .select('id, tentativas, max_tentativas, proximo_processamento, erro_ultimo, created_at')
          .order('created_at', { ascending: true })
          .limit(500);
        if (error) throw error;
        const rows = data || [];
        const agora = Date.now();
        return {
          total: rows.length,
          vencidos: rows.filter((r: any) => new Date(r.proximo_processamento).getTime() <= agora).length,
          tentativas_esgotadas: rows.filter((r: any) => (r.tentativas ?? 0) >= (r.max_tentativas ?? 3)).length,
          mais_antigo: rows[0]?.created_at ?? null,
          ultimos_erros: rows
            .filter((r: any) => r.erro_ultimo)
            .slice(-10)
            .map((r: any) => ({ id: r.id, tentativas: r.tentativas, erro: String(r.erro_ultimo).slice(0, 300) })),
        };
      });
    }
    resultado.filas = filas;

    resultado.contingencia_nfce = await safe('contingencia', async () => {
      const { data, error } = await supabase
        .from('nfce_contingencia_queue')
        .select('id, nfce_id, tentativas, prazo_final, transmitida_em, ultimo_erro')
        .is('transmitida_em', null)
        .limit(100);
      if (error) throw error;
      return { pendentes: (data || []).length, itens: (data || []).slice(0, 20) };
    });
  }

  // 5) Rotinas automáticas e disjuntor
  if (quer('rotinas')) {
    resultado.job_runs_recentes = await safe('job_runs', async () => {
      const { data, error } = await supabase
        .from('job_runs')
        .select('*')
        .gte('started_at', new Date(Date.now() - 6 * 3600_000).toISOString())
        .order('started_at', { ascending: false })
        .limit(120);
      if (error) throw error;
      const rows = data || [];
      const falhas = rows.filter((r: any) => r.status && r.status !== 'ok' && r.status !== 'sucesso');
      return {
        total_6h: rows.length,
        por_status: agrupar(rows, 'status'),
        ultimas_falhas: falhas.slice(0, 20),
      };
    });

    resultado.job_health = await safe('job_health', async () => {
      const { data, error } = await supabase.rpc('job_health');
      if (error) throw error;
      return data;
    });

    resultado.locks = await safe('job_locks', async () => {
      const { data, error } = await supabase.from('job_locks').select('*').limit(50);
      if (error) throw error;
      return data;
    });

    resultado.disjuntor = await safe('job_circuit', async () => {
      const { data, error } = await supabase.from('job_circuit').select('*').limit(20);
      if (error) throw error;
      return data;
    });
  }

  // 6) Certificados e séries
  if (quer('cadastro')) {
    resultado.certificados = await safe('certificados', async () => {
      const { data, error } = await supabase
        .from('certificados_digitais')
        .select('id, empresa_id, data_vencimento, ativo')
        .limit(300);
      if (error) throw error;
      const agora = Date.now();
      return (data || []).map((c: any) => ({
        empresa: empresasMap[c.empresa_id] || c.empresa_id,
        ativo: c.ativo,
        vence_em_dias: c.data_vencimento
          ? Math.round((new Date(c.data_vencimento).getTime() - agora) / 86400_000)
          : null,
      })).filter((c: any) => c.vence_em_dias === null || c.vence_em_dias < 45 || c.ativo === false);
    });

    resultado.series = await safe('series', async () => {
      const { data, error } = await supabase
        .from('series_fiscais')
        .select('empresa_id, tipo, serie, numero_atual, ativo')
        .limit(500);
      if (error) throw error;
      return (data || []).map((s: any) => ({ ...s, empresa: empresasMap[s.empresa_id] || s.empresa_id }));
    });
  }

  // 7) Logs de erro recentes
  if (quer('logs')) {
    resultado.logs_erro = await safe('logs_fiscais', async () => {
      const { data, error } = await supabase
        .from('logs_fiscais')
        .select('created_at, empresa_id, tipo, categoria, mensagem')
        .eq('tipo', 'erro')
        .gte('created_at', new Date(Date.now() - 24 * 3600_000).toISOString())
        .order('created_at', { ascending: false })
        .limit(80);
      if (error) throw error;
      return (data || []).map((l: any) => ({ ...l, empresa: empresasMap[l.empresa_id] || l.empresa_id }));
    });
  }

  return json(resultado);
});
