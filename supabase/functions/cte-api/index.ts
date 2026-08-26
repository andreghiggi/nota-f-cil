// CT-e API (modelo 57) e CT-e OS (modelo 67)
// Espelha a arquitetura de mdfe-api / nfe-api.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

async function extractInvokeError(err: any, fallbackData: any): Promise<string> {
  try {
    if (err?.context && typeof err.context.text === 'function') {
      const txt = await err.context.text();
      try {
        const j = JSON.parse(txt);
        const det = j.details || j.detalhes || {};
        const sefazMsg = det.xMotivo || det.mensagem || det.motivo || det.error;
        const cStat = det.cStat || det.codigo;
        if (sefazMsg) return cStat ? `[${cStat}] ${sefazMsg}` : String(sefazMsg);
        return j.error || j.message || txt.substring(0, 500);
      } catch {
        return txt.substring(0, 500);
      }
    }
  } catch (_) { /* ignore */ }
  if (fallbackData?.error) return String(fallbackData.error);
  return err?.message || 'erro desconhecido';
}

async function hashToken(token: string): Promise<string> {
  const enc = new TextEncoder().encode(token);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

const TOKEN_TTL_MS = 60_000;
const tokenCache = new Map<string, { exp: number; data: any[] }>();
const ultimoUsoCache = new Map<string, number>();

async function validarTokenCached(supabase: any, tokenHash: string): Promise<any[] | null> {
  const hit = tokenCache.get(tokenHash);
  if (hit && hit.exp > Date.now()) return hit.data;
  const { data, error } = await supabase.rpc('validar_token_api', { p_token_hash: tokenHash });
  if (error || !data || data.length === 0) {
    tokenCache.delete(tokenHash);
    return null;
  }
  if (tokenCache.size > 500) tokenCache.clear();
  tokenCache.set(tokenHash, { exp: Date.now() + TOKEN_TTL_MS, data });
  return data;
}

function marcarUltimoUso(supabase: any, tokenId: string, ip: string) {
  const last = ultimoUsoCache.get(tokenId) ?? 0;
  if (Date.now() - last < TOKEN_TTL_MS) return;
  ultimoUsoCache.set(tokenId, Date.now());
  supabase.from('tokens_api')
    .update({ ultimo_uso: new Date().toISOString(), ip_ultimo_uso: ip })
    .eq('id', tokenId)
    .then(() => {}, (e: unknown) => console.warn('ultimo_uso update falhou:', e));
}

function err(msg: string, code: string, status = 400) {
  return new Response(JSON.stringify({ success: false, error: msg, code }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

function ok(data: any, status = 200) {
  return new Response(JSON.stringify({ success: true, data }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const url = new URL(req.url);
    const parts = url.pathname.split('/').filter(Boolean);
    const sub = parts.slice(1); // remove 'cte-api'
    const method = req.method;

    if (method === 'GET' && sub[0] === 'health') {
      return ok({ status: 'ok', service: 'cte-api', ts: new Date().toISOString() });
    }

    // ---------- Auth ----------
    const apiKey = req.headers.get('x-api-key') || req.headers.get('authorization')?.replace('Bearer ', '');
    if (!apiKey) return err('API key required', 'AUTH_REQUIRED', 401);
    const tokenData = await validarTokenCached(supabase, await hashToken(apiKey));
    if (!tokenData) return err('Invalid or expired API key', 'AUTH_INVALID', 401);

    const { token_id, empresa_id, ambiente } = tokenData[0];
    const permissoes: string[] = Array.isArray(tokenData[0].permissoes) ? [...tokenData[0].permissoes] : [];
    const aliasPairs: Array<[string, string[]]> = [
      ['cte.emitir', ['emitir_cte', 'emitir']],
      ['cte.consultar', ['consultar']],
      ['cte.cancelar', ['cancelar']],
      ['cteos.emitir', ['emitir_cte', 'emitir']],
    ];
    for (const [dotted, legacy] of aliasPairs) {
      if (permissoes.includes(dotted)) for (const p of legacy) if (!permissoes.includes(p)) permissoes.push(p);
    }
    marcarUltimoUso(supabase, token_id, req.headers.get('x-forwarded-for') || 'unknown');
    const has = (p: string) => permissoes.includes(p) || permissoes.includes('gerenciar');

    // ---------- POST /cte-api  → emitir ----------
    if (method === 'POST' && sub.length === 0) {
      if (!has('emitir_cte') && !has('emitir')) return err('Permission denied (emitir_cte)', 'PERMISSION_DENIED', 403);

      const payload = await req.json();
      const modelo = Number(payload.modelo ?? 57);
      if (![57, 67].includes(modelo)) return err('modelo deve ser 57 (CT-e) ou 67 (CT-e OS)', 'VALIDATION_ERROR');
      if (typeof payload.valor_total !== 'number' || payload.valor_total <= 0)
        return err('valor_total é obrigatório e deve ser maior que zero', 'VALIDATION_ERROR');
      if (!payload.uf_ini || !payload.uf_fim) return err('uf_ini e uf_fim são obrigatórios', 'VALIDATION_ERROR');
      if (modelo === 57 && (!payload.remetente || !payload.destinatario))
        return err('remetente e destinatario são obrigatórios para CT-e modelo 57', 'VALIDATION_ERROR');
      if (modelo === 67 && !payload.tomador_dados)
        return err('tomador_dados é obrigatório para CT-e OS', 'VALIDATION_ERROR');

      const tipoSerie = modelo === 67 ? 'cteos' : 'cte';
      const serie = String(payload.serie ?? '1');

      const { data: numero, error: numError } = await supabase
        .rpc('gerar_numero_cte', { p_empresa_id: empresa_id, p_tipo: tipoSerie, p_serie: serie });
      if (numError || !numero) {
        return err('Erro ao gerar número: ' + (numError?.message || 'série não configurada/ativa'), 'SERIE_ERROR', 400);
      }

      const imposto = payload.imposto || {};
      const { data: row, error: insError } = await supabase.from('cte').insert({
        empresa_id,
        token_api_id: token_id,
        modelo,
        numero,
        serie,
        status: 'pendente',
        ambiente,
        data_emissao: payload.data_emissao || new Date().toISOString(),
        tp_cte: Number(payload.tp_cte ?? 0),
        tp_serv: Number(payload.tp_serv ?? (modelo === 67 ? 6 : 0)),
        mod_tomador: payload.tomador ?? null,
        cfop: payload.cfop ?? null,
        natureza_operacao: payload.natureza_operacao ?? null,
        uf_ini: payload.uf_ini,
        uf_fim: payload.uf_fim,
        municipio_ini: payload.municipio_ini ?? null,
        municipio_fim: payload.municipio_fim ?? null,
        codigo_municipio_ini: payload.codigo_municipio_ini ?? null,
        codigo_municipio_fim: payload.codigo_municipio_fim ?? null,
        tomador_documento: payload.tomador_dados?.cnpj ?? payload.tomador_dados?.cpf ?? null,
        tomador_nome: payload.tomador_dados?.nome ?? null,
        remetente_documento: payload.remetente?.cnpj ?? payload.remetente?.cpf ?? null,
        remetente_nome: payload.remetente?.nome ?? null,
        destinatario_documento: payload.destinatario?.cnpj ?? payload.destinatario?.cpf ?? null,
        destinatario_nome: payload.destinatario?.nome ?? null,
        expedidor_documento: payload.expedidor?.cnpj ?? payload.expedidor?.cpf ?? null,
        expedidor_nome: payload.expedidor?.nome ?? null,
        recebedor_documento: payload.recebedor?.cnpj ?? payload.recebedor?.cpf ?? null,
        recebedor_nome: payload.recebedor?.nome ?? null,
        valor_total: payload.valor_total,
        valor_receber: payload.valor_receber ?? payload.valor_total,
        valor_carga: payload.valor_carga ?? null,
        produto_predominante: payload.produto_predominante ?? null,
        peso_bruto: payload.peso_bruto ?? null,
        cst_icms: imposto.cst ?? '90',
        base_calculo_icms: imposto.base_calculo ?? 0,
        aliquota_icms: imposto.aliquota ?? 0,
        valor_icms: imposto.valor ?? 0,
        rntrc: payload.rntrc ?? null,
        info_adicional: payload.info_adicional ?? null,
        external_id: payload.external_id ?? null,
        payload_entrada: payload,
      }).select().single();

      if (insError || !row) return err('Erro ao criar CT-e: ' + (insError?.message || ''), 'INTERNAL_ERROR', 500);

      const docs = Array.isArray(payload.documentos) ? payload.documentos : [];
      if (docs.length > 0) {
        await supabase.from('cte_documentos').insert(docs.map((d: any) => ({
          cte_id: row.id,
          tipo: d.tipo || 'nfe',
          chave: String(d.chave || '').replace(/\D/g, ''),
          numero: d.numero ?? null,
          serie: d.serie ?? null,
          valor: d.valor ?? null,
          peso: d.peso ?? null,
        })));
      }

      await supabase.from('fila_processamento_cte').insert({ cte_id: row.id, prioridade: 5 });

      let emitResult: any = null;
      try {
        const { data: fr, error: fe } = await supabase.functions.invoke('fiscal-api', {
          body: { action: 'emit_cte', cte_id: row.id }
        });
        if (!fe && fr?.success) {
          emitResult = fr.data;
          await supabase.from('fila_processamento_cte').delete().eq('cte_id', row.id);
        } else {
          console.warn('Sync CT-e emit failed, queue will retry:', fe?.message || fr?.error);
        }
      } catch (e: any) {
        console.warn('Sync CT-e emit exception:', e.message);
      }

      return ok(emitResult || {
        id: row.id, numero, serie, modelo, status: row.status, ambiente, created_at: row.created_at,
      }, 201);
    }

    // ---------- GET /cte-api → listar ----------
    if (method === 'GET' && sub.length === 0) {
      if (!has('consultar')) return err('Permission denied', 'PERMISSION_DENIED', 403);
      const status = url.searchParams.get('status');
      const modelo = url.searchParams.get('modelo');
      const dataInicio = url.searchParams.get('data_inicio');
      const dataFim = url.searchParams.get('data_fim');
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
      const offset = parseInt(url.searchParams.get('offset') || '0');
      let q = supabase.from('cte')
        .select('id, modelo, numero, serie, status, ambiente, data_emissao, uf_ini, uf_fim, tomador_nome, remetente_nome, destinatario_nome, valor_total, chave_acesso, protocolo, external_id, created_at', { count: 'exact' })
        .eq('empresa_id', empresa_id)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
      if (status) q = q.eq('status', status);
      if (modelo) q = q.eq('modelo', Number(modelo));
      if (dataInicio) q = q.gte('data_emissao', dataInicio);
      if (dataFim) q = q.lte('data_emissao', dataFim);
      const { data, count } = await q;
      return new Response(JSON.stringify({ success: true, data, pagination: { total: count, limit, offset } }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ---------- GET /cte-api/:id ----------
    if (method === 'GET' && sub.length === 1) {
      if (!has('consultar')) return err('Permission denied', 'PERMISSION_DENIED', 403);
      const { data } = await supabase.from('cte')
        .select('*, cte_documentos(*), cte_eventos(*)')
        .eq('id', sub[0]).eq('empresa_id', empresa_id).maybeSingle();
      if (!data) return err('CT-e not found', 'NOT_FOUND', 404);
      return ok(data);
    }

    // ---------- GET /cte-api/:id/xml ----------
    if (method === 'GET' && sub.length === 2 && sub[1] === 'xml') {
      if (!has('consultar')) return err('Permission denied', 'PERMISSION_DENIED', 403);
      const { data } = await supabase.from('cte').select('xml_envio, xml_retorno, chave_acesso')
        .eq('id', sub[0]).eq('empresa_id', empresa_id).maybeSingle();
      if (!data) return err('CT-e not found', 'NOT_FOUND', 404);
      return ok(data);
    }

    // ---------- GET /cte-api/:id/dacte ----------
    if (method === 'GET' && sub.length === 2 && sub[1] === 'dacte') {
      if (!has('consultar')) return err('Permission denied', 'PERMISSION_DENIED', 403);
      const { data: cte } = await supabase.from('cte').select('id, status')
        .eq('id', sub[0]).eq('empresa_id', empresa_id).maybeSingle();
      if (!cte) return err('CT-e not found', 'NOT_FOUND', 404);
      if (cte.status !== 'autorizada') return err('DACTE disponível apenas para CT-e autorizado', 'INVALID_STATUS');
      const { data: fr, error: fe } = await supabase.functions.invoke('fiscal-api', {
        body: { action: 'dacte_cte', cte_id: cte.id }
      });
      if (fe || !fr?.success) return err('Erro ao gerar DACTE: ' + await extractInvokeError(fe, fr), 'DACTE_ERROR', 502);
      return ok(fr.data);
    }

    // ---------- POST /cte-api/:id/cancelar ----------
    if (method === 'POST' && sub.length === 2 && sub[1] === 'cancelar') {
      if (!has('cancelar') && !has('emitir_cte')) return err('Permission denied', 'PERMISSION_DENIED', 403);
      const body = await req.json().catch(() => ({}));
      if (!body.justificativa || body.justificativa.length < 15)
        return err('Justificativa de no mínimo 15 caracteres', 'VALIDATION_ERROR');

      const { data: cte } = await supabase.from('cte').select('id, status')
        .eq('id', sub[0]).eq('empresa_id', empresa_id).maybeSingle();
      if (!cte) return err('CT-e not found', 'NOT_FOUND', 404);
      if (cte.status !== 'autorizada') return err('Apenas CT-e autorizado pode ser cancelado', 'INVALID_STATUS');

      const { data: evento } = await supabase.from('cte_eventos')
        .insert({ cte_id: cte.id, tipo_evento: 'cancelamento', justificativa: body.justificativa })
        .select('id').single();

      const { data: fr, error: fe } = await supabase.functions.invoke('fiscal-api', {
        body: { action: 'cancel_cte', cte_id: cte.id, justificativa: body.justificativa }
      });
      if (fe || !fr?.success) {
        const detalhe = await extractInvokeError(fe, fr);
        await supabase.from('cte_eventos').update({ codigo_retorno: 'ERRO', motivo_retorno: detalhe.substring(0, 500) })
          .eq('id', evento?.id);
        return err('Erro ao cancelar na SEFAZ: ' + detalhe, 'SEFAZ_ERROR', 502);
      }
      return ok({ id: cte.id, evento_id: evento?.id, status: 'cancelada', ...fr.data });
    }

    // ---------- POST /cte-api/:id/carta-correcao ----------
    if (method === 'POST' && sub.length === 2 && sub[1] === 'carta-correcao') {
      if (!has('emitir_cte') && !has('emitir')) return err('Permission denied', 'PERMISSION_DENIED', 403);
      const body = await req.json().catch(() => ({}));
      if (!Array.isArray(body.correcoes) || body.correcoes.length === 0)
        return err('correcoes[] é obrigatório (grupo, campo, valor)', 'VALIDATION_ERROR');

      const { data: cte } = await supabase.from('cte').select('id, status')
        .eq('id', sub[0]).eq('empresa_id', empresa_id).maybeSingle();
      if (!cte) return err('CT-e not found', 'NOT_FOUND', 404);
      if (cte.status !== 'autorizada') return err('Apenas CT-e autorizado aceita carta de correção', 'INVALID_STATUS');

      const { data: fr, error: fe } = await supabase.functions.invoke('fiscal-api', {
        body: { action: 'cce_cte', cte_id: cte.id, correcoes: body.correcoes, sequencia: body.sequencia || 1 }
      });
      if (fe || !fr?.success) return err('Erro na carta de correção: ' + await extractInvokeError(fe, fr), 'SEFAZ_ERROR', 502);
      return ok(fr.data);
    }

    // ---------- POST /cte-api/:id/reprocessar ----------
    if (method === 'POST' && sub.length === 2 && sub[1] === 'reprocessar') {
      if (!has('emitir_cte') && !has('emitir')) return err('Permission denied', 'PERMISSION_DENIED', 403);
      const { data: cte } = await supabase.from('cte').select('id, status')
        .eq('id', sub[0]).eq('empresa_id', empresa_id).maybeSingle();
      if (!cte) return err('CT-e not found', 'NOT_FOUND', 404);
      if (['autorizada', 'cancelada', 'inutilizada'].includes(cte.status))
        return err('CT-e já finalizado', 'INVALID_STATUS');
      const { data: fr, error: fe } = await supabase.functions.invoke('fiscal-api', {
        body: { action: 'emit_cte', cte_id: cte.id }
      });
      if (fe || !fr?.success) return err('Erro ao reprocessar: ' + await extractInvokeError(fe, fr), 'SEFAZ_ERROR', 502);
      return ok(fr.data);
    }

    return err('Endpoint não encontrado', 'NOT_FOUND', 404);
  } catch (e: any) {
    console.error('cte-api error:', e);
    return err(e.message || 'Erro interno', 'INTERNAL_ERROR', 500);
  }
});
