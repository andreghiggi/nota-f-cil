// MDF-e API (modelo 58 - Manifesto Eletrônico de Documentos Fiscais)
// Modal rodoviário (modal=1). Espelha a arquitetura de nfe-api.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

// Extrai detalhes reais do erro retornado por supabase.functions.invoke()
// Quando a função interna retorna status >=300, invoke() devolve FunctionsHttpError
// com `error.context` sendo a Response (cujo body precisa ser lido para ver o erro real).
async function extractInvokeError(err: any, fallbackData: any): Promise<string> {
  try {
    if (err?.context && typeof err.context.text === 'function') {
      const txt = await err.context.text();
      try {
        const j = JSON.parse(txt);
        // Estrutura típica do fiscal-api: { error, details: {...SEFAZ...} }
        const det = j.details || j.detalhes || {};
        const sefazMsg = det.xMotivo || det.mensagem || det.motivo || det.error || (det.raw && String(det.raw).substring(0, 400));
        const cStat = det.cStat || det.codigo || det.status_sefaz;
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

interface MDFePayload {
  external_id?: string;
  serie?: string;
  uf_ini: string;
  uf_fim: string;
  uf_percurso?: string[];
  data_inicio_viagem?: string; // ISO8601 com timezone -03:00
  veiculo: {
    placa: string;
    uf_placa?: string;
    tara: number;
    cap_kg?: number;
    cap_m3?: number;
    tipo_rodado: string;     // 01..06 (06=semi-reboque)
    tipo_carroceria: string; // 00..05 (02=fechada)
    renavam?: string;
    rntrc?: string;
  };
  condutor: { nome: string; cpf: string };
  documentos: Array<{
    tipo: 'nfe' | 'cte';
    chave: string;
    c_mun_descarga: string;
    x_mun_descarga: string;
  }>;
  totais: {
    valor_carga: number;
    peso_bruto: number;
    unidade_peso?: '01' | '02'; // 01=KG, 02=TON
  };
  produto_predominante?: string;
  cep_carregamento?: string;
  cep_descarregamento?: string;
  info_adicional?: string;
}

async function hashToken(token: string): Promise<string> {
  const enc = new TextEncoder().encode(token);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function err(msg: string, code: string, status = 400) {
  return new Response(JSON.stringify({ success: false, error: msg, code }),
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
    // parts[0] === 'mdfe-api'
    const sub = parts.slice(1);
    const method = req.method;

    // ---------- Health ----------
    if (method === 'GET' && sub.length === 0) {
      // protected list goes below; this is the public health when no auth header
      const hasAuth = req.headers.get('x-api-key') || req.headers.get('authorization');
      if (!hasAuth) {
        return new Response(JSON.stringify({ status: 'ok', service: 'mdfe-api' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // ---------- Auth ----------
    const apiKey = req.headers.get('x-api-key') || req.headers.get('authorization')?.replace('Bearer ', '');
    if (!apiKey) return err('API key required', 'AUTH_REQUIRED', 401);
    const tokenHash = await hashToken(apiKey);
    const { data: tokenData } = await supabase.rpc('validar_token_api', { p_token_hash: tokenHash });
    if (!tokenData || tokenData.length === 0) return err('Invalid or expired API key', 'AUTH_INVALID', 401);

    const { token_id, empresa_id, permissoes, ambiente } = tokenData[0];
    await supabase.from('tokens_api')
      .update({ ultimo_uso: new Date().toISOString(), ip_ultimo_uso: req.headers.get('x-forwarded-for') || 'unknown' })
      .eq('id', token_id);

    const has = (p: string) => permissoes.includes(p) || permissoes.includes('gerenciar');

    // ---------- POST /mdfe-api  → emitir ----------
    if (method === 'POST' && sub.length === 0) {
      if (!has('emitir_mdfe') && !has('emitir')) return err('Permission denied (emitir_mdfe)', 'PERMISSION_DENIED', 403);

      const payload: MDFePayload = await req.json();

      // Validações mínimas
      if (!payload.uf_ini || !payload.uf_fim) return err('uf_ini e uf_fim são obrigatórios', 'VALIDATION_ERROR');
      if (!payload.veiculo?.placa || !payload.veiculo?.tara || !payload.veiculo?.tipo_rodado || !payload.veiculo?.tipo_carroceria)
        return err('veiculo.placa, tara, tipo_rodado e tipo_carroceria são obrigatórios', 'VALIDATION_ERROR');
      if (!payload.condutor?.nome || !payload.condutor?.cpf) return err('condutor.nome e condutor.cpf são obrigatórios', 'VALIDATION_ERROR');
      if (!Array.isArray(payload.documentos) || payload.documentos.length === 0)
        return err('documentos[] é obrigatório (mín. 1 NF-e ou CT-e)', 'VALIDATION_ERROR');
      for (const d of payload.documentos) {
        if (!d.chave || d.chave.replace(/\D/g, '').length !== 44)
          return err('Cada documento precisa de chave de 44 dígitos', 'VALIDATION_ERROR');
        if (!d.c_mun_descarga || !d.x_mun_descarga)
          return err('Cada documento precisa de c_mun_descarga e x_mun_descarga', 'VALIDATION_ERROR');
      }
      if (!payload.totais || typeof payload.totais.valor_carga !== 'number' || typeof payload.totais.peso_bruto !== 'number')
        return err('totais.valor_carga e totais.peso_bruto são obrigatórios', 'VALIDATION_ERROR');

      const serie = payload.serie || '1';

      // Gera número via RPC
      const { data: numero, error: numError } = await supabase
        .rpc('gerar_numero_mdfe', { p_empresa_id: empresa_id, p_serie: serie });
      if (numError || !numero) return err('Erro ao gerar número', 'INTERNAL_ERROR', 500);

      // Insere registro
      const { data: mdfeRow, error: insError } = await supabase
        .from('mdfe')
        .insert({
          empresa_id,
          token_api_id: token_id,
          numero,
          serie,
          modal: 1,
          status: 'pendente',
          ambiente,
          uf_ini: payload.uf_ini,
          uf_fim: payload.uf_fim,
          uf_percurso: payload.uf_percurso || [],
          placa: payload.veiculo.placa.toUpperCase().replace(/[^A-Z0-9]/g, ''),
          uf_placa: payload.veiculo.uf_placa || payload.uf_ini,
          tara: payload.veiculo.tara,
          cap_kg: payload.veiculo.cap_kg ?? null,
          cap_m3: payload.veiculo.cap_m3 ?? null,
          rntrc: payload.veiculo.rntrc ?? null,
          condutor_nome: payload.condutor.nome,
          condutor_cpf: payload.condutor.cpf.replace(/\D/g, ''),
          valor_carga: payload.totais.valor_carga,
          peso_bruto: payload.totais.peso_bruto,
          unidade_peso: payload.totais.unidade_peso === '02' ? 2 : 1,
          qtd_documentos: payload.documentos.length,
          produto_predominante: payload.produto_predominante ?? null,
          cep_carregamento: payload.cep_carregamento ?? null,
          cep_descarregamento: payload.cep_descarregamento ?? null,
          info_adicional: payload.info_adicional ?? null,
          external_id: payload.external_id ?? null,
          payload_entrada: payload as any,
        })
        .select()
        .single();

      if (insError || !mdfeRow) return err('Erro ao criar MDF-e: ' + (insError?.message || ''), 'INTERNAL_ERROR', 500);

      // Documentos vinculados
      const docsToInsert = payload.documentos.map(d => ({
        mdfe_id: mdfeRow.id,
        tipo: d.tipo,
        chave: d.chave.replace(/\D/g, ''),
        c_mun_descarga: d.c_mun_descarga,
        x_mun_descarga: d.x_mun_descarga,
      }));
      await supabase.from('mdfe_documentos').insert(docsToInsert);

      // Fila como fallback
      await supabase.from('fila_processamento_mdfe').insert({ mdfe_id: mdfeRow.id, prioridade: 5 });

      await supabase.rpc('registrar_log', {
        p_empresa_id: empresa_id, p_nfce_id: mdfeRow.id, p_token_api_id: token_id,
        p_tipo: 'info', p_categoria: 'api',
        p_mensagem: `MDF-e ${numero} criado via API`,
        p_detalhes: { tipo: 'mdfe', external_id: payload.external_id },
        p_ip_origem: req.headers.get('x-forwarded-for'),
      });

      // Emissão síncrona via fiscal-api
      let emitResult: any = null;
      try {
        const { data: fiscalResult, error: fiscalError } = await supabase.functions.invoke('fiscal-api', {
          body: { action: 'emit_mdfe', mdfe_id: mdfeRow.id }
        });
        if (!fiscalError && fiscalResult?.success) {
          emitResult = fiscalResult.data;
          await supabase.from('fila_processamento_mdfe').delete().eq('mdfe_id', mdfeRow.id);
        } else {
          console.warn('Sync MDF-e emit failed, queue will retry:', fiscalError?.message || fiscalResult?.error);
        }
      } catch (e: any) {
        console.warn('Sync MDF-e emit exception:', e.message);
      }

      return new Response(
        JSON.stringify({
          success: true,
          data: emitResult || {
            id: mdfeRow.id, numero, serie, status: mdfeRow.status, ambiente,
            valor_carga: mdfeRow.valor_carga, created_at: mdfeRow.created_at
          }
        }),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ---------- GET /mdfe-api → listar ----------
    if (method === 'GET' && sub.length === 0) {
      if (!has('consultar')) return err('Permission denied', 'PERMISSION_DENIED', 403);
      const status = url.searchParams.get('status');
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
      const offset = parseInt(url.searchParams.get('offset') || '0');
      let q = supabase.from('mdfe')
        .select('id, numero, serie, modal, status, ambiente, data_emissao, uf_ini, uf_fim, placa, valor_carga, peso_bruto, qtd_documentos, chave_acesso, protocolo, external_id, created_at', { count: 'exact' })
        .eq('empresa_id', empresa_id)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
      if (status) q = q.eq('status', status);
      const { data, count } = await q;
      return new Response(JSON.stringify({ success: true, data, pagination: { total: count, limit, offset } }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ---------- GET /mdfe-api/:id ----------
    if (method === 'GET' && sub.length === 1) {
      if (!has('consultar')) return err('Permission denied', 'PERMISSION_DENIED', 403);
      const { data } = await supabase.from('mdfe')
        .select('*, mdfe_documentos(*), mdfe_eventos(*)')
        .eq('id', sub[0]).eq('empresa_id', empresa_id).maybeSingle();
      if (!data) return err('MDF-e not found', 'NOT_FOUND', 404);
      return new Response(JSON.stringify({ success: true, data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ---------- POST /mdfe-api/:id/encerrar ----------
    if (method === 'POST' && sub.length === 2 && sub[1] === 'encerrar') {
      if (!has('emitir_mdfe') && !has('emitir')) return err('Permission denied', 'PERMISSION_DENIED', 403);
      const body = await req.json().catch(() => ({}));
      const cMunDescarga = body.c_mun_descarga || body.codigo_municipio_descarga;
      const dtEnc = body.data_encerramento || new Date().toISOString().slice(0, 10);
      if (!cMunDescarga) return err('c_mun_descarga é obrigatório (município de descarga onde encerrou)', 'VALIDATION_ERROR');

      const { data: mdfe } = await supabase.from('mdfe').select('id, numero, status, chave_acesso')
        .eq('id', sub[0]).eq('empresa_id', empresa_id).maybeSingle();
      if (!mdfe) return err('MDF-e not found', 'NOT_FOUND', 404);
      if (mdfe.status !== 'autorizada') return err('Apenas MDF-e autorizado pode ser encerrado', 'INVALID_STATUS');

      const { data: evento } = await supabase.from('mdfe_eventos')
        .insert({ mdfe_id: mdfe.id, tipo_evento: 'encerramento', justificativa: `Encerrado em ${dtEnc} - mun ${cMunDescarga}` })
        .select('id').single();

      const { data: fr, error: fe } = await supabase.functions.invoke('fiscal-api', {
        body: { action: 'encerrar_mdfe', mdfe_id: mdfe.id, c_mun_descarga: cMunDescarga, data_encerramento: dtEnc }
      });
      if (fe || !fr?.success) return err('Erro ao encerrar na SEFAZ: ' + (fr?.error || fe?.message || 'desconhecido'), 'SEFAZ_ERROR', 502);

      return new Response(JSON.stringify({ success: true, data: { id: mdfe.id, evento_id: evento?.id, status: 'encerrado', ...fr.data } }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ---------- POST /mdfe-api/:id/cancelar ----------
    if (method === 'POST' && sub.length === 2 && sub[1] === 'cancelar') {
      if (!has('cancelar') && !has('emitir_mdfe')) return err('Permission denied', 'PERMISSION_DENIED', 403);
      const body = await req.json().catch(() => ({}));
      if (!body.justificativa || body.justificativa.length < 15) return err('Justificativa de no mínimo 15 caracteres', 'VALIDATION_ERROR');

      const { data: mdfe } = await supabase.from('mdfe').select('id, numero, status')
        .eq('id', sub[0]).eq('empresa_id', empresa_id).maybeSingle();
      if (!mdfe) return err('MDF-e not found', 'NOT_FOUND', 404);
      if (mdfe.status !== 'autorizada') return err('Apenas MDF-e autorizado pode ser cancelado', 'INVALID_STATUS');

      const { data: evento } = await supabase.from('mdfe_eventos')
        .insert({ mdfe_id: mdfe.id, tipo_evento: 'cancelamento', justificativa: body.justificativa })
        .select('id').single();

      const { data: fr, error: fe } = await supabase.functions.invoke('fiscal-api', {
        body: { action: 'cancel_mdfe', mdfe_id: mdfe.id }
      });
      if (fe || !fr?.success) return err('Erro ao cancelar na SEFAZ: ' + (fr?.error || fe?.message || 'desconhecido'), 'SEFAZ_ERROR', 502);

      await supabase.from('mdfe').update({ status: 'cancelada' }).eq('id', mdfe.id);
      return new Response(JSON.stringify({ success: true, data: { id: mdfe.id, evento_id: evento?.id, status: 'cancelada', ...fr.data } }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ---------- GET /mdfe-api/:id/xml ----------
    if (method === 'GET' && sub.length === 2 && sub[1] === 'xml') {
      if (!has('consultar')) return err('Permission denied', 'PERMISSION_DENIED', 403);
      const { data } = await supabase.from('mdfe').select('xml_envio, xml_retorno')
        .eq('id', sub[0]).eq('empresa_id', empresa_id).maybeSingle();
      if (!data) return err('MDF-e not found', 'NOT_FOUND', 404);
      return new Response(JSON.stringify({ success: true, data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return err('Endpoint não encontrado', 'NOT_FOUND', 404);
  } catch (e: any) {
    console.error('mdfe-api error:', e);
    return err('Erro interno: ' + e.message, 'INTERNAL_ERROR', 500);
  }
});
