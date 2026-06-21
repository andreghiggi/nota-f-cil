// DF-e API — Manifestação do Destinatário (NFeDistribuicaoDFe + RecepcaoEvento)
// Sincroniza NF-e destinadas ao CNPJ da empresa direto da SEFAZ (via api2/sped-nfe)
// e permite manifestar (Ciência / Confirmação / Desconhecimento / Não Realizada).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

const FISCAL_API_BASE_URL = 'https://api2.agilizeerp.com.br';
const TP_EVENTOS = ['210200', '210210', '210220', '210240'] as const;
type TpEvento = typeof TP_EVENTOS[number];

const STATUS_MAP: Record<TpEvento, string> = {
  '210200': 'confirmada',
  '210210': 'ciente',
  '210220': 'desconhecida',
  '210240': 'nao_realizada',
};

function err(msg: string, code: string, status = 400) {
  return new Response(JSON.stringify({ success: false, error: msg, code }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
function ok(data: any, status = 200) {
  return new Response(JSON.stringify({ success: true, data }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function hashToken(token: string): Promise<string> {
  const enc = new TextEncoder().encode(token);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Garante api_key_fiscal pra empresa (sincronizando no api2 se faltar) */
async function ensureApiKey(supabase: any, empresaId: string): Promise<{ apiKey: string; empresa: any } | { error: string }> {
  const { data: empresa } = await supabase.from('empresas').select('*').eq('id', empresaId).maybeSingle();
  if (!empresa) return { error: 'Empresa não encontrada' };
  if (empresa.api_key_fiscal && empresa.api_key_fiscal !== 'pending') {
    return { apiKey: empresa.api_key_fiscal, empresa };
  }
  // dispara o registro via fiscal-api para garantir api_key
  const { data: reg } = await supabase.functions.invoke('fiscal-api', {
    body: { action: 'register_empresa', empresa_id: empresaId }
  });
  if (reg?.api_key) return { apiKey: reg.api_key, empresa: { ...empresa, api_key_fiscal: reg.api_key } };
  return { error: 'Não foi possível obter api_key_fiscal' };
}

/** Decodifica retDistDFe e extrai docZip (gzip + base64) */
async function gunzipBase64(b64: string): Promise<string> {
  const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const ds = new DecompressionStream('gzip');
  const stream = new Blob([bin]).stream().pipeThrough(ds);
  return await new Response(stream).text();
}

interface ParsedDoc {
  nsu: number;
  schema: string;
  xml: string;
  chave: string;
  tipo: 'resumo' | 'completo' | 'evento';
  cnpj_emitente?: string;
  nome_emitente?: string;
  ie_emitente?: string;
  numero?: string;
  serie?: string;
  data_emissao?: string;
  valor_total?: number;
  tp_nf?: number;
  situacao?: string;
  digest?: string;
}

function pickTag(xml: string, tag: string): string | undefined {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  return m ? m[1].trim() : undefined;
}

function parseDoc(nsu: number, schema: string, xml: string): ParsedDoc | null {
  const isResNFe = schema.startsWith('resNFe');
  const isProcNFe = schema.startsWith('procNFe');
  const isResEvento = schema.startsWith('resEvento');
  const isProcEvento = schema.startsWith('procEventoNFe');
  const chave = pickTag(xml, 'chNFe') || (xml.match(/Id="NFe(\d{44})"/)?.[1] ?? '');
  if (!chave) return null;
  const base: ParsedDoc = { nsu, schema, xml, chave, tipo: 'resumo' };
  if (isResNFe) {
    base.tipo = 'resumo';
    base.cnpj_emitente = pickTag(xml, 'CNPJ');
    base.nome_emitente = pickTag(xml, 'xNome');
    base.ie_emitente = pickTag(xml, 'IE');
    base.data_emissao = pickTag(xml, 'dhEmi');
    base.valor_total = Number(pickTag(xml, 'vNF') || 0);
    base.tp_nf = Number(pickTag(xml, 'tpNF') || 1);
    base.situacao = pickTag(xml, 'cSitNFe');
    base.digest = pickTag(xml, 'digVal');
  } else if (isProcNFe) {
    base.tipo = 'completo';
    base.cnpj_emitente = pickTag(xml, 'CNPJ');
    base.nome_emitente = pickTag(xml, 'xNome');
    base.data_emissao = pickTag(xml, 'dhEmi');
    base.valor_total = Number(pickTag(xml, 'vNF') || 0);
    base.tp_nf = Number(pickTag(xml, 'tpNF') || 1);
    base.numero = pickTag(xml, 'nNF');
    base.serie = pickTag(xml, 'serie');
  } else if (isResEvento || isProcEvento) {
    base.tipo = 'evento';
  }
  return base;
}

async function extractDocs(retXmlBase64: string): Promise<ParsedDoc[]> {
  const retXml = new TextDecoder('utf-8').decode(Uint8Array.from(atob(retXmlBase64), c => c.charCodeAt(0)));
  const out: ParsedDoc[] = [];
  const re = /<docZip\s+NSU="(\d+)"\s+schema="([^"]+)">([^<]+)<\/docZip>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(retXml)) !== null) {
    const nsu = Number(m[1]);
    const schema = m[2];
    const b64 = m[3];
    try {
      const xml = await gunzipBase64(b64);
      const doc = parseDoc(nsu, schema, xml);
      if (doc) out.push(doc);
    } catch (e) {
      console.warn(`docZip NSU=${nsu} falhou:`, (e as Error).message);
    }
  }
  return out;
}

/** Sincroniza DF-e para uma empresa: chama api2 em loop até cStat=137 (sem novos docs) */
async function syncEmpresa(supabase: any, empresaId: string, maxLoops = 10): Promise<any> {
  const got = await ensureApiKey(supabase, empresaId);
  if ('error' in got) return { error: got.error };
  const { apiKey } = got;

  let { data: ctrl } = await supabase.from('dfe_distribuicao_controle')
    .select('*').eq('empresa_id', empresaId).maybeSingle();
  if (!ctrl) {
    const { data } = await supabase.from('dfe_distribuicao_controle')
      .insert({ empresa_id: empresaId, ultimo_nsu: 0 }).select().single();
    ctrl = data;
  }

  let ultNSU = ctrl?.ultimo_nsu ?? 0;
  let totalNovos = 0;
  let lastCStat = ''; let lastMotivo = '';
  let maxNSU = ultNSU;

  for (let i = 0; i < maxLoops; i++) {
    const resp = await fetch(`${FISCAL_API_BASE_URL}/nfe/dist-dfe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ ultNSU, api_key: apiKey })
    });
    const text = await resp.text();
    let json: any; try { json = JSON.parse(text); } catch { json = { raw: text }; }
    if (!resp.ok || json.sucesso === false || json.error) {
      await supabase.from('dfe_distribuicao_controle')
        .update({ ultimo_erro: (json.error || text).substring(0, 500), ultima_consulta: new Date().toISOString() })
        .eq('empresa_id', empresaId);
      return { error: json.error || `api2 status ${resp.status}: ${text.substring(0, 300)}` };
    }
    const payload = json.dados || json.data || json;
    lastCStat = String(payload.cStat || '');
    lastMotivo = String(payload.xMotivo || '');
    maxNSU = Number(payload.maxNSU || ultNSU);
    const retUlt = Number(payload.ultNSU || ultNSU);

    if (payload.xml_retorno) {
      const docs = await extractDocs(payload.xml_retorno);
      for (const d of docs) {
        const row: any = {
          empresa_id: empresaId,
          chave_acesso: d.chave,
          nsu: d.nsu,
          schema: d.schema,
          tipo: d.tipo,
          cnpj_emitente: d.cnpj_emitente,
          nome_emitente: d.nome_emitente,
          ie_emitente: d.ie_emitente,
          numero_nfe: d.numero,
          serie: d.serie,
          data_emissao: d.data_emissao,
          valor_total: d.valor_total,
          tp_nf: d.tp_nf,
          situacao_nfe: d.situacao,
          digest_value: d.digest,
        };
        if (d.tipo === 'resumo') row.xml_resumo = d.xml;
        if (d.tipo === 'completo') row.xml_completo = d.xml;
        const { error: upErr } = await supabase.from('dfe_recebidas')
          .upsert(row, { onConflict: 'empresa_id,chave_acesso', ignoreDuplicates: false });
        if (!upErr) totalNovos++;
      }
    }

    ultNSU = retUlt;
    // 138 = doc localizado, segue. 137 = sem novos, encerra.
    if (lastCStat === '137' || retUlt >= maxNSU) break;
  }

  await supabase.from('dfe_distribuicao_controle')
    .update({ ultimo_nsu: ultNSU, max_nsu: maxNSU, ultima_consulta: new Date().toISOString(), ultimo_erro: null })
    .eq('empresa_id', empresaId);

  return { empresa_id: empresaId, ultimo_nsu: ultNSU, max_nsu: maxNSU, docs_processados: totalNovos, cStat: lastCStat, xMotivo: lastMotivo };
}

async function manifestar(supabase: any, dfeRow: any, tpEvento: TpEvento, justificativa: string) {
  const got = await ensureApiKey(supabase, dfeRow.empresa_id);
  if ('error' in got) throw new Error(got.error);
  const { apiKey } = got;

  const resp = await fetch(`${FISCAL_API_BASE_URL}/nfe/manifestar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ chave: dfeRow.chave_acesso, tpEvento, justificativa, api_key: apiKey })
  });
  const text = await resp.text();
  let json: any; try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!resp.ok || json.sucesso === false) {
    throw new Error(json.error || `api2 status ${resp.status}: ${text.substring(0, 300)}`);
  }
  const p = json.dados || json.data || json;
  const aceito = ['135', '136', '155'].includes(String(p.cStat || ''));
  await supabase.from('dfe_eventos').insert({
    dfe_id: dfeRow.id, empresa_id: dfeRow.empresa_id, chave_acesso: dfeRow.chave_acesso,
    tp_evento: tpEvento, justificativa, protocolo: p.protocolo || null,
    codigo_retorno: String(p.cStat || ''), motivo_retorno: p.xMotivo || null,
    xml_retorno: p.xml_retorno ? new TextDecoder().decode(Uint8Array.from(atob(p.xml_retorno), c => c.charCodeAt(0))) : null,
  });
  if (aceito) {
    await supabase.from('dfe_recebidas').update({
      status_manifestacao: STATUS_MAP[tpEvento],
      data_manifestacao: new Date().toISOString(),
    }).eq('id', dfeRow.id);
  }
  return { aceito, ...p };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  try {
    const url = new URL(req.url);
    const parts = url.pathname.split('/').filter(Boolean);
    const sub = parts.slice(1); // após /dfe-api
    const method = req.method;

    if (method === 'GET' && sub.length === 0) {
      return new Response(JSON.stringify({ status: 'ok', service: 'dfe-api' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Auth: token API (x-api-key) ou JWT do app
    let empresaId: string | null = null;
    let viaTokenApi = false;
    const apiKey = req.headers.get('x-api-key');
    if (apiKey) {
      const tokenHash = await hashToken(apiKey);
      const { data } = await supabase.rpc('validar_token_api', { p_token_hash: tokenHash });
      if (!data || data.length === 0) return err('Invalid API key', 'AUTH_INVALID', 401);
      empresaId = data[0].empresa_id;
      viaTokenApi = true;
    } else {
      // JWT do usuário
      const auth = req.headers.get('authorization')?.replace('Bearer ', '');
      if (!auth) return err('Auth required', 'AUTH_REQUIRED', 401);
      const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: `Bearer ${auth}` } }
      });
      const { data: { user } } = await userClient.auth.getUser();
      if (!user) return err('Invalid session', 'AUTH_INVALID', 401);
      // empresa_id vem do body/query; valida ownership
      const body = method !== 'GET' ? await req.clone().json().catch(() => ({})) : {};
      empresaId = body.empresa_id || url.searchParams.get('empresa_id');
      if (!empresaId) return err('empresa_id é obrigatório', 'VALIDATION_ERROR');
      const { data: emp } = await supabase.from('empresas').select('id, user_id').eq('id', empresaId).maybeSingle();
      if (!emp || emp.user_id !== user.id) return err('Forbidden', 'FORBIDDEN', 403);
    }

    // ---------- POST /dfe-api/sync ----------
    if (method === 'POST' && sub[0] === 'sync') {
      const r = await syncEmpresa(supabase, empresaId!);
      if (r.error) return err(r.error, 'SYNC_ERROR', 502);
      return ok(r);
    }

    // ---------- GET /dfe-api?status=&limit=&offset= ----------
    if (method === 'GET' && sub.length === 0) {
      const status = url.searchParams.get('status');
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200);
      const offset = parseInt(url.searchParams.get('offset') || '0');
      let q = supabase.from('dfe_recebidas')
        .select('id, chave_acesso, nsu, tipo, cnpj_emitente, nome_emitente, numero_nfe, serie, data_emissao, valor_total, tp_nf, situacao_nfe, status_manifestacao, data_manifestacao, created_at', { count: 'exact' })
        .eq('empresa_id', empresaId)
        .order('data_emissao', { ascending: false, nullsFirst: false })
        .range(offset, offset + limit - 1);
      if (status) q = q.eq('status_manifestacao', status);
      const { data, count } = await q;
      return new Response(JSON.stringify({ success: true, data, pagination: { total: count, limit, offset } }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ---------- GET /dfe-api/:id ----------
    if (method === 'GET' && sub.length === 1 && sub[0] !== 'sync') {
      const { data } = await supabase.from('dfe_recebidas')
        .select('*, dfe_eventos(*)').eq('id', sub[0]).eq('empresa_id', empresaId).maybeSingle();
      if (!data) return err('Not found', 'NOT_FOUND', 404);
      return ok(data);
    }

    // ---------- GET /dfe-api/:id/xml ----------
    if (method === 'GET' && sub.length === 2 && sub[1] === 'xml') {
      const { data } = await supabase.from('dfe_recebidas')
        .select('chave_acesso, xml_completo, xml_resumo').eq('id', sub[0]).eq('empresa_id', empresaId).maybeSingle();
      if (!data) return err('Not found', 'NOT_FOUND', 404);
      const xml = data.xml_completo || data.xml_resumo;
      if (!xml) return err('XML ainda não disponível (somente resumo). Manifeste com Confirmação ou Ciência para receber o XML completo.', 'NOT_AVAILABLE', 404);
      return new Response(xml, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/xml',
          'Content-Disposition': `attachment; filename="${data.chave_acesso}.xml"`,
        }
      });
    }

    // ---------- POST /dfe-api/:id/manifestar ----------
    if (method === 'POST' && sub.length === 2 && sub[1] === 'manifestar') {
      const body = await req.json().catch(() => ({}));
      const tipo = String(body.tipo || '');
      const map: Record<string, TpEvento> = {
        ciencia: '210210', confirmacao: '210200', desconhecimento: '210220', nao_realizada: '210240',
        '210210': '210210', '210200': '210200', '210220': '210220', '210240': '210240',
      };
      const tpEvento = map[tipo];
      if (!tpEvento) return err('tipo inválido. Use: ciencia|confirmacao|desconhecimento|nao_realizada', 'VALIDATION_ERROR');
      const justificativa = String(body.justificativa || '').trim();
      if ((tpEvento === '210220' || tpEvento === '210240') && justificativa.length < 15) {
        return err('Justificativa de no mínimo 15 caracteres é obrigatória para Desconhecimento/Não Realizada', 'VALIDATION_ERROR');
      }
      const { data: dfe } = await supabase.from('dfe_recebidas').select('*').eq('id', sub[0]).eq('empresa_id', empresaId).maybeSingle();
      if (!dfe) return err('DF-e não encontrado', 'NOT_FOUND', 404);
      try {
        const r = await manifestar(supabase, dfe, tpEvento, justificativa);
        return ok({ id: dfe.id, ...r });
      } catch (e: any) {
        return err(e.message, 'MANIFEST_ERROR', 502);
      }
    }

    return err('Endpoint não encontrado', 'NOT_FOUND', 404);
  } catch (e: any) {
    console.error('dfe-api error:', e);
    return err('Erro interno: ' + e.message, 'INTERNAL_ERROR', 500);
  }
});
