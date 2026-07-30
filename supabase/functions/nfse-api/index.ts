// NFS-e Nacional API (SEFIN/ADN) — endpoint público para ERPs.
// Autenticação por token de API (x-api-key / Authorization: Bearer).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

async function hashToken(token: string): Promise<string> {
  const enc = new TextEncoder().encode(token);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function err(msg: string, code: string, status = 400) {
  return new Response(JSON.stringify({ success: false, error: msg, code }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

function ok(data: any, status = 200) {
  return new Response(JSON.stringify({ success: true, data }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function extractInvokeError(e: any, fallback: any): Promise<string> {
  try {
    if (e?.context && typeof e.context.text === 'function') {
      const txt = await e.context.text();
      try {
        const j = JSON.parse(txt);
        return j.error || j.message || txt.substring(0, 500);
      } catch { return txt.substring(0, 500); }
    }
  } catch { /* ignore */ }
  if (fallback?.error) return String(fallback.error);
  return e?.message || 'erro desconhecido';
}

interface NFSePayload {
  external_id?: string;
  serie?: string;
  tomador: {
    cnpj?: string; cpf?: string; documento?: string;
    nome?: string; razao_social?: string;
    email?: string; telefone?: string; im?: string;
    endereco?: Record<string, unknown>;
  };
  servico: {
    discriminacao?: string; descricao?: string;
    codigo_municipio_prestacao?: string;
    c_trib_nac?: string; c_nbs?: string; c_trib_mun?: string; c_ind_op?: string;
  };
  valores: {
    valor_servicos?: number; vServ?: number;
    deducoes?: number; aliquota?: number;
    iss_retido?: number | boolean;
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    const url = new URL(req.url);
    const parts = url.pathname.split('/').filter(Boolean);
    const sub = parts.slice(1); // remove "nfse-api"
    const method = req.method;

    const apiKey = req.headers.get('x-api-key') || req.headers.get('authorization')?.replace('Bearer ', '');

    if (method === 'GET' && sub.length === 0 && !apiKey) {
      return ok({ status: 'ok', service: 'nfse-api', modelo: 'NFS-e Nacional (SEFIN/ADN)' });
    }

    if (!apiKey) return err('API key required', 'AUTH_REQUIRED', 401);
    const tokenHash = await hashToken(apiKey);
    const { data: tokenData } = await supabase.rpc('validar_token_api', { p_token_hash: tokenHash });
    if (!tokenData || tokenData.length === 0) return err('Invalid or expired API key', 'AUTH_INVALID', 401);

    const { token_id, empresa_id, permissoes, ambiente } = tokenData[0];
    await supabase.from('tokens_api')
      .update({ ultimo_uso: new Date().toISOString(), ip_ultimo_uso: req.headers.get('x-forwarded-for') || 'unknown' })
      .eq('id', token_id);

    const has = (p: string) => permissoes.includes(p) || permissoes.includes('gerenciar');

    // ---------- POST /nfse-api → emitir ----------
    if (method === 'POST' && sub.length === 0) {
      if (!has('emitir_nfse') && !has('emitir')) return err('Permission denied (emitir_nfse)', 'PERMISSION_DENIED', 403);

      const payload: NFSePayload = await req.json();
      const { data: empresa } = await supabase.from('empresas')
        .select('*').eq('id', empresa_id).maybeSingle();
      if (!empresa) return err('Empresa não encontrada', 'NOT_FOUND', 404);
      if (!empresa.nfse_ativo) return err('NFS-e não habilitada para esta empresa (ative no cadastro da empresa)', 'NFSE_DISABLED');
      if (!empresa.inscricao_municipal) return err('Empresa sem Inscrição Municipal — configure no cadastro da empresa', 'VALIDATION_ERROR');

      const toma = payload.tomador || ({} as any);
      const documento = String(toma.cnpj || toma.cpf || toma.documento || '').replace(/\D/g, '');
      const nome = (toma.nome || toma.razao_social || '').trim();
      if (!documento || !nome) return err('tomador.documento e tomador.nome são obrigatórios', 'VALIDATION_ERROR');

      const serv = payload.servico || ({} as any);
      const discriminacao = (serv.discriminacao || serv.descricao || '').trim();
      if (!discriminacao) return err('servico.discriminacao é obrigatório', 'VALIDATION_ERROR');

      const val = payload.valores || ({} as any);
      const valorServicos = Number(val.valor_servicos ?? val.vServ ?? 0);
      if (!(valorServicos > 0)) return err('valores.valor_servicos deve ser maior que zero', 'VALIDATION_ERROR');

      const serie = String(payload.serie || empresa.serie_nfse || '1');
      const { data: numeroDps, error: numError } = await supabase
        .rpc('gerar_numero_nfse', { p_empresa_id: empresa_id, p_serie: serie });
      if (numError || !numeroDps) {
        return err('Erro ao gerar número do DPS: ' + (numError?.message || 'série NFS-e não configurada'), 'SERIE_ERROR', 400);
      }

      const issRetidoRaw = val.iss_retido;
      const issRetido = typeof issRetidoRaw === 'boolean' ? (issRetidoRaw ? 2 : 1) : Number(issRetidoRaw ?? 1) || 1;

      const { data: row, error: insError } = await supabase.from('nfse').insert({
        empresa_id,
        token_api_id: token_id,
        numero_dps: numeroDps,
        serie,
        status: 'pendente',
        ambiente,
        tomador_documento: documento,
        tomador_nome: nome,
        tomador_email: toma.email || null,
        tomador_im: toma.im || null,
        discriminacao,
        c_trib_nac: serv.c_trib_nac || empresa.nfse_ctribnac_padrao || null,
        c_nbs: serv.c_nbs || empresa.nfse_cnbs_padrao || null,
        c_trib_mun: serv.c_trib_mun || null,
        codigo_municipio_prestacao: serv.codigo_municipio_prestacao || empresa.codigo_municipio || null,
        valor_servicos: valorServicos,
        valor_deducoes: Number(val.deducoes || 0),
        aliquota_iss: val.aliquota != null ? Number(val.aliquota) : (empresa.nfse_aliquota_padrao ?? null),
        iss_retido: issRetido,
        external_id: payload.external_id || null,
        payload_entrada: payload as any,
      }).select().single();

      if (insError || !row) return err('Erro ao criar NFS-e: ' + (insError?.message || ''), 'INTERNAL_ERROR', 500);

      await supabase.rpc('registrar_log', {
        p_empresa_id: empresa_id, p_nfce_id: row.id, p_token_api_id: token_id,
        p_tipo: 'info', p_categoria: 'api',
        p_mensagem: `NFS-e (DPS ${numeroDps}) criada via API`,
        p_detalhes: { tipo: 'nfse', external_id: payload.external_id },
        p_ip_origem: req.headers.get('x-forwarded-for'),
      });

      const { data: fr, error: fe } = await supabase.functions.invoke('fiscal-api', {
        body: { action: 'emit_nfse', nfse_id: row.id },
      });
      if (fe || !fr?.success) {
        const detalhe = await extractInvokeError(fe, fr);
        return err('Erro ao emitir na SEFIN: ' + detalhe, 'SEFIN_ERROR', 502);
      }

      return ok(fr.data, 201);
    }

    // ---------- GET /nfse-api → listar ----------
    if (method === 'GET' && sub.length === 0) {
      if (!has('consultar')) return err('Permission denied', 'PERMISSION_DENIED', 403);
      const status = url.searchParams.get('status');
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
      const offset = parseInt(url.searchParams.get('offset') || '0');
      let q = supabase.from('nfse')
        .select('id, numero_dps, serie, status, ambiente, data_emissao, chave_acesso, numero_nfse, codigo_verificacao, protocolo, tomador_nome, tomador_documento, valor_servicos, valor_iss, external_id, created_at', { count: 'exact' })
        .eq('empresa_id', empresa_id)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
      if (status) q = q.eq('status', status);
      const { data, count } = await q;
      return new Response(JSON.stringify({ success: true, data, pagination: { total: count, limit, offset } }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ---------- GET /nfse-api/:id ----------
    if (method === 'GET' && sub.length === 1) {
      if (!has('consultar')) return err('Permission denied', 'PERMISSION_DENIED', 403);
      const { data } = await supabase.from('nfse').select('*')
        .eq('id', sub[0]).eq('empresa_id', empresa_id).maybeSingle();
      if (!data) return err('NFS-e not found', 'NOT_FOUND', 404);
      return ok(data);
    }

    // ---------- POST /nfse-api/:id/cancelar ----------
    if (method === 'POST' && sub.length === 2 && sub[1] === 'cancelar') {
      if (!has('cancelar') && !has('emitir_nfse')) return err('Permission denied', 'PERMISSION_DENIED', 403);
      const body = await req.json().catch(() => ({}));
      const { data: nfse } = await supabase.from('nfse').select('id, status')
        .eq('id', sub[0]).eq('empresa_id', empresa_id).maybeSingle();
      if (!nfse) return err('NFS-e not found', 'NOT_FOUND', 404);
      if (nfse.status !== 'autorizada') return err('Apenas NFS-e autorizada pode ser cancelada', 'INVALID_STATUS');

      const { data: fr, error: fe } = await supabase.functions.invoke('fiscal-api', {
        body: { action: 'cancel_nfse', nfse_id: nfse.id, justificativa: body.justificativa, motivo: body.motivo },
      });
      if (fe || !fr?.success) return err('Erro ao cancelar: ' + await extractInvokeError(fe, fr), 'SEFIN_ERROR', 502);
      return ok(fr.data);
    }

    // ---------- POST /nfse-api/:id/consultar ----------
    if (method === 'POST' && sub.length === 2 && sub[1] === 'consultar') {
      if (!has('consultar')) return err('Permission denied', 'PERMISSION_DENIED', 403);
      const { data: fr, error: fe } = await supabase.functions.invoke('fiscal-api', {
        body: { action: 'consult_nfse', nfse_id: sub[0] },
      });
      if (fe || !fr?.success) return err('Erro ao consultar: ' + await extractInvokeError(fe, fr), 'SEFIN_ERROR', 502);
      return ok(fr.data);
    }

    // ---------- GET /nfse-api/:id/pdf ----------
    if (method === 'GET' && sub.length === 2 && (sub[1] === 'pdf' || sub[1] === 'danfse')) {
      if (!has('consultar')) return err('Permission denied', 'PERMISSION_DENIED', 403);
      const { data: nfse } = await supabase.from('nfse').select('id')
        .eq('id', sub[0]).eq('empresa_id', empresa_id).maybeSingle();
      if (!nfse) return err('NFS-e not found', 'NOT_FOUND', 404);
      const { data: fr, error: fe } = await supabase.functions.invoke('fiscal-api', {
        body: { action: 'danfse_nfse', nfse_id: sub[0] },
      });
      if (fe || !fr?.success) return err('Erro ao gerar DANFSe: ' + await extractInvokeError(fe, fr), 'SEFIN_ERROR', 502);

      if (url.searchParams.get('formato') === 'json') return ok(fr.data);
      const bin = Uint8Array.from(atob(fr.data.pdf_base64), c => c.charCodeAt(0));
      return new Response(bin, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="${fr.data.filename}"`,
        },
      });
    }

    // ---------- GET /nfse-api/:id/xml ----------
    if (method === 'GET' && sub.length === 2 && sub[1] === 'xml') {
      if (!has('consultar')) return err('Permission denied', 'PERMISSION_DENIED', 403);
      const { data: nfse } = await supabase.from('nfse').select('id')
        .eq('id', sub[0]).eq('empresa_id', empresa_id).maybeSingle();
      if (!nfse) return err('NFS-e not found', 'NOT_FOUND', 404);
      const { data: fr, error: fe } = await supabase.functions.invoke('fiscal-api', {
        body: { action: 'xml_nfse', nfse_id: sub[0] },
      });
      if (fe || !fr?.success) return err('Erro ao baixar XML: ' + await extractInvokeError(fe, fr), 'SEFIN_ERROR', 502);
      return new Response(fr.data.xml, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/xml; charset=utf-8',
          'Content-Disposition': `attachment; filename="${fr.data.chave || sub[0]}.xml"`,
        },
      });
    }

    return err('Endpoint não encontrado', 'NOT_FOUND', 404);
  } catch (e: any) {
    console.error('nfse-api error:', e);
    return err('Erro interno: ' + e.message, 'INTERNAL_ERROR', 500);
  }
});
