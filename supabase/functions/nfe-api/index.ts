import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

interface NFePayload {
  external_id?: string;
  natureza_operacao?: string;
  finalidade?: string;
  modalidade_frete?: string;
  destinatario?: {
    cpf_cnpj?: string;
    nome?: string;
    ie?: string;
    email?: string;
    logradouro?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    municipio?: string;
    codigo_municipio?: string;
    uf?: string;
    cep?: string;
    telefone?: string;
  };
  itens: {
    codigo: string;
    descricao: string;
    ncm?: string;
    cfop: string;
    unidade: string;
    quantidade: number;
    valor_unitario: number;
    cst_icms?: string;
    csosn?: string;
    aliquota_icms?: number;
    cst_ipi?: string;
    aliquota_ipi?: number;
    cst_pis?: string;
    aliquota_pis?: number;
    cst_cofins?: string;
    aliquota_cofins?: number;
  }[];
  valor_desconto?: number;
  valor_frete?: number;
  valor_seguro?: number;
  valor_outras_despesas?: number;
  observacoes?: string;
}

interface CancelPayload {
  justificativa: string;
}

async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);

    // Validate API Key
    const apiKey = req.headers.get('x-api-key') || req.headers.get('authorization')?.replace('Bearer ', '');

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'API key required', code: 'AUTH_REQUIRED' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tokenHash = await hashToken(apiKey);
    const { data: tokenData, error: tokenError } = await supabase
      .rpc('validar_token_api', { p_token_hash: tokenHash });

    if (tokenError || !tokenData || tokenData.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired API key', code: 'AUTH_INVALID' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { token_id, empresa_id, permissoes, ambiente } = tokenData[0];

    await supabase
      .from('tokens_api')
      .update({ ultimo_uso: new Date().toISOString(), ip_ultimo_uso: req.headers.get('x-forwarded-for') || 'unknown' })
      .eq('id', token_id);

    const method = req.method;

    // POST /nfe-api - Emit new NF-e
    if (method === 'POST' && pathParts.length === 1 && pathParts[0] === 'nfe-api') {
      if (!permissoes.includes('emitir') && !permissoes.includes('emitir_nfe')) {
        return new Response(
          JSON.stringify({ error: 'Permission denied', code: 'PERMISSION_DENIED' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const payload: NFePayload = await req.json();

      if (!payload.itens || payload.itens.length === 0) {
        return new Response(
          JSON.stringify({ error: 'Items are required', code: 'VALIDATION_ERROR' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: empresaData } = await supabase
        .from('empresas')
        .select('serie_nfe, uf')
        .eq('id', empresa_id)
        .single();

      const serieNfe = empresaData?.serie_nfe || '001';

      const { data: numeroData, error: numeroError } = await supabase
        .rpc('gerar_numero_nfe', { p_empresa_id: empresa_id, p_serie: serieNfe });

      if (numeroError) {
        console.error('gerar_numero_nfe error:', JSON.stringify(numeroError));
        return new Response(
          JSON.stringify({ error: 'Failed to generate NF-e number', code: 'INTERNAL_ERROR', details: numeroError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: empresaData } = await supabase
        .from('empresas')
        .select('serie_nfe, uf')
        .eq('id', empresa_id)
        .single();

      let valorProdutos = 0, valorIcms = 0, valorIpi = 0, valorPis = 0, valorCofins = 0;
      for (const item of payload.itens) {
        const valorItem = item.quantidade * item.valor_unitario;
        valorProdutos += valorItem;
        valorIcms += valorItem * (item.aliquota_icms || 0) / 100;
        valorIpi += valorItem * (item.aliquota_ipi || 0) / 100;
        valorPis += valorItem * (item.aliquota_pis || 0) / 100;
        valorCofins += valorItem * (item.aliquota_cofins || 0) / 100;
      }

      const valorTotal = valorProdutos - (payload.valor_desconto || 0) + (payload.valor_frete || 0)
        + (payload.valor_seguro || 0) + (payload.valor_outras_despesas || 0) + valorIpi;

      const dest = payload.destinatario || {};

      const { data: nfeData, error: nfeError } = await supabase
        .from('nfe')
        .insert({
          empresa_id,
          token_api_id: token_id,
          numero: numeroData,
          serie: empresaData?.serie_nfe || '001',
          status: 'pendente',
          ambiente,
          valor_total: valorTotal,
          valor_produtos: valorProdutos,
          valor_desconto: payload.valor_desconto || 0,
          valor_frete: payload.valor_frete || 0,
          valor_seguro: payload.valor_seguro || 0,
          valor_outras_despesas: payload.valor_outras_despesas || 0,
          valor_icms: valorIcms,
          valor_ipi: valorIpi,
          valor_pis: valorPis,
          valor_cofins: valorCofins,
          payload_entrada: payload,
          external_id: payload.external_id,
          natureza_operacao: payload.natureza_operacao || 'VENDA',
          finalidade: payload.finalidade || '1',
          modalidade_frete: payload.modalidade_frete || '9',
          dest_cpf_cnpj: dest.cpf_cnpj,
          dest_nome: dest.nome,
          dest_ie: dest.ie,
          dest_email: dest.email,
          dest_logradouro: dest.logradouro,
          dest_numero: dest.numero,
          dest_complemento: dest.complemento,
          dest_bairro: dest.bairro,
          dest_municipio: dest.municipio,
          dest_codigo_municipio: dest.codigo_municipio,
          dest_uf: dest.uf,
          dest_cep: dest.cep,
          dest_telefone: dest.telefone,
        })
        .select('id, numero, serie, status, created_at')
        .single();

      if (nfeError) {
        return new Response(
          JSON.stringify({ error: 'Failed to create NF-e', code: 'INTERNAL_ERROR', details: nfeError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Insert items
      const itensToInsert = payload.itens.map((item, index) => ({
        nfe_id: nfeData.id,
        numero_item: index + 1,
        codigo_produto: item.codigo,
        descricao: item.descricao,
        ncm: item.ncm,
        cfop: item.cfop,
        unidade: item.unidade,
        quantidade: item.quantidade,
        valor_unitario: item.valor_unitario,
        valor_total: item.quantidade * item.valor_unitario,
        cst_icms: item.cst_icms,
        csosn: item.csosn,
        aliquota_icms: item.aliquota_icms || 0,
        valor_icms: (item.quantidade * item.valor_unitario) * (item.aliquota_icms || 0) / 100,
        cst_ipi: item.cst_ipi,
        aliquota_ipi: item.aliquota_ipi || 0,
        valor_ipi: (item.quantidade * item.valor_unitario) * (item.aliquota_ipi || 0) / 100,
        cst_pis: item.cst_pis,
        aliquota_pis: item.aliquota_pis || 0,
        valor_pis: (item.quantidade * item.valor_unitario) * (item.aliquota_pis || 0) / 100,
        cst_cofins: item.cst_cofins,
        aliquota_cofins: item.aliquota_cofins || 0,
        valor_cofins: (item.quantidade * item.valor_unitario) * (item.aliquota_cofins || 0) / 100,
      }));

      await supabase.from('nfe_itens').insert(itensToInsert);

      // Add to processing queue as fallback
      await supabase.from('fila_processamento_nfe').insert({
        nfe_id: nfeData.id,
        prioridade: 5
      });

      // Log
      await supabase.rpc('registrar_log', {
        p_empresa_id: empresa_id,
        p_nfce_id: nfeData.id, // reusing the param name
        p_token_api_id: token_id,
        p_tipo: 'info',
        p_categoria: 'api',
        p_mensagem: `NF-e ${nfeData.numero} criada via API`,
        p_detalhes: { external_id: payload.external_id, valor_total: valorTotal, tipo: 'nfe' },
        p_ip_origem: req.headers.get('x-forwarded-for')
      });

      // Emit synchronously via fiscal-api
      let emitResult: any = null;
      try {
        const { data: fiscalResult, error: fiscalError } = await supabase.functions.invoke('fiscal-api', {
          body: { action: 'emit_nfe', nfe_id: nfeData.id }
        });

        if (!fiscalError && fiscalResult?.success) {
          emitResult = fiscalResult.data;
          await supabase.from('fila_processamento_nfe').delete().eq('nfe_id', nfeData.id);
        } else {
          console.warn('Sync emit NF-e failed, queue will retry:', fiscalError?.message || fiscalResult?.error);
        }
      } catch (emitErr: any) {
        console.warn('Sync emit NF-e exception, queue will retry:', emitErr.message);
      }

      const responseData = emitResult || {
        id: nfeData.id,
        numero: nfeData.numero,
        serie: nfeData.serie,
        status: nfeData.status,
        ambiente,
        valor_total: valorTotal,
        created_at: nfeData.created_at
      };

      return new Response(
        JSON.stringify({ success: true, data: responseData }),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // GET /nfe-api/:id - Get NF-e status
    if (method === 'GET' && pathParts.length === 2 && pathParts[0] === 'nfe-api') {
      if (!permissoes.includes('consultar')) {
        return new Response(
          JSON.stringify({ error: 'Permission denied', code: 'PERMISSION_DENIED' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const nfeId = pathParts[1];
      const { data: nfeData } = await supabase
        .from('nfe')
        .select(`
          id, numero, serie, chave_acesso, status, ambiente,
          data_emissao, valor_total, protocolo, codigo_retorno,
          motivo_retorno, data_autorizacao, external_id,
          natureza_operacao, dest_nome, dest_cpf_cnpj,
          created_at, updated_at
        `)
        .eq('id', nfeId)
        .eq('empresa_id', empresa_id)
        .maybeSingle();

      if (!nfeData) {
        return new Response(
          JSON.stringify({ error: 'NF-e not found', code: 'NOT_FOUND' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, data: nfeData }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // GET /nfe-api - List NF-e
    if (method === 'GET' && pathParts.length === 1 && pathParts[0] === 'nfe-api') {
      if (!permissoes.includes('consultar')) {
        return new Response(
          JSON.stringify({ error: 'Permission denied', code: 'PERMISSION_DENIED' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const status = url.searchParams.get('status');
      const dataInicio = url.searchParams.get('data_inicio');
      const dataFim = url.searchParams.get('data_fim');
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
      const offset = parseInt(url.searchParams.get('offset') || '0');

      let query = supabase
        .from('nfe')
        .select(`
          id, numero, serie, chave_acesso, status, ambiente,
          data_emissao, valor_total, protocolo, external_id,
          dest_nome, natureza_operacao, created_at
        `, { count: 'exact' })
        .eq('empresa_id', empresa_id)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (status) query = query.eq('status', status);
      if (dataInicio) query = query.gte('data_emissao', dataInicio);
      if (dataFim) query = query.lte('data_emissao', dataFim);

      const { data: nfeList, error: listError, count } = await query;

      if (listError) {
        return new Response(
          JSON.stringify({ error: 'Failed to list NF-e', code: 'INTERNAL_ERROR' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, data: nfeList, pagination: { total: count, limit, offset } }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST /nfe-api/:id/cancelar
    if (method === 'POST' && pathParts.length === 3 && pathParts[0] === 'nfe-api' && pathParts[2] === 'cancelar') {
      if (!permissoes.includes('cancelar')) {
        return new Response(
          JSON.stringify({ error: 'Permission denied', code: 'PERMISSION_DENIED' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const nfeId = pathParts[1];
      const payload: CancelPayload = await req.json();

      if (!payload.justificativa || payload.justificativa.length < 15) {
        return new Response(
          JSON.stringify({ error: 'Justification must be at least 15 characters', code: 'VALIDATION_ERROR' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: nfeData } = await supabase
        .from('nfe')
        .select('id, numero, status, protocolo')
        .eq('id', nfeId)
        .eq('empresa_id', empresa_id)
        .maybeSingle();

      if (!nfeData) {
        return new Response(
          JSON.stringify({ error: 'NF-e not found', code: 'NOT_FOUND' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (nfeData.status !== 'autorizada') {
        return new Response(
          JSON.stringify({ error: 'Only authorized NF-e can be canceled', code: 'INVALID_STATUS' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: eventoData } = await supabase
        .from('nfe_eventos')
        .insert({ nfe_id: nfeId, tipo_evento: 'cancelamento', justificativa: payload.justificativa })
        .select('id')
        .single();

      await supabase.from('nfe').update({ status: 'cancelada' }).eq('id', nfeId);

      await supabase.rpc('registrar_log', {
        p_empresa_id: empresa_id,
        p_nfce_id: nfeId,
        p_token_api_id: token_id,
        p_tipo: 'info',
        p_categoria: 'api',
        p_mensagem: `Cancelamento solicitado para NF-e ${nfeData.numero}`,
        p_detalhes: { justificativa: payload.justificativa, tipo: 'nfe' },
        p_ip_origem: req.headers.get('x-forwarded-for')
      });

      return new Response(
        JSON.stringify({ success: true, data: { id: nfeId, evento_id: eventoData?.id, status: 'cancelada' } }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST /nfe-api/:id/reprocessar
    if (method === 'POST' && pathParts.length === 3 && pathParts[0] === 'nfe-api' && pathParts[2] === 'reprocessar') {
      if (!permissoes.includes('reprocessar')) {
        return new Response(
          JSON.stringify({ error: 'Permission denied', code: 'PERMISSION_DENIED' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const nfeId = pathParts[1];
      const { data: nfeData } = await supabase
        .from('nfe')
        .select('id, numero, status')
        .eq('id', nfeId)
        .eq('empresa_id', empresa_id)
        .maybeSingle();

      if (!nfeData) {
        return new Response(
          JSON.stringify({ error: 'NF-e not found', code: 'NOT_FOUND' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!['rejeitada', 'pendente'].includes(nfeData.status)) {
        return new Response(
          JSON.stringify({ error: 'Only rejected or pending NF-e can be reprocessed', code: 'INVALID_STATUS' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      await supabase.from('nfe').update({ status: 'pendente', tentativas: 0, erro_processamento: null }).eq('id', nfeId);
      await supabase.from('fila_processamento_nfe').upsert(
        { nfe_id: nfeId, tentativas: 0, proximo_processamento: new Date().toISOString(), erro_ultimo: null },
        { onConflict: 'nfe_id' }
      );

      await supabase.rpc('registrar_log', {
        p_empresa_id: empresa_id,
        p_nfce_id: nfeId,
        p_token_api_id: token_id,
        p_tipo: 'info',
        p_categoria: 'api',
        p_mensagem: `Reprocessamento solicitado para NF-e ${nfeData.numero}`,
        p_ip_origem: req.headers.get('x-forwarded-for')
      });

      return new Response(
        JSON.stringify({ success: true, data: { id: nfeId, status: 'pendente' } }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // GET /nfe-api/:id/xml
    if (method === 'GET' && pathParts.length === 3 && pathParts[0] === 'nfe-api' && pathParts[2] === 'xml') {
      if (!permissoes.includes('consultar')) {
        return new Response(
          JSON.stringify({ error: 'Permission denied', code: 'PERMISSION_DENIED' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const nfeId = pathParts[1];
      const { data: nfeData } = await supabase
        .from('nfe')
        .select('xml_envio, xml_retorno, status')
        .eq('id', nfeId)
        .eq('empresa_id', empresa_id)
        .maybeSingle();

      if (!nfeData) {
        return new Response(
          JSON.stringify({ error: 'NF-e not found', code: 'NOT_FOUND' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, data: { xml_envio: nfeData.xml_envio, xml_retorno: nfeData.xml_retorno } }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Endpoint not found', code: 'NOT_FOUND' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unhandled error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', code: 'INTERNAL_ERROR' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
