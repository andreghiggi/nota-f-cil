import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FISCAL_API_BASE_URL = 'https://api2.agilizeerp.com.br';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { action, empresa_id, nfce_id } = await req.json();

    // ========================================================================
    // ACTION: register_empresa - Register company on fiscal API
    // ========================================================================
    if (action === 'register_empresa') {
      // Get empresa data
      const { data: empresa, error: empresaError } = await supabase
        .from('empresas')
        .select('*')
        .eq('id', empresa_id)
        .single();

      if (empresaError || !empresa) {
        return new Response(
          JSON.stringify({ error: 'Empresa não encontrada', details: empresaError?.message }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get certificate data if exists
      const { data: certificado } = await supabase
        .from('certificados_digitais')
        .select('*')
        .eq('empresa_id', empresa_id)
        .single();

      // Download certificate file from storage if available
      let certificadoBase64: string | null = null;
      if (certificado?.arquivo_path) {
        const { data: fileData, error: fileError } = await supabase.storage
          .from('certificados')
          .download(certificado.arquivo_path);
        
        if (!fileError && fileData) {
          const arrayBuffer = await fileData.arrayBuffer();
          const bytes = new Uint8Array(arrayBuffer);
          let binary = '';
          for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          certificadoBase64 = btoa(binary);
          console.log(`📎 Certificate file loaded (${bytes.length} bytes)`);
        } else {
          console.warn(`⚠️ Could not download certificate: ${fileError?.message}`);
        }
      }

      // Use existing api_key_fiscal or generate a new one
      const apiKeyFiscal = empresa.api_key_fiscal || crypto.randomUUID();

      // Map regime_tributario to CRT code
      const crtMap: Record<string, number> = {
        'simples_nacional': 1,
        'lucro_presumido': 3,
        'lucro_real': 3,
      };

      // Build payload in the format expected by the PHP API
      const registerBody = {
        api_key: apiKeyFiscal,

        sped_config: {
          tpAmb: empresa.ambiente === 'producao' ? 1 : 2,
          razaosocial: empresa.razao_social,
          cnpj: empresa.cnpj,
          siglaUF: empresa.uf,
          CSC: empresa.csc_token || '',
          CSCid: empresa.csc_id || '',
        },

        certificado: {
          pfx_base64: certificadoBase64 || '',
          senha: certificado?.senha_hash || '',
        },

        emitente: {
          IE: (empresa.inscricao_estadual || '').replace(/\D/g, ''),
          CRT: crtMap[empresa.regime_tributario] || 1,
          CNAE: empresa.cnae_principal || '',
          xNome: empresa.razao_social,
          xFant: empresa.nome_fantasia || empresa.razao_social,
          ender: {
            xLgr: empresa.logradouro || '',
            nro: empresa.numero || '',
            xBairro: empresa.bairro || '',
            cMun: empresa.codigo_municipio || '',
            xMun: empresa.municipio,
            UF: empresa.uf,
            CEP: (empresa.cep || '').replace(/\D/g, ''),
          },
        },
      };

      console.log(`📡 Registering empresa ${empresa.cnpj} on fiscal API...`);
      console.log(`   Has certificate: ${!!certificadoBase64}`);
      console.log(`   Has CSC: ${!!empresa.csc_token}`);
      console.log(`   Ambiente: ${registerBody.sped_config.tpAmb} (${empresa.ambiente})`);
      console.log(`   CRT: ${registerBody.emitente.CRT}`);
      
      const response = await fetch(`${FISCAL_API_BASE_URL}/empresa/cadastrar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registerBody),
      });
      
      const responseText = await response.text();
      console.log(`   Response status: ${response.status}`);
      console.log(`   Response body: ${responseText}`);

      let responseData: any;
      try {
        responseData = JSON.parse(responseText);
      } catch {
        responseData = { raw: responseText };
      }

      if (!response.ok) {
        return new Response(
          JSON.stringify({ error: 'Erro ao registrar na API fiscal', details: responseData }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Store the fiscal API key in our database if new
      if (!empresa.api_key_fiscal) {
        const { error: updateError } = await supabase
          .from('empresas')
          .update({ api_key_fiscal: apiKeyFiscal })
          .eq('id', empresa_id);

        if (updateError) {
          return new Response(
            JSON.stringify({ error: 'Erro ao salvar API key fiscal', details: updateError.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      console.log(`✅ Empresa ${empresa.cnpj} registered successfully on fiscal API`);

      return new Response(
        JSON.stringify({ success: true, data: responseData }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========================================================================
    // ACTION: emit_nfce - Emit NFC-e via fiscal API
    // ========================================================================
    if (action === 'emit_nfce') {
      if (!nfce_id) {
        return new Response(
          JSON.stringify({ error: 'nfce_id é obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get NFC-e data with items
      const { data: nfce, error: nfceError } = await supabase
        .from('nfce')
        .select(`
          *,
          nfce_itens(*)
        `)
        .eq('id', nfce_id)
        .single();

      if (nfceError || !nfce) {
        return new Response(
          JSON.stringify({ error: 'NFC-e não encontrada', details: nfceError?.message }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get empresa with fiscal API key
      const { data: empresa, error: empresaError } = await supabase
        .from('empresas')
        .select('*')
        .eq('id', nfce.empresa_id)
        .single();

      if (empresaError || !empresa) {
        return new Response(
          JSON.stringify({ error: 'Empresa não encontrada' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!empresa.api_key_fiscal) {
        return new Response(
          JSON.stringify({ error: 'Empresa não registrada na API fiscal. Registre primeiro.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update status to processing
      await supabase
        .from('nfce')
        .update({ status: 'processando' })
        .eq('id', nfce_id);

      // Build payload for the fiscal API
      const payload = {
        numero: nfce.numero,
        serie: nfce.serie,
        valor_total: nfce.valor_total,
        cliente: nfce.payload_entrada?.cliente || {
          nome: 'Consumidor Final',
          cpf: null,
        },
        itens: (nfce.nfce_itens || []).map((item: any) => ({
          descricao: item.descricao,
          quantidade: item.quantidade,
          valor_unitario: item.valor_unitario,
          codigo_produto: item.codigo_produto,
          ncm: item.ncm,
          cfop: item.cfop,
          unidade: item.unidade,
          cst_icms: item.cst_icms,
          csosn: item.csosn,
          aliquota_icms: item.aliquota_icms,
          cst_pis: item.cst_pis,
          aliquota_pis: item.aliquota_pis,
          cst_cofins: item.cst_cofins,
          aliquota_cofins: item.aliquota_cofins,
        })),
      };

      console.log(`📡 Emitting NFC-e ${nfce.numero} via fiscal API...`);
      console.log(`   Payload: ${JSON.stringify(payload).substring(0, 200)}...`);

      // Call the fiscal API to emit
      const response = await fetch(`${FISCAL_API_BASE_URL}/nfce/emitir`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${empresa.api_key_fiscal}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const responseText = await response.text();
      console.log(`📡 Fiscal API emit response (status ${response.status}):`, responseText.substring(0, 500));

      let responseData: any;
      try {
        responseData = JSON.parse(responseText);
      } catch {
        console.error('❌ Fiscal API returned non-JSON response:', responseText.substring(0, 300));
        // Update NFC-e with error instead of crashing
        await supabase
          .from('nfce')
          .update({
            status: 'rejeitada',
            erro_processamento: `API fiscal retornou resposta inválida (status ${response.status})`,
            motivo_retorno: responseText.substring(0, 500),
          })
          .eq('id', nfce_id);

        await supabase.rpc('registrar_log', {
          p_empresa_id: nfce.empresa_id,
          p_nfce_id: nfce_id,
          p_token_api_id: nfce.token_api_id || empresa.id,
          p_tipo: 'erro',
          p_categoria: 'emissao',
          p_mensagem: `NFC-e ${nfce.numero}: API fiscal retornou resposta não-JSON (status ${response.status})`,
          p_detalhes: { raw_response: responseText.substring(0, 500) },
        });

        return new Response(
          JSON.stringify({ error: 'API fiscal retornou resposta inválida', details: responseText.substring(0, 300) }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!response.ok) {
        // Update NFC-e with error
        await supabase
          .from('nfce')
          .update({
            status: 'rejeitada',
            erro_processamento: responseData.error || 'Erro na API fiscal',
            motivo_retorno: JSON.stringify(responseData),
          })
          .eq('id', nfce_id);

        // Log error
        await supabase.rpc('registrar_log', {
          p_empresa_id: nfce.empresa_id,
          p_nfce_id: nfce_id,
          p_token_api_id: nfce.token_api_id || empresa.id,
          p_tipo: 'erro',
          p_categoria: 'emissao',
          p_mensagem: `Erro ao emitir NFC-e ${nfce.numero}: ${responseData.error || 'Erro desconhecido'}`,
          p_detalhes: responseData,
        });

        return new Response(
          JSON.stringify({ error: 'Erro na emissão fiscal', details: responseData }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Success - update NFC-e with response data
      const validStatuses = ['pendente', 'processando', 'autorizada', 'rejeitada', 'cancelada', 'denegada', 'contingencia'];
      const mappedStatus = validStatuses.includes(responseData.status) ? responseData.status : 'processando';
      const updateData: any = {
        status: mappedStatus,
        processado_em: new Date().toISOString(),
      };

      // Map fiscal API response fields
      if (responseData.chave_acesso) updateData.chave_acesso = responseData.chave_acesso;
      if (responseData.protocolo) updateData.protocolo = responseData.protocolo;
      if (responseData.codigo_retorno) updateData.codigo_retorno = responseData.codigo_retorno;
      if (responseData.motivo_retorno) updateData.motivo_retorno = responseData.motivo_retorno;
      if (responseData.xml_retorno) updateData.xml_retorno = responseData.xml_retorno;
      if (responseData.qrcode_url) updateData.qrcode_url = responseData.qrcode_url;
      if (responseData.data_autorizacao) updateData.data_autorizacao = responseData.data_autorizacao;

      await supabase
        .from('nfce')
        .update(updateData)
        .eq('id', nfce_id);

      // Log success
      await supabase.rpc('registrar_log', {
        p_empresa_id: nfce.empresa_id,
        p_nfce_id: nfce_id,
        p_token_api_id: nfce.token_api_id || empresa.id,
        p_tipo: 'sucesso',
        p_categoria: 'emissao',
        p_mensagem: `NFC-e ${nfce.numero} ${updateData.status} via API fiscal`,
        p_detalhes: { protocolo: responseData.protocolo, chave_acesso: responseData.chave_acesso },
      });

      // Send webhook notification
      try {
        const evento = updateData.status === 'autorizada' ? 'nfce.autorizada' : 
                       updateData.status === 'rejeitada' ? 'nfce.rejeitada' : 'nfce.processando';
        await supabase.functions.invoke('send-webhook', {
          body: { nfce_id: nfce_id, evento }
        });
      } catch (webhookError) {
        console.error('Webhook dispatch error:', webhookError);
      }

      return new Response(
        JSON.stringify({ success: true, data: { ...updateData, id: nfce_id } }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Ação inválida. Use: register_empresa, emit_nfce' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Fiscal API error:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
