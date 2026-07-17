import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

interface NFCePayload {
  external_id?: string;
  tp_emis?: number; // 1 = normal (default), 9 = contingência offline
  contingencia_justificativa?: string;
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
    // Reforma Tributária (IBS/CBS) — Grupo UB. Opcional: só entra no XML
    // se a empresa tiver o flag `enviar_ibs_cbs` ligado (fiscal-api aplica).
    cst_ibs_cbs?: string;
    cst_cbs?: string;
    cst_ibs?: string;
    c_class_trib?: string;
    vbc_ibs_cbs?: number;
    base_calculo_ibs?: number;
    base_calculo_cbs?: number;
    aliquota_ibs_uf?: number;
    aliquota_ibs_mun?: number;
    aliquota_ibs?: number;
    aliquota_cbs?: number;
    p_red_aliq_ibs_uf?: number;
    p_aliq_efet_ibs_uf?: number;
    p_red_aliq_ibs_mun?: number;
    p_aliq_efet_ibs_mun?: number;
    p_red_aliq_cbs?: number;
    p_aliq_efet_cbs?: number;
    valor_dif_ibs_uf?: number;
    valor_dif_ibs_mun?: number;
    valor_dif_cbs?: number;
    valor_dev_trib_ibs_uf?: number;
    valor_dev_trib_ibs_mun?: number;
    valor_dev_trib_cbs?: number;
    valor_ibs_uf?: number;
    valor_ibs_mun?: number;
    valor_cbs?: number;
    [k: string]: any;
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

    // Compatibilidade: alguns ERPs chamam POST /nfce-api com action/body de inutilização,
    // em vez de POST /nfce-api/inutilizar.
    if (method === 'POST' && pathParts.length === 1 && pathParts[0] === 'nfce-api') {
      const actionPayload = await req.clone().json().catch(() => ({}));
      const action = String(actionPayload.action || actionPayload.acao || '').toLowerCase();
      const looksLikeInutilizacao = action.includes('inutil') || (
        !Array.isArray(actionPayload.itens)
        && (actionPayload.numero_inicial || actionPayload.nIni || actionPayload.numeroInicial)
        && actionPayload.justificativa
      );

      if (looksLikeInutilizacao) {
        if (!permissoes.includes('cancelar') && !permissoes.includes('gerenciar')) {
          return new Response(
            JSON.stringify({ error: 'Permission denied', code: 'PERMISSION_DENIED' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const serie = actionPayload.serie ?? actionPayload.nSerie ?? 1;
        const numero_inicial = actionPayload.numero_inicial ?? actionPayload.numeroInicial ?? actionPayload.nIni;
        const numero_final = actionPayload.numero_final ?? actionPayload.numeroFinal ?? actionPayload.nFin ?? numero_inicial;
        const justificativa = (actionPayload.justificativa || '').toString().trim();

        if (!numero_inicial || !numero_final) {
          return new Response(
            JSON.stringify({ error: 'numero_inicial e numero_final são obrigatórios', code: 'VALIDATION_ERROR' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        if (justificativa.length < 15 || justificativa.length > 255) {
          return new Response(
            JSON.stringify({ error: 'Justificativa deve ter entre 15 e 255 caracteres', code: 'VALIDATION_ERROR' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        try {
          const { data: fiscalResult, error: fiscalError } = await supabase.functions.invoke('fiscal-api', {
            body: { action: 'inutilizar_nfce', empresa_id, serie, numero_inicial, numero_final, justificativa }
          });
          if (fiscalError || !fiscalResult?.success) {
            const det = (fiscalResult as any)?.details || {};
            return new Response(
              JSON.stringify({
                error: (fiscalResult as any)?.error || 'Erro ao inutilizar NFC-e na SEFAZ',
                code: 'SEFAZ_ERROR',
                cStat: det?.cStat ?? null,
                xMotivo: det?.xMotivo ?? null,
                sefaz: (fiscalResult as any)?.sefaz ?? null,
                details: det,
              }),
              { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          const d = fiscalResult.data || {};
          return new Response(
            JSON.stringify({
              success: true,
              data: {
                status: 'inutilizada',
                cStat: d.cStat ?? '102',
                xMotivo: d.xMotivo ?? null,
                protocolo: d.protocolo ?? d.nProt ?? null,
                serie: d.serie ?? serie,
                numero_inicial: d.numero_inicial ?? numero_inicial,
                numero_final: d.numero_final ?? numero_final,
                xml_retorno: d.xml_retorno ?? null,
              }
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } catch (e: any) {
          return new Response(
            JSON.stringify({ error: 'Erro interno ao inutilizar', code: 'INTERNAL_ERROR', details: e?.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }
    
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

      // ================ IDEMPOTÊNCIA =================
      // Evita double-submit do ERP (mesma transação reemitida em segundos).
      // Chave 1: external_id + empresa (janela 10 min)
      // Chave 2: card.NSU + card.tBand + empresa (janela 10 min) — proteção
      //          mesmo quando o ERP muda o external_id em cada retry.
      const janelaISO = new Date(Date.now() - 10 * 60 * 1000).toISOString();

      if (payload.external_id) {
        const { data: existente } = await supabase
          .from('nfce')
          .select('id, numero, serie, status, chave_acesso, protocolo, data_autorizacao, qrcode_url, valor_total, created_at')
          .eq('empresa_id', empresa_id)
          .eq('external_id', payload.external_id)
          .gte('created_at', janelaISO)
          .in('status', ['autorizada', 'pendente', 'processando'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existente) {
          return new Response(
            JSON.stringify({
              success: true,
              idempotent: true,
              message: 'NFC-e já emitida para este external_id nos últimos 10 minutos',
              data: existente,
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Idempotência por NSU de cartão (proteção contra retry que troca external_id)
      const pagamentos: any[] = Array.isArray((payload as any).pagamentos) ? (payload as any).pagamentos : [];
      const cartaoComNSU = pagamentos.find((p: any) => {
        const nsu = p?.card?.NSU ?? p?.card?.nsu ?? p?.cNSU;
        const tPag = String(p?.tPag ?? p?.forma_pagamento ?? '');
        return nsu && (tPag === '03' || tPag === '04' || tPag === '17');
      });
      if (cartaoComNSU) {
        const nsu = cartaoComNSU.card?.NSU ?? cartaoComNSU.card?.nsu ?? cartaoComNSU.cNSU;
        const { data: dupCard } = await supabase
          .from('nfce')
          .select('id, numero, serie, status, chave_acesso, protocolo, external_id, created_at')
          .eq('empresa_id', empresa_id)
          .gte('created_at', janelaISO)
          .in('status', ['autorizada', 'pendente', 'processando'])
          .filter('payload_entrada->pagamentos', 'cs', JSON.stringify([{ card: { NSU: String(nsu) } }]))
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (dupCard) {
          return new Response(
            JSON.stringify({
              success: true,
              idempotent: true,
              reason: 'card_nsu_match',
              message: 'NFC-e já emitida para este NSU de cartão nos últimos 10 minutos',
              data: dupCard,
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
      // ================ FIM IDEMPOTÊNCIA =================

      // Observação: não bloqueamos CFOP no nível da nossa API — a SEFAZ decide
      // se a combinação CFOP+CST/CSOSN é válida. Ex.: CFOP 5949 é aceito em NFC-e
      // quando combinado com CSOSN 900 (Outros) ou CST equivalente.

      // Get empresa info first (needed for serie)
      const { data: empresaData } = await supabase
        .from('empresas')
        .select('serie_nfce, uf')
        .eq('id', empresa_id)
        .single();

      // Resolve série: preferência = payload.serie > empresa.serie_nfce > primeira série NFC-e ATIVA cadastrada.
      // Nunca criamos série automaticamente — se não houver nenhuma ativa, erro.
      let serieNfce: string | null = (payload as any)?.serie ? String((payload as any).serie).trim() : null;
      if (!serieNfce && empresaData?.serie_nfce) serieNfce = String(empresaData.serie_nfce).trim();

      const { data: seriesAtivas } = await supabase
        .from('series_fiscais')
        .select('serie, numero_atual')
        .eq('empresa_id', empresa_id)
        .eq('tipo', 'nfce')
        .eq('ativo', true);

      const ativas = (seriesAtivas || []).map((s: any) => String(s.serie).trim());
      if (ativas.length === 0) {
        return new Response(
          JSON.stringify({ error: 'Nenhuma série NFC-e ativa cadastrada para esta empresa. Cadastre uma série antes de emitir.', code: 'SERIE_NAO_CONFIGURADA' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (!serieNfce || !ativas.includes(serieNfce)) {
        // Série pedida não está ativa: usa a primeira ativa cadastrada (sem criar novas).
        serieNfce = ativas[0];
      }

      // Get next number using serie
      const { data: numeroData, error: numeroError } = await supabase
        .rpc('gerar_numero_nfce', { p_empresa_id: empresa_id, p_serie: serieNfce });
      
      if (numeroError) {
        console.error('Error generating number:', numeroError);
        return new Response(
          JSON.stringify({ error: 'Failed to generate NFC-e number', code: 'INTERNAL_ERROR' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

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
          serie: serieNfce,
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
          external_id: payload.external_id,
          tp_emis: payload.tp_emis === 9 ? 9 : 1,
          contingencia_dh: payload.tp_emis === 9 ? new Date().toISOString() : null,
          contingencia_justificativa: payload.tp_emis === 9 ? (payload.contingencia_justificativa || 'Contingência offline NFC-e (tpEmis=9)') : null,
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

      // Add to processing queue as fallback (não usado em contingência)
      if (payload.tp_emis !== 9) {
        await supabase.from('fila_processamento').insert({
          nfce_id: nfceData.id,
          prioridade: 5
        });
      }

      // Log the action
      await supabase.rpc('registrar_log', {
        p_empresa_id: empresa_id,
        p_nfce_id: nfceData.id,
        p_token_api_id: token_id,
        p_tipo: 'info',
        p_categoria: 'api',
        p_mensagem: `NFC-e ${nfceData.numero} criada via API${payload.tp_emis === 9 ? ' (contingência offline)' : ''}`,
        p_detalhes: { external_id: payload.external_id, valor_total: valorTotal, tp_emis: payload.tp_emis || 1 },
        p_ip_origem: req.headers.get('x-forwarded-for')
      });

      // ================ CONTINGÊNCIA OFFLINE (tpEmis=9) =================
      // Não transmite online. Enfileira para retransmissão automática
      // quando a SEFAZ voltar (worker roda em background, prazo 24h).
      if (payload.tp_emis === 9) {
        await supabase.from('nfce').update({ status: 'contingencia' }).eq('id', nfceData.id);
        await supabase.from('nfce_contingencia_queue').insert({
          nfce_id: nfceData.id,
          empresa_id,
          emitida_em: new Date().toISOString(),
        });

        return new Response(
          JSON.stringify({
            success: true,
            data: {
              id: nfceData.id,
              numero: nfceData.numero,
              serie: nfceData.serie,
              status: 'contingencia',
              tp_emis: 9,
              ambiente,
              valor_total: valorTotal,
              mensagem: 'NFC-e registrada em contingência offline. Será retransmitida automaticamente quando a SEFAZ voltar (prazo 24h).',
              created_at: nfceData.created_at,
            }
          }),
          { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

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

    // ============================================================
    // POST /nfce-api/:id/abortar-online - Aborta tentativa online
    // Usado pelo ERP ANTES de imprimir contingência (tpEmis=9).
    // Marca a NFC-e como 'abortada' e faz callback tardio da SEFAZ
    // ser ignorado, prevenindo autorização duplicada.
    // ============================================================
    if (method === 'POST' && pathParts.length === 3 && pathParts[0] === 'nfce-api' && pathParts[2] === 'abortar-online') {
      if (!permissoes.includes('emitir') && !permissoes.includes('emitir_nfce') && !permissoes.includes('gerenciar')) {
        return new Response(
          JSON.stringify({ error: 'Permission denied', code: 'PERMISSION_DENIED' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const nfceId = pathParts[1];

      const { data: nfceData, error: fetchError } = await supabase
        .from('nfce')
        .select('id, numero, serie, status, protocolo, chave_acesso, external_id')
        .eq('id', nfceId)
        .eq('empresa_id', empresa_id)
        .maybeSingle();

      if (fetchError || !nfceData) {
        return new Response(
          JSON.stringify({ error: 'NFC-e não encontrada', code: 'NOT_FOUND' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Já autorizada → não pode abortar; ERP deve usar o XML autorizado
      if (nfceData.status === 'autorizada') {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'nota_ja_autorizada',
            code: 'ALREADY_AUTHORIZED',
            protocolo: nfceData.protocolo,
            chave_acesso: nfceData.chave_acesso,
            numero: nfceData.numero,
            serie: nfceData.serie,
            mensagem: 'SEFAZ já autorizou esta NFC-e. NÃO imprima contingência — utilize o XML autorizado.',
          }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Status finais não-autorizada → nada a abortar, resposta idempotente
      if (['rejeitada', 'cancelada', 'denegada', 'inutilizada', 'abortada'].includes(nfceData.status)) {
        return new Response(
          JSON.stringify({
            success: true,
            id: nfceId,
            status_anterior: nfceData.status,
            status_novo: nfceData.status,
            mensagem: 'Nada a abortar. Status já é final. Seguro imprimir contingência.',
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Em andamento (pendente/processando/contingencia) → aborta
      const statusAnterior = nfceData.status;
      const { error: updErr } = await supabase
        .from('nfce')
        .update({
          status: 'abortada',
          motivo_retorno: 'Abortada pelo ERP antes de imprimir contingência (tpEmis=9). Retorno tardio da SEFAZ será ignorado.',
        })
        .eq('id', nfceId)
        .in('status', ['pendente', 'processando', 'contingencia']);

      if (updErr) {
        console.error('abortar-online update error:', updErr);
        return new Response(
          JSON.stringify({ error: 'Falha ao abortar', code: 'INTERNAL_ERROR', details: updErr.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Remove da fila de processamento normal (não retransmite online)
      await supabase.from('fila_processamento').delete().eq('nfce_id', nfceId);

      await supabase.rpc('registrar_log', {
        p_empresa_id: empresa_id,
        p_nfce_id: nfceId,
        p_token_api_id: token_id,
        p_tipo: 'warning',
        p_categoria: 'api',
        p_mensagem: `NFC-e ${nfceData.numero} abortada pelo ERP para contingência offline`,
        p_detalhes: { status_anterior: statusAnterior, external_id: nfceData.external_id },
        p_ip_origem: req.headers.get('x-forwarded-for'),
      });

      return new Response(
        JSON.stringify({
          success: true,
          id: nfceId,
          status_anterior: statusAnterior,
          status_novo: 'abortada',
          mensagem: 'Retorno tardio da SEFAZ será ignorado. Seguro imprimir contingência (tpEmis=9).',
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

      // Cancel via fiscal API (SEFAZ)
      let cancelResult: any = null;
      try {
        const { data: fiscalResult, error: fiscalError } = await supabase.functions.invoke('fiscal-api', {
          body: { action: 'cancel_nfce', nfce_id: nfceId }
        });

        if (!fiscalError && fiscalResult?.success) {
          cancelResult = fiscalResult.data;
        } else {
          console.warn('Fiscal cancel failed:', fiscalError?.message || fiscalResult?.error);
          // If SEFAZ cancel fails, revert status
          await supabase.from('nfce').update({ status: 'autorizada' }).eq('id', nfceId);
          
          return new Response(
            JSON.stringify({ 
              error: 'Erro ao cancelar na SEFAZ', 
              code: 'SEFAZ_ERROR',
              details: fiscalResult?.error || fiscalError?.message 
            }),
            { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } catch (cancelErr: any) {
        console.error('Cancel exception:', cancelErr.message);
        // Revert status on exception
        await supabase.from('nfce').update({ status: 'autorizada' }).eq('id', nfceId);
        
        return new Response(
          JSON.stringify({ error: 'Erro interno ao cancelar', code: 'INTERNAL_ERROR' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update NFC-e status to cancelled
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

    // POST /nfce-api/inutilizar - Inutilização de numeração NFC-e (modelo 65)
    if (method === 'POST' && pathParts.length === 2 && pathParts[0] === 'nfce-api' && pathParts[1] === 'inutilizar') {
      if (!permissoes.includes('cancelar') && !permissoes.includes('gerenciar')) {
        return new Response(
          JSON.stringify({ error: 'Permission denied', code: 'PERMISSION_DENIED' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const inutPayload = await req.json().catch(() => ({}));
      const serie = inutPayload.serie ?? inutPayload.nSerie ?? 1;
      const numero_inicial = inutPayload.numero_inicial ?? inutPayload.nIni;
      const numero_final = inutPayload.numero_final ?? inutPayload.nFin ?? numero_inicial;
      const justificativa = (inutPayload.justificativa || '').toString().trim();

      if (!numero_inicial || !numero_final) {
        return new Response(
          JSON.stringify({ error: 'numero_inicial e numero_final são obrigatórios', code: 'VALIDATION_ERROR' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (justificativa.length < 15 || justificativa.length > 255) {
        return new Response(
          JSON.stringify({ error: 'Justificativa deve ter entre 15 e 255 caracteres', code: 'VALIDATION_ERROR' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      try {
        const { data: fiscalResult, error: fiscalError } = await supabase.functions.invoke('fiscal-api', {
          body: { action: 'inutilizar_nfce', empresa_id, serie, numero_inicial, numero_final, justificativa }
        });
        if (fiscalError || !fiscalResult?.success) {
          const det = (fiscalResult as any)?.details || {};
          return new Response(
            JSON.stringify({
              error: (fiscalResult as any)?.error || 'Erro ao inutilizar NFC-e na SEFAZ',
              code: 'SEFAZ_ERROR',
              cStat: det?.cStat ?? null,
              xMotivo: det?.xMotivo ?? null,
              sefaz: (fiscalResult as any)?.sefaz ?? null,
              details: det,
            }),
            { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        const d = fiscalResult.data || {};
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              status: 'inutilizada',
              cStat: d.cStat ?? '102',
              xMotivo: d.xMotivo ?? null,
              protocolo: d.protocolo ?? d.nProt ?? null,
              serie: d.serie ?? serie,
              numero_inicial: d.numero_inicial ?? numero_inicial,
              numero_final: d.numero_final ?? numero_final,
              xml_retorno: d.xml_retorno ?? null,
            }
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (e: any) {
        return new Response(
          JSON.stringify({ error: 'Erro interno ao inutilizar', code: 'INTERNAL_ERROR', details: e?.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
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
