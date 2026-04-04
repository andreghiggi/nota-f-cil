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
    const { action, empresa_id, nfce_id, nfe_id } = await req.json();

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

      const isPF = empresa.tipo_pessoa === 'PF';
      const docIdentificador = isPF ? (empresa.cpf || '') : (empresa.cnpj || '');

      // Build payload in the format expected by the PHP API (flat structure)
      const registerBody: any = {
        api_key: apiKeyFiscal,

        // Flat fields expected by PHP
        razao_social: empresa.razao_social,
        nome_fantasia: empresa.nome_fantasia || empresa.razao_social,
        tpAmb: empresa.ambiente === 'producao' ? 1 : 2,
        siglaUF: empresa.uf,
        CSC: empresa.csc_token || '',
        CSCid: empresa.csc_id || '',

        // Document - for PF, pad CPF to 14 digits in cnpj field so PHP builds access key correctly
        cnpj: isPF ? (empresa.cpf || '').replace(/\D/g, '').padStart(14, '0') : (empresa.cnpj || '').replace(/\D/g, ''),
        cpf: isPF ? (empresa.cpf || '').replace(/\D/g, '') : '',

        // Certificate - flat (PHP expects senha_certificado)
        certificado_base64: certificadoBase64 || '',
        senha_certificado: certificado?.senha_hash ? atob(certificado.senha_hash) : '',

        // Emitente - lowercase field names as PHP expects
        ie: (empresa.inscricao_estadual || '').replace(/\D/g, ''),
        crt: crtMap[empresa.regime_tributario] || 1,
        cnae: empresa.cnae_principal || '',
        logradouro: empresa.logradouro || '',
        numero: empresa.numero || '',
        bairro: empresa.bairro || '',
        cMun: empresa.codigo_municipio || '',
        xMun: empresa.municipio,
        codigo_municipio: empresa.codigo_municipio || '',
        municipio: empresa.municipio,
        uf: empresa.uf,
        cep: (empresa.cep || '').replace(/\D/g, ''),

        // Also send nested structure for backward compatibility
        sped_config: {
          tpAmb: empresa.ambiente === 'producao' ? 1 : 2,
          razaosocial: empresa.razao_social,
          cnpj: isPF ? (empresa.cpf || '').replace(/\D/g, '').padStart(14, '0') : (empresa.cnpj || '').replace(/\D/g, ''),
          cpf: isPF ? (empresa.cpf || '').replace(/\D/g, '') : '',
          siglaUF: empresa.uf,
          CSC: empresa.csc_token || '',
          CSCid: empresa.csc_id || '',
        },

        certificado: {
          pfx_base64: certificadoBase64 || '',
          senha: certificado?.senha_hash ? atob(certificado.senha_hash) : '',
        },

        emitente: {
          IE: (empresa.inscricao_estadual || '').replace(/\D/g, ''),
          CRT: crtMap[empresa.regime_tributario] || 1,
          CNAE: empresa.cnae_principal || '',
          xNome: empresa.razao_social,
          xFant: empresa.nome_fantasia || empresa.razao_social,
          ...(isPF ? { CPF: (empresa.cpf || '').replace(/\D/g, '') } : { CNPJ: (empresa.cnpj || '').replace(/\D/g, '') }),
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

      console.log(`📡 Registering ${isPF ? 'PF (produtor rural)' : 'PJ'} ${docIdentificador} on fiscal API...`);
      console.log(`   Has certificate: ${!!certificadoBase64}`);
      console.log(`   codigo_municipio: ${registerBody.codigo_municipio}`);
      console.log(`   Full payload: ${JSON.stringify(registerBody).substring(0, 1000)}`);
      
      const registerUrl = `${FISCAL_API_BASE_URL}/empresa/cadastrar`;
      console.log(`   Register URL: ${registerUrl}`);
      
      let response = await fetch(registerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registerBody),
      });
      
      let responseText = await response.text();
      console.log(`   Response status: ${response.status}`);
      console.log(`   Response body: ${responseText.substring(0, 500)}`);

      // Capture api_key from first successful registration
      let phpApiKey: string | null = null;
      try {
        const parsed = JSON.parse(responseText);
        if (parsed.api_key) phpApiKey = parsed.api_key;
      } catch {}

      // If duplicate entry, try to update instead
      if (responseText.includes('Duplicate entry') || responseText.includes('1062')) {
        console.log(`   ⚠️ Empresa already exists, trying /empresa/atualizar...`);
        const updateResponse = await fetch(`${FISCAL_API_BASE_URL}/empresa/atualizar`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(registerBody),
        });
        responseText = await updateResponse.text();
        response = updateResponse;
        console.log(`   Update response status: ${response.status}`);
        console.log(`   Update response body: ${responseText.substring(0, 500)}`);
        // Try to get api_key from update response too
        try {
          const parsed = JSON.parse(responseText);
          if (parsed.api_key) phpApiKey = parsed.api_key;
        } catch {}
      }

      let responseData: any;
      const isHtml = responseText.trim().startsWith('<') || responseText.includes('Fatal error') || responseText.includes('Warning:');
      
      if (isHtml) {
        console.error(`❌ PHP Error detected in response:`, responseText.substring(0, 800));
        return new Response(
          JSON.stringify({ 
            error: 'Erro fatal na API fiscal (PHP)', 
            details: responseText.replace(/<[^>]*>/g, '').trim().substring(0, 500)
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

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

      // Use the api_key returned by PHP if available, otherwise use our generated one
      const finalApiKey = responseData?.api_key || apiKeyFiscal;

      // Store the fiscal API key in our database
      if (!empresa.api_key_fiscal || empresa.api_key_fiscal !== finalApiKey) {
        const { error: updateError } = await supabase
          .from('empresas')
          .update({ api_key_fiscal: finalApiKey })
          .eq('id', empresa_id);

        if (updateError) {
          return new Response(
            JSON.stringify({ error: 'Erro ao salvar API key fiscal', details: updateError.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      console.log(`✅ ${isPF ? 'Produtor rural' : 'Empresa'} ${docIdentificador} registered successfully on fiscal API`);

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
      const clientePayload = nfce.payload_entrada?.cliente || { nome: 'Consumidor Final', cpf: null };
      
      // Build items as object with numeric keys (PHP stdClass compatible) instead of array
      const itensObj: Record<string, any> = {};
      (nfce.nfce_itens || []).forEach((item: any, idx: number) => {
        itensObj[String(idx)] = {
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
        };
      });

      const payload = {
        api_key: empresa.api_key_fiscal,
        ind_sinc: 1,
        nota: {
          numero: parseInt(nfce.numero, 10).toString(),
          serie: parseInt(nfce.serie, 10).toString(),
          valor_total: nfce.valor_total,
          cliente: clientePayload,
          itens: itensObj,
        },
      };

      console.log(`📡 Emitting NFC-e ${nfce.numero} via fiscal API...`);
      console.log(`   Payload: ${JSON.stringify(payload).substring(0, 200)}...`);

      const emitUrl = `${FISCAL_API_BASE_URL}/nfce/emitir?api_key=${encodeURIComponent(empresa.api_key_fiscal)}`;
      console.log(`   Emit URL: ${emitUrl.replace(empresa.api_key_fiscal, '***')}`);
      const response = await fetch(emitUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': empresa.api_key_fiscal,
          'Authorization': `Bearer ${empresa.api_key_fiscal}`,
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
        await supabase
          .from('nfce')
          .update({
            status: 'rejeitada',
            erro_processamento: responseData.error || 'Erro na API fiscal',
            motivo_retorno: JSON.stringify(responseData),
          })
          .eq('id', nfce_id);

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
      console.log('✅ Full fiscal API response keys:', Object.keys(responseData));
      console.log('✅ Full fiscal API response:', JSON.stringify(responseData).substring(0, 1000));
      
      const validStatuses = ['pendente', 'processando', 'autorizada', 'rejeitada', 'cancelada', 'denegada', 'contingencia'];
      const mappedStatus = validStatuses.includes(responseData.status) ? responseData.status : 'processando';
      const updateData: any = {
        status: mappedStatus,
        processado_em: new Date().toISOString(),
      };

      const chaveAcesso = responseData.chave_acesso || responseData.chave || responseData.chNFe || responseData.chave_nfe || responseData.key;
      const protocolo = responseData.protocolo || responseData.nProt || responseData.protocol;
      const codigoRetorno = responseData.codigo_retorno || responseData.cStat || responseData.code;
      const motivoRetorno = responseData.motivo_retorno || responseData.xMotivo || responseData.motivo || responseData.message;
      const xmlRetorno = responseData.xml_retorno || responseData.xml || responseData.xmlRetorno;
      let qrcodeUrl = responseData.qrcode_url || responseData.qrcode || responseData.urlQRCode || responseData.qr_code || responseData.qrCode || responseData.url_qrcode;
      const dataAutorizacao = responseData.data_autorizacao || responseData.dhRecbto || responseData.data_recebimento;

      if (!qrcodeUrl && xmlRetorno) {
        try {
          let xmlStr = xmlRetorno;
          if (!xmlStr.startsWith('<') && !xmlStr.startsWith('<?')) {
            xmlStr = atob(xmlStr);
          }
          const qrMatch = xmlStr.match(/<qrCode>(.*?)<\/qrCode>/);
          if (qrMatch && qrMatch[1]) {
            qrcodeUrl = qrMatch[1];
            console.log('📱 QR Code extracted from XML:', qrcodeUrl.substring(0, 100));
          }
          if (!dataAutorizacao) {
            const dhMatch = xmlStr.match(/<dhRecbto>(.*?)<\/dhRecbto>/);
            if (dhMatch && dhMatch[1]) {
              updateData.data_autorizacao = dhMatch[1];
            }
          }
        } catch (xmlErr) {
          console.error('⚠️ Error extracting QR Code from XML:', xmlErr);
        }
      }

      if (chaveAcesso) updateData.chave_acesso = chaveAcesso;
      if (protocolo) updateData.protocolo = protocolo;
      if (codigoRetorno) updateData.codigo_retorno = codigoRetorno;
      if (motivoRetorno) updateData.motivo_retorno = motivoRetorno;
      if (xmlRetorno) updateData.xml_retorno = xmlRetorno;
      if (qrcodeUrl) updateData.qrcode_url = qrcodeUrl;
      if (dataAutorizacao) updateData.data_autorizacao = dataAutorizacao;

      await supabase
        .from('nfce')
        .update(updateData)
        .eq('id', nfce_id);

      await supabase.rpc('registrar_log', {
        p_empresa_id: nfce.empresa_id,
        p_nfce_id: nfce_id,
        p_token_api_id: nfce.token_api_id || empresa.id,
        p_tipo: 'sucesso',
        p_categoria: 'emissao',
        p_mensagem: `NFC-e ${nfce.numero} ${updateData.status} via API fiscal`,
        p_detalhes: { protocolo, chave_acesso: chaveAcesso, qrcode_url: qrcodeUrl, response_keys: Object.keys(responseData) },
      });

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

    // ========================================================================
    // ACTION: emit_nfe - Emit NF-e via fiscal API
    // ========================================================================
    if (action === 'emit_nfe') {
      const nfeId = nfe_id;

      if (!nfeId) {
        return new Response(
          JSON.stringify({ error: 'nfe_id é obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get NF-e data with items
      const { data: nfe, error: nfeError } = await supabase
        .from('nfe')
        .select(`*, nfe_itens(*)`)
        .eq('id', nfeId)
        .single();

      if (nfeError || !nfe) {
        return new Response(
          JSON.stringify({ error: 'NF-e não encontrada', details: nfeError?.message }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get empresa with fiscal API key
      const { data: empresa, error: empresaError } = await supabase
        .from('empresas')
        .select('*')
        .eq('id', nfe.empresa_id)
        .single();

      if (empresaError || !empresa) {
        return new Response(
          JSON.stringify({ error: 'Empresa não encontrada' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!empresa.api_key_fiscal) {
        // Auto-register empresa on fiscal API before emitting
        console.log(`📡 Auto-registering empresa ${empresa.razao_social} before NF-e emission...`);
        const registerResponse = await fetch(req.url.replace(/\/fiscal-api.*/, '/fiscal-api'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': req.headers.get('Authorization') || '' },
          body: JSON.stringify({ action: 'register_empresa', empresa_id: nfe.empresa_id }),
        });
        // Ignore register errors, just try - refetch empresa to get new api_key
        const { data: updatedEmpresa } = await supabase
          .from('empresas')
          .select('api_key_fiscal')
          .eq('id', nfe.empresa_id)
          .single();
        
        if (!updatedEmpresa?.api_key_fiscal) {
          // Fallback: self-invoke register_empresa action
          const selfUrl = `${supabaseUrl}/functions/v1/fiscal-api`;
          const regResp = await fetch(selfUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseServiceKey}` },
            body: JSON.stringify({ action: 'register_empresa', empresa_id: nfe.empresa_id }),
          });
          await regResp.text(); // consume body
          
          // Re-fetch empresa
          const { data: refetchedEmpresa } = await supabase
            .from('empresas')
            .select('*')
            .eq('id', nfe.empresa_id)
            .single();
          
          if (!refetchedEmpresa?.api_key_fiscal) {
            return new Response(
              JSON.stringify({ error: 'Empresa não registrada na API fiscal. Registre primeiro.' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          
          // Use refetched empresa for the rest
          Object.assign(empresa, refetchedEmpresa);
        } else {
          empresa.api_key_fiscal = updatedEmpresa.api_key_fiscal;
        }
      }

      // Get certificate data to send along with emission
      const { data: certificado } = await supabase
        .from('certificados_digitais')
        .select('*')
        .eq('empresa_id', nfe.empresa_id)
        .single();

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
          console.log(`📎 Certificate loaded for NF-e emission (${bytes.length} bytes)`);
        }
      }

      // Update status to processing
      await supabase.from('nfe').update({ status: 'processando' }).eq('id', nfeId);

      const isPF = empresa.tipo_pessoa === 'PF';

      // Build items with IBS/CBS/IS data (Grupo UB - Reforma Tributária)
      const itensObj: Record<string, any> = {};
      (nfe.nfe_itens || []).forEach((item: any, idx: number) => {
        const itemData: any = {
          descricao: item.descricao,
          quantidade: item.quantidade,
          valor_unitario: item.valor_unitario,
          valor_total: item.valor_total || (item.quantidade * item.valor_unitario),
          codigo_produto: item.codigo_produto,
          ncm: item.ncm,
          cfop: item.cfop,
          unidade: item.unidade,
          cst_icms: item.cst_icms,
          csosn: item.csosn,
          aliquota_icms: item.aliquota_icms,
          cst_ipi: item.cst_ipi,
          aliquota_ipi: item.aliquota_ipi,
          cst_pis: item.cst_pis,
          aliquota_pis: item.aliquota_pis,
          cst_cofins: item.cst_cofins,
          aliquota_cofins: item.aliquota_cofins,
        };

        // Grupo UB - IBS/CBS (only if CST is set)
        if (item.cst_ibs_cbs) {
          itemData.ibs_cbs = {
            CST: item.cst_ibs_cbs,
            cClassTrib: item.c_class_trib || '',
            vBC: item.vbc_ibs_cbs || item.valor_total || 0,
            indDoacao: item.ind_doacao ?? undefined,
            gIBSUF: {
              pIBSUF: item.aliquota_ibs_uf || 0,
              vIBSUF: item.valor_ibs_uf || 0,
              ...(item.p_red_aliq_ibs_uf ? { gRed: { pRedAliq: item.p_red_aliq_ibs_uf, pAliqEfet: item.p_aliq_efet_ibs_uf || 0 } } : {}),
              ...(item.valor_dif_ibs_uf ? { gDif: { vDif: item.valor_dif_ibs_uf } } : {}),
              ...(item.valor_dev_trib_ibs_uf ? { gDevTrib: { vDevTrib: item.valor_dev_trib_ibs_uf } } : {}),
            },
            gIBSMun: {
              pIBSMun: item.aliquota_ibs_mun || 0,
              vIBSMun: item.valor_ibs_mun || 0,
              ...(item.p_red_aliq_ibs_mun ? { gRed: { pRedAliq: item.p_red_aliq_ibs_mun, pAliqEfet: item.p_aliq_efet_ibs_mun || 0 } } : {}),
              ...(item.valor_dif_ibs_mun ? { gDif: { vDif: item.valor_dif_ibs_mun } } : {}),
              ...(item.valor_dev_trib_ibs_mun ? { gDevTrib: { vDevTrib: item.valor_dev_trib_ibs_mun } } : {}),
            },
            gCBS: {
              pCBS: item.aliquota_cbs || 0,
              vCBS: item.valor_cbs || 0,
              ...(item.p_red_aliq_cbs ? { gRed: { pRedAliq: item.p_red_aliq_cbs, pAliqEfet: item.p_aliq_efet_cbs || 0 } } : {}),
              ...(item.valor_dif_cbs ? { gDif: { vDif: item.valor_dif_cbs } } : {}),
              ...(item.valor_dev_trib_cbs ? { gDevTrib: { vDevTrib: item.valor_dev_trib_cbs } } : {}),
            },
          };
        }

        // Imposto Seletivo
        if (item.cst_is) {
          itemData.imposto_seletivo = {
            CSTIS: item.cst_is,
            cClassTribIS: item.c_class_trib_is || '',
            vBCIS: item.vbc_is || 0,
            pIS: item.aliquota_is || 0,
            vIS: item.valor_is || 0,
          };
        }

        if (item.ind_bem_movel_usado) {
          itemData.indBemMovelUsado = item.ind_bem_movel_usado;
        }

        itensObj[String(idx)] = itemData;
      });

      // Build destinatário
      const clientePayload: any = {};
      if (nfe.dest_cpf_cnpj) {
        const doc = nfe.dest_cpf_cnpj.replace(/\D/g, '');
        if (doc.length > 11) {
          clientePayload.cnpj = doc;
        } else {
          clientePayload.cpf = doc;
        }
      }
      if (nfe.dest_nome) clientePayload.nome = nfe.dest_nome;
      if (nfe.dest_ie) clientePayload.ie = nfe.dest_ie;
      if (nfe.dest_email) clientePayload.email = nfe.dest_email;
      clientePayload.indIEDest = nfe.dest_ie ? 1 : 9;
      if (nfe.dest_logradouro) {
        clientePayload.logradouro = nfe.dest_logradouro;
        clientePayload.numero = nfe.dest_numero || 'SN';
        clientePayload.bairro = nfe.dest_bairro || '';
        clientePayload.cMun = nfe.dest_codigo_municipio || '';
        clientePayload.xMun = nfe.dest_municipio || '';
        clientePayload.uf = nfe.dest_uf || '';
        clientePayload.cep = (nfe.dest_cep || '').replace(/\D/g, '');
      }

      const payload: any = {
        api_key: empresa.api_key_fiscal,
        ind_sinc: 1,
        modelo: 55,
        tipo_pessoa: isPF ? 'PF' : 'PJ',
        cMun: empresa.codigo_municipio || '',
        xMun: empresa.municipio || '',
        codigo_municipio: empresa.codigo_municipio || '',
        municipio: empresa.municipio || '',
        nota: {
          numero: parseInt(nfe.numero, 10).toString(),
          serie: parseInt(nfe.serie, 10).toString(),
          valor_total: nfe.valor_total,
          natureza_operacao: nfe.natureza_operacao || 'VENDA',
          finalidade: nfe.finalidade || '1',
          modalidade_frete: nfe.modalidade_frete || '9',
          cliente: clientePayload,
          itens: itensObj,
          // Reforma Tributária - Grupo B
          ...(nfe.d_prev_entrega ? { dPrevEntrega: nfe.d_prev_entrega } : {}),
          ...(nfe.c_mun_fg_ibs ? { cMunFGIBS: nfe.c_mun_fg_ibs } : {}),
          ...(nfe.tp_nf_debito ? { tpNFDebito: nfe.tp_nf_debito } : {}),
          ...(nfe.tp_nf_credito ? { tpNFCredito: nfe.tp_nf_credito } : {}),
          ...(nfe.ind_intermed != null ? { indIntermed: nfe.ind_intermed } : {}),
          ...(nfe.tp_ente_gov != null ? { gCompraGov: { tpEnteGov: nfe.tp_ente_gov, tpOperGov: nfe.tp_oper_gov, pRedutor: nfe.p_redutor_gov || 0 } } : {}),
          // Totais IBS/CBS/IS (Grupo W03)
          totais_ibs_cbs: {
            vIBSUFTot: nfe.valor_ibs_uf_total || 0,
            vIBSMunTot: nfe.valor_ibs_mun_total || 0,
            vCBSTot: nfe.valor_cbs_total || 0,
            vISTot: nfe.valor_is_total || 0,
            vDifIBSUFTot: nfe.valor_dif_ibs_uf_total || 0,
            vDifIBSMunTot: nfe.valor_dif_ibs_mun_total || 0,
            vDifCBSTot: nfe.valor_dif_cbs_total || 0,
            vDevTribIBSUFTot: nfe.valor_dev_trib_ibs_uf_total || 0,
            vDevTribIBSMunTot: nfe.valor_dev_trib_ibs_mun_total || 0,
            vDevTribCBSTot: nfe.valor_dev_trib_cbs_total || 0,
          },
        },
        emitente: {
          cMun: empresa.codigo_municipio || '',
          xMun: empresa.municipio || '',
          UF: empresa.uf || '',
          IE: (empresa.inscricao_estadual || '').replace(/\D/g, ''),
          ...(isPF
            ? { CPF: (empresa.cpf || '').replace(/\D/g, '') }
            : { CNPJ: (empresa.cnpj || '').replace(/\D/g, '') }
          ),
        },
      };

      // For PF emitters, pad CPF to 14 digits and send as cnpj so PHP builds the access key correctly
      // The access key requires a 14-digit document field; 11-digit CPF causes invalid check digit
      if (isPF) {
        const cpfClean = (empresa.cpf || '').replace(/\D/g, '');
        const cpfPadded = cpfClean.padStart(14, '0'); // 000 + 11-digit CPF = 14 digits
        payload.cnpj = cpfPadded;
        payload.cpf = cpfClean; // Also send original CPF for XML tag
        payload.tipo_pessoa = 'PF'; // Ensure PHP knows to use <CPF> tag in XML
      } else {
        payload.cnpj = (empresa.cnpj || '').replace(/\D/g, '');
      }

      // Include certificate in emission payload to avoid PHP-side certificate loading issues
      if (certificadoBase64) {
        payload.certificado = {
          pfx_base64: certificadoBase64,
          senha: certificado?.senha_hash ? atob(certificado.senha_hash) : '',
        };
      }

      console.log(`📡 Emitting NF-e ${nfe.numero} via fiscal API (modelo 55, ${isPF ? 'PF/produtor rural' : 'PJ'})...`);
      console.log(`   Payload: ${JSON.stringify(payload).substring(0, 500)}...`);

      // NF-e uses the dedicated /nfe/emitir endpoint so PHP sets modelo=55 correctly
      const emitUrl = `${FISCAL_API_BASE_URL}/nfe/emitir?api_key=${encodeURIComponent(empresa.api_key_fiscal)}`;
      const response = await fetch(emitUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': empresa.api_key_fiscal,
          'Authorization': `Bearer ${empresa.api_key_fiscal}`,
        },
        body: JSON.stringify(payload),
      });

      const responseText = await response.text();
      console.log(`📡 Fiscal API NF-e emit response (status ${response.status}):`, responseText.substring(0, 500));

      let responseData: any;
      try {
        responseData = JSON.parse(responseText);
      } catch {
        await supabase.from('nfe').update({
          status: 'rejeitada',
          erro_processamento: `API fiscal retornou resposta inválida (status ${response.status})`,
          motivo_retorno: responseText.substring(0, 500),
        }).eq('id', nfeId);

        return new Response(
          JSON.stringify({ error: 'API fiscal retornou resposta inválida', details: responseText.substring(0, 300) }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!response.ok) {
        await supabase.from('nfe').update({
          status: 'rejeitada',
          erro_processamento: responseData.error || 'Erro na API fiscal',
          motivo_retorno: JSON.stringify(responseData),
        }).eq('id', nfeId);

        return new Response(
          JSON.stringify({ error: 'Erro na emissão fiscal', details: responseData }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Success - update NF-e
      const validStatuses = ['pendente', 'processando', 'autorizada', 'rejeitada', 'cancelada', 'denegada', 'contingencia'];
      const mappedStatus = validStatuses.includes(responseData.status) ? responseData.status : 'processando';
      const updateData: any = { status: mappedStatus, processado_em: new Date().toISOString() };

      const chaveAcesso = responseData.chave_acesso || responseData.chave || responseData.chNFe || responseData.key;
      const protocolo = responseData.protocolo || responseData.nProt;
      const codigoRetorno = responseData.codigo_retorno || responseData.cStat;
      const motivoRetorno = responseData.motivo_retorno || responseData.xMotivo;
      const xmlRetorno = responseData.xml_retorno || responseData.xml;
      const dataAutorizacao = responseData.data_autorizacao || responseData.dhRecbto;

      if (chaveAcesso) updateData.chave_acesso = chaveAcesso;
      if (protocolo) updateData.protocolo = protocolo;
      if (codigoRetorno) updateData.codigo_retorno = codigoRetorno;
      if (motivoRetorno) updateData.motivo_retorno = motivoRetorno;
      if (xmlRetorno) updateData.xml_retorno = xmlRetorno;
      if (dataAutorizacao) updateData.data_autorizacao = dataAutorizacao;

      // Extract data_autorizacao from XML if not present
      if (!dataAutorizacao && xmlRetorno) {
        try {
          let xmlStr = xmlRetorno;
          if (!xmlStr.startsWith('<')) xmlStr = atob(xmlStr);
          const dhMatch = xmlStr.match(/<dhRecbto>(.*?)<\/dhRecbto>/);
          if (dhMatch) updateData.data_autorizacao = dhMatch[1];
        } catch {}
      }

      await supabase.from('nfe').update(updateData).eq('id', nfeId);

      // Log success
      await supabase.rpc('registrar_log', {
        p_empresa_id: nfe.empresa_id,
        p_nfce_id: nfeId,
        p_token_api_id: nfe.token_api_id || empresa.id,
        p_tipo: 'sucesso',
        p_categoria: 'emissao',
        p_mensagem: `NF-e ${nfe.numero} ${updateData.status} via API fiscal`,
        p_detalhes: { protocolo, chave_acesso: chaveAcesso, tipo: 'nfe' },
      });

      return new Response(
        JSON.stringify({ success: true, data: { ...updateData, id: nfeId } }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Ação inválida. Use: register_empresa, emit_nfce, emit_nfe' }),
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
