import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

interface NFCePayload {
  external_id?: string;
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
    cst_pis?: string;
    aliquota_pis?: number;
    cst_cofins?: string;
    aliquota_cofins?: number;
  }[];
  valor_desconto?: number;
  valor_frete?: number;
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
  // Handle CORS preflight
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

    // Hash the token to compare with database
    const tokenHash = await hashToken(apiKey);
    
    // Validate token using the database function
    const { data: tokenData, error: tokenError } = await supabase
      .rpc('validar_token_api', { p_token_hash: tokenHash });
    
    if (tokenError || !tokenData || tokenData.length === 0) {
      console.error('Token validation error:', tokenError);
      return new Response(
        JSON.stringify({ error: 'Invalid or expired API key', code: 'AUTH_INVALID' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { token_id, empresa_id, permissoes, ambiente } = tokenData[0];
    
    // Update last usage
    await supabase
      .from('tokens_api')
      .update({ 
        ultimo_uso: new Date().toISOString(),
        ip_ultimo_uso: req.headers.get('x-forwarded-for') || 'unknown'
      })
      .eq('id', token_id);

    // Route handling
    const method = req.method;
    
    // POST /nfce - Emit new NFC-e
    if (method === 'POST' && pathParts.length === 1 && pathParts[0] === 'nfce-api') {
      if (!permissoes.includes('emitir') && !permissoes.includes('emitir_nfce')) {
        return new Response(
          JSON.stringify({ error: 'Permission denied', code: 'PERMISSION_DENIED' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const payload: NFCePayload = await req.json();
      
      // Validate payload
      if (!payload.itens || payload.itens.length === 0) {
        return new Response(
          JSON.stringify({ error: 'Items are required', code: 'VALIDATION_ERROR' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get next number
      const { data: numeroData, error: numeroError } = await supabase
        .rpc('gerar_numero_nfce', { p_empresa_id: empresa_id });
      
      if (numeroError) {
        console.error('Error generating number:', numeroError);
        return new Response(
          JSON.stringify({ error: 'Failed to generate NFC-e number', code: 'INTERNAL_ERROR' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get empresa info
      const { data: empresaData } = await supabase
        .from('empresas')
        .select('serie_nfce, uf')
        .eq('id', empresa_id)
        .single();

      // Calculate totals
      let valorProdutos = 0;
      let valorIcms = 0;
      let valorPis = 0;
      let valorCofins = 0;

      for (const item of payload.itens) {
        const valorItem = item.quantidade * item.valor_unitario;
        valorProdutos += valorItem;
        valorIcms += valorItem * (item.aliquota_icms || 0) / 100;
        valorPis += valorItem * (item.aliquota_pis || 0) / 100;
        valorCofins += valorItem * (item.aliquota_cofins || 0) / 100;
      }

      const valorTotal = valorProdutos - (payload.valor_desconto || 0) + (payload.valor_frete || 0);

      // Create NFC-e record
      const { data: nfceData, error: nfceError } = await supabase
        .from('nfce')
        .insert({
          empresa_id,
          token_api_id: token_id,
          numero: numeroData,
          serie: empresaData?.serie_nfce || '001',
          status: 'pendente',
          ambiente,
          valor_total: valorTotal,
          valor_produtos: valorProdutos,
          valor_desconto: payload.valor_desconto || 0,
          valor_frete: payload.valor_frete || 0,
          valor_icms: valorIcms,
          valor_pis: valorPis,
          valor_cofins: valorCofins,
          payload_entrada: payload,
          external_id: payload.external_id
        })
        .select('id, numero, serie, status, created_at')
        .single();

      if (nfceError) {
        console.error('Error creating NFC-e:', nfceError);
        return new Response(
          JSON.stringify({ error: 'Failed to create NFC-e', code: 'INTERNAL_ERROR', details: nfceError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Insert items
      const itensToInsert = payload.itens.map((item, index) => ({
        nfce_id: nfceData.id,
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
        cst_pis: item.cst_pis,
        aliquota_pis: item.aliquota_pis || 0,
        valor_pis: (item.quantidade * item.valor_unitario) * (item.aliquota_pis || 0) / 100,
        cst_cofins: item.cst_cofins,
        aliquota_cofins: item.aliquota_cofins || 0,
        valor_cofins: (item.quantidade * item.valor_unitario) * (item.aliquota_cofins || 0) / 100
      }));

      await supabase.from('nfce_itens').insert(itensToInsert);

      // Add to processing queue as fallback
      await supabase.from('fila_processamento').insert({
        nfce_id: nfceData.id,
        prioridade: 5
      });

      // Log the action
      await supabase.rpc('registrar_log', {
        p_empresa_id: empresa_id,
        p_nfce_id: nfceData.id,
        p_token_api_id: token_id,
        p_tipo: 'info',
        p_categoria: 'api',
        p_mensagem: `NFC-e ${nfceData.numero} criada via API`,
        p_detalhes: { external_id: payload.external_id, valor_total: valorTotal },
        p_ip_origem: req.headers.get('x-forwarded-for')
      });

      // Emit synchronously via fiscal-api for instant processing
      let emitResult: any = null;
      try {
        const { data: fiscalResult, error: fiscalError } = await supabase.functions.invoke('fiscal-api', {
          body: { action: 'emit_nfce', nfce_id: nfceData.id }
        });

        if (!fiscalError && fiscalResult?.success) {
          emitResult = fiscalResult.data;
          // Remove from queue since it was processed successfully
          await supabase.from('fila_processamento').delete().eq('nfce_id', nfceData.id);
        } else {
          console.warn('Sync emit failed, queue will retry:', fiscalError?.message || fiscalResult?.error);
        }
      } catch (emitErr: any) {
        console.warn('Sync emit exception, queue will retry:', emitErr.message);
      }

      // Return the latest state
      const responseData = emitResult || {
        id: nfceData.id,
        numero: nfceData.numero,
        serie: nfceData.serie,
        status: nfceData.status,
        ambiente,
        valor_total: valorTotal,
        created_at: nfceData.created_at
      };

      return new Response(
        JSON.stringify({ success: true, data: responseData }),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // GET /nfce/:id - Get NFC-e status
    if (method === 'GET' && pathParts.length === 2 && pathParts[0] === 'nfce-api') {
      if (!permissoes.includes('consultar')) {
        return new Response(
          JSON.stringify({ error: 'Permission denied', code: 'PERMISSION_DENIED' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const nfceId = pathParts[1];
      
      const { data: nfceData, error: nfceError } = await supabase
        .from('nfce')
        .select(`
          id, numero, serie, chave_acesso, status, ambiente,
          data_emissao, valor_total, protocolo, codigo_retorno,
          motivo_retorno, data_autorizacao, qrcode_url, external_id,
          created_at, updated_at
        `)
        .eq('id', nfceId)
        .eq('empresa_id', empresa_id)
        .maybeSingle();

      if (nfceError) {
        console.error('Error fetching NFC-e:', nfceError);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch NFC-e', code: 'INTERNAL_ERROR' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!nfceData) {
        return new Response(
          JSON.stringify({ error: 'NFC-e not found', code: 'NOT_FOUND' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, data: nfceData }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // GET /nfce - List NFC-e with filters
    if (method === 'GET' && pathParts.length === 1 && pathParts[0] === 'nfce-api') {
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
        .from('nfce')
        .select(`
          id, numero, serie, chave_acesso, status, ambiente,
          data_emissao, valor_total, protocolo, external_id,
          created_at
        `, { count: 'exact' })
        .eq('empresa_id', empresa_id)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (status) {
        query = query.eq('status', status);
      }
      if (dataInicio) {
        query = query.gte('data_emissao', dataInicio);
      }
      if (dataFim) {
        query = query.lte('data_emissao', dataFim);
      }

      const { data: nfceList, error: listError, count } = await query;

      if (listError) {
        console.error('Error listing NFC-e:', listError);
        return new Response(
          JSON.stringify({ error: 'Failed to list NFC-e', code: 'INTERNAL_ERROR' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          data: nfceList,
          pagination: { total: count, limit, offset }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST /nfce/:id/cancelar - Cancel NFC-e
    if (method === 'POST' && pathParts.length === 3 && pathParts[0] === 'nfce-api' && pathParts[2] === 'cancelar') {
      if (!permissoes.includes('cancelar')) {
        return new Response(
          JSON.stringify({ error: 'Permission denied', code: 'PERMISSION_DENIED' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const nfceId = pathParts[1];
      const payload: CancelPayload = await req.json();

      if (!payload.justificativa || payload.justificativa.length < 15) {
        return new Response(
          JSON.stringify({ error: 'Justification must be at least 15 characters', code: 'VALIDATION_ERROR' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if NFC-e exists and is authorized
      const { data: nfceData, error: fetchError } = await supabase
        .from('nfce')
        .select('id, numero, status, protocolo')
        .eq('id', nfceId)
        .eq('empresa_id', empresa_id)
        .maybeSingle();

      if (fetchError || !nfceData) {
        return new Response(
          JSON.stringify({ error: 'NFC-e not found', code: 'NOT_FOUND' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (nfceData.status !== 'autorizada') {
        return new Response(
          JSON.stringify({ error: 'Only authorized NFC-e can be canceled', code: 'INVALID_STATUS' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Create cancellation event
      const { data: eventoData, error: eventoError } = await supabase
        .from('nfce_eventos')
        .insert({
          nfce_id: nfceId,
          tipo_evento: 'cancelamento',
          justificativa: payload.justificativa
        })
        .select('id')
        .single();

      if (eventoError) {
        console.error('Error creating event:', eventoError);
        return new Response(
          JSON.stringify({ error: 'Failed to create cancellation event', code: 'INTERNAL_ERROR' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update NFC-e status (in production, this would go to SEFAZ first)
      await supabase
        .from('nfce')
        .update({ status: 'cancelada' })
        .eq('id', nfceId);

      // Log the action
      await supabase.rpc('registrar_log', {
        p_empresa_id: empresa_id,
        p_nfce_id: nfceId,
        p_token_api_id: token_id,
        p_tipo: 'info',
        p_categoria: 'api',
        p_mensagem: `Cancelamento solicitado para NFC-e ${nfceData.numero}`,
        p_detalhes: { justificativa: payload.justificativa },
        p_ip_origem: req.headers.get('x-forwarded-for')
      });

      // Send webhook notification
      try {
        await supabase.functions.invoke('send-webhook', {
          body: { nfce_id: nfceId, evento: 'nfce.cancelada' }
        });
      } catch (webhookError) {
        console.error('Webhook dispatch error:', webhookError);
      }

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            id: nfceId,
            evento_id: eventoData.id,
            status: 'cancelada'
          }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST /nfce/:id/reprocessar - Reprocess failed NFC-e
    if (method === 'POST' && pathParts.length === 3 && pathParts[0] === 'nfce-api' && pathParts[2] === 'reprocessar') {
      if (!permissoes.includes('reprocessar')) {
        return new Response(
          JSON.stringify({ error: 'Permission denied', code: 'PERMISSION_DENIED' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const nfceId = pathParts[1];

      const { data: nfceData } = await supabase
        .from('nfce')
        .select('id, numero, status')
        .eq('id', nfceId)
        .eq('empresa_id', empresa_id)
        .maybeSingle();

      if (!nfceData) {
        return new Response(
          JSON.stringify({ error: 'NFC-e not found', code: 'NOT_FOUND' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!['rejeitada', 'pendente'].includes(nfceData.status)) {
        return new Response(
          JSON.stringify({ error: 'Only rejected or pending NFC-e can be reprocessed', code: 'INVALID_STATUS' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Reset status and add back to queue
      await supabase
        .from('nfce')
        .update({ status: 'pendente', tentativas: 0, erro_processamento: null })
        .eq('id', nfceId);

      await supabase
        .from('fila_processamento')
        .upsert({
          nfce_id: nfceId,
          tentativas: 0,
          proximo_processamento: new Date().toISOString(),
          erro_ultimo: null
        }, { onConflict: 'nfce_id' });

      // Log
      await supabase.rpc('registrar_log', {
        p_empresa_id: empresa_id,
        p_nfce_id: nfceId,
        p_token_api_id: token_id,
        p_tipo: 'info',
        p_categoria: 'api',
        p_mensagem: `Reprocessamento solicitado para NFC-e ${nfceData.numero}`,
        p_ip_origem: req.headers.get('x-forwarded-for')
      });

      return new Response(
        JSON.stringify({
          success: true,
          data: { id: nfceId, status: 'pendente' }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // GET /nfce/:id/xml - Get NFC-e XML
    if (method === 'GET' && pathParts.length === 3 && pathParts[0] === 'nfce-api' && pathParts[2] === 'xml') {
      if (!permissoes.includes('consultar')) {
        return new Response(
          JSON.stringify({ error: 'Permission denied', code: 'PERMISSION_DENIED' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const nfceId = pathParts[1];

      const { data: nfceData } = await supabase
        .from('nfce')
        .select('xml_envio, xml_retorno, status')
        .eq('id', nfceId)
        .eq('empresa_id', empresa_id)
        .maybeSingle();

      if (!nfceData) {
        return new Response(
          JSON.stringify({ error: 'NFC-e not found', code: 'NOT_FOUND' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            xml_envio: nfceData.xml_envio,
            xml_retorno: nfceData.xml_retorno
          }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Route not found
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
