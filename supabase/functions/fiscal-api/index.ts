import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FISCAL_API_BASE_URL = 'https://api2.agilizeerp.com.br';

// ============================================================================
// SHARED HELPERS
// ============================================================================

/**
 * POST com retry automático para falhas transitórias da SEFAZ
 * (Connection reset by peer, timeouts, 5xx). Usado em emissão, cancelamento e CC-e.
 */
async function postWithRetry(
  url: string,
  payload: any,
  opts: { maxAttempts?: number; label?: string } = {}
): Promise<{ response: Response; text: string; data: any }> {
  const maxAttempts = opts.maxAttempts ?? 3;
  const label = opts.label ?? 'request';
  let lastErr: any = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const text = await response.text();
      let data: any;
      try { data = JSON.parse(text); } catch { data = { raw: text }; }

      const errStr = (data?.erro || data?.error || text || '').toString().toLowerCase();
      const transient =
        errStr.includes('connection reset by peer') ||
        errStr.includes('recv failure') ||
        errStr.includes('timeout') ||
        errStr.includes('timed out') ||
        errStr.includes('could not resolve host') ||
        (response.status >= 502 && response.status <= 504);

      if (transient && attempt < maxAttempts) {
        const wait = 800 * attempt;
        console.log(`⚠️ ${label} attempt ${attempt} transient (${response.status}): ${errStr.substring(0, 120)} — retrying in ${wait}ms`);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }

      return { response, text, data };
    } catch (err: any) {
      lastErr = err;
      const msg = (err?.message || '').toLowerCase();
      const transient = msg.includes('connection reset') || msg.includes('timeout') || msg.includes('network');
      if (transient && attempt < maxAttempts) {
        const wait = 800 * attempt;
        console.log(`⚠️ ${label} attempt ${attempt} threw (${msg}) — retrying in ${wait}ms`);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      throw err;
    }
  }
  throw lastErr || new Error(`${label}: max attempts exceeded`);
}

/**
 * Normaliza o conteúdo XML salvo em xml_retorno/xml_envio. Aceita:
 *  - string XML pura
 *  - JSON com {xml|xml_retorno|procNFe|nfeProc}
 *  - Base64 com XML dentro
 *  - HTML-encoded (&lt;)
 * Retorna XML cru pronto para o sped-da, ou string vazia.
 */
function normalizeXmlForDanfe(raw: any): string {
  if (!raw) return '';
  let xml = '';
  if (typeof raw === 'string') {
    xml = raw.trim();
  } else if (typeof raw === 'object') {
    xml = String(raw.xml || raw.xml_retorno || raw.procNFe || raw.nfeProc || raw.NFe || '').trim();
  }
  if (!xml) return '';

  if (xml.startsWith('{') || xml.startsWith('[')) {
    try {
      const parsed = JSON.parse(xml);
      xml = String(parsed.xml || parsed.xml_retorno || parsed.procNFe || parsed.nfeProc || parsed.NFe || '').trim();
    } catch { /* mantém */ }
  }

  if (xml.includes('&lt;') && !xml.includes('<NFe') && !xml.includes('<procNFe')) {
    xml = xml
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, '&');
  }

  const compact = xml.replace(/\s+/g, '');
  if (!xml.startsWith('<') && /^[A-Za-z0-9+/=]+$/.test(compact) && compact.length > 40) {
    try {
      const bin = atob(compact);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      xml = new TextDecoder('utf-8').decode(bytes).trim();
    } catch { return ''; }
  }

  const start = xml.search(/<\?xml|<nfeProc|<procNFe|<NFe/i);
  if (start > 0) xml = xml.slice(start);
  return xml.replace(/^\uFEFF/, '').trim();
}

function extractXmlProductNames(raw: any): string[] {
  const xml = normalizeXmlForDanfe(raw);
  if (!xml) return [];
  return [...xml.matchAll(/<xProd>([^<]*)<\/xProd>/gi)].map((m) => m[1].trim());
}

/**
 * Load certificate (PFX) from Supabase Storage and return base64 + decoded password.
 * Returns null if no certificate is configured.
 */
async function loadCertificate(supabase: any, empresaId: string): Promise<{ base64: string; senha: string } | null> {
  const { data: cert } = await supabase
    .from('certificados_digitais')
    .select('arquivo_path, senha_hash')
    .eq('empresa_id', empresaId)
    .maybeSingle();

  if (!cert?.arquivo_path) return null;

  const { data: fileData, error: fileError } = await supabase.storage
    .from('certificados')
    .download(cert.arquivo_path);

  if (fileError || !fileData) {
    console.warn(`⚠️ Could not download certificate for ${empresaId}: ${fileError?.message}`);
    return null;
  }

  const bytes = new Uint8Array(await fileData.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);

  return {
    base64: btoa(binary),
    senha: cert.senha_hash ? atob(cert.senha_hash) : '',
  };
}

/**
 * Build the registration payload for the PHP fiscal API.
 * This is the single source of truth — always built from Supabase data.
 */
function buildRegisterPayload(empresa: any, apiKey: string, certificate: { base64: string; senha: string } | null) {
  const crtMap: Record<string, number> = {
    'simples_nacional': 1,
    'lucro_presumido': 3,
    'lucro_real': 3,
  };

  const isPF = empresa.tipo_pessoa === 'PF';
  const cnpjClean = isPF
    ? (empresa.cpf || '').replace(/\D/g, '').padStart(14, '0')
    : (empresa.cnpj || '').replace(/\D/g, '');

  return {
    api_key: apiKey,
    tipo_pessoa: isPF ? 'PF' : 'PJ',
    razao_social: empresa.razao_social,
    nome_fantasia: empresa.nome_fantasia || empresa.razao_social,
    tpAmb: empresa.ambiente === 'producao' ? 1 : 2,
    siglaUF: empresa.uf,
    CSC: empresa.csc_token || '',
    CSCid: empresa.csc_id || '',
    cnpj: cnpjClean,
    cpf: isPF ? (empresa.cpf || '').replace(/\D/g, '') : '',
    certificado_base64: certificate?.base64 || '',
    senha_certificado: certificate?.senha || '',
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
    // Nested structures for backward compatibility
    sped_config: {
      tpAmb: empresa.ambiente === 'producao' ? 1 : 2,
      razaosocial: empresa.razao_social,
      cnpj: cnpjClean,
      cpf: isPF ? (empresa.cpf || '').replace(/\D/g, '') : '',
      siglaUF: empresa.uf,
      CSC: empresa.csc_token || '',
      CSCid: empresa.csc_id || '',
    },
    certificado: {
      pfx_base64: certificate?.base64 || '',
      senha: certificate?.senha || '',
    },
    emitente: {
      IE: (empresa.inscricao_estadual || '').replace(/\D/g, ''),
      CRT: crtMap[empresa.regime_tributario] || 1,
      CNAE: empresa.cnae_principal || '',
      xNome: empresa.razao_social,
      xFant: empresa.nome_fantasia || empresa.razao_social,
      ...(isPF
        ? { CPF: (empresa.cpf || '').replace(/\D/g, '') }
        : { CNPJ: (empresa.cnpj || '').replace(/\D/g, '') }),
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
}

/**
 * Ensure an empresa is registered on the PHP fiscal API.
 * - Generates api_key_fiscal in Supabase if missing (Supabase = source of truth)
 * - Sends registration to PHP (which uses INSERT ... ON DUPLICATE KEY UPDATE)
 * - Returns the empresa with api_key_fiscal guaranteed
 */
async function ensureRegistered(supabase: any, empresaId: string): Promise<{ empresa: any; certificate: { base64: string; senha: string } | null; error?: string }> {
  // Fetch empresa
  const { data: empresa, error: empresaError } = await supabase
    .from('empresas')
    .select('*')
    .eq('id', empresaId)
    .single();

  if (empresaError || !empresa) {
    return { empresa: null, certificate: null, error: 'Empresa não encontrada' };
  }

  // Load certificate
  const certificate = await loadCertificate(supabase, empresaId);

  // Garantir que existe uma api_key_fiscal real (não "pending") ANTES do sync
  if (!empresa.api_key_fiscal || empresa.api_key_fiscal === 'pending') {
    const newKey = crypto.randomUUID().replace(/-/g, '');
    await supabase.from('empresas').update({ api_key_fiscal: newKey }).eq('id', empresaId);
    empresa.api_key_fiscal = newKey;
    console.log(`   🔑 Gerada nova api_key_fiscal: ${newKey.substring(0, 8)}...`);
  }

  // Register/sync with PHP fiscal API and get the api_key PHP uses
  const registerBody = buildRegisterPayload(empresa, empresa.api_key_fiscal, certificate);

  try {
    const isPF = empresa.tipo_pessoa === 'PF';
    const doc = isPF ? empresa.cpf : empresa.cnpj;
    console.log(`📡 Syncing ${isPF ? 'PF' : 'PJ'} ${doc} with fiscal API...`);

    const response = await fetch(`${FISCAL_API_BASE_URL}/empresa/cadastrar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(registerBody),
    });

    const responseText = await response.text();
    console.log(`   PHP register response (${response.status}): ${responseText.substring(0, 300)}`);

    // Extract api_key from PHP response — PHP is source of truth for its own key
    try {
      // Strip PHP warnings to find JSON
      const jsonMatch = responseText.match(/\{[^{}]*"api_key"[^{}]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.api_key && parsed.api_key !== empresa.api_key_fiscal) {
          empresa.api_key_fiscal = parsed.api_key;
          await supabase.from('empresas').update({ api_key_fiscal: parsed.api_key }).eq('id', empresaId);
          console.log(`   🔑 Saved PHP api_key: ${parsed.api_key.substring(0, 8)}...`);
        }
      }
    } catch {}
  } catch (err: any) {
    console.warn(`⚠️ PHP registration failed (non-fatal): ${err.message}`);
  }

  return { empresa, certificate };
}

function buildNfceClientePayload(rawCliente: any, ambiente: string) {
  const cliente = rawCliente && typeof rawCliente === 'object' ? rawCliente : {};
  const nome = typeof cliente.nome === 'string' && cliente.nome.trim() ? cliente.nome.trim() : undefined;
  const rawDoc = [cliente.cpf, cliente.cnpj, cliente.cpf_cnpj, cliente.documento]
    .find((value) => typeof value === 'string' && value.trim());
  const documento = typeof rawDoc === 'string' ? rawDoc.replace(/\D/g, '') : '';

  if (documento.length > 11) {
    return nome ? { cnpj: documento, nome } : { cnpj: documento };
  }

  if (documento.length === 11) {
    return nome ? { cpf: documento, nome } : { cpf: documento };
  }

  if (ambiente === 'homologacao') {
    // CPF fictício válido para homologação (dígitos verificadores corretos).
    // Em produção a SEFAZ-RS rejeita 00000000000.
    console.log('⚠️ NFC-e em homologação sem documento do consumidor; aplicando CPF fictício de teste.');
    return { cpf: '11144477735', nome: nome || 'NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL' };
  }

  return {};
}

function buildNfcePaymentPayload(nfce: any) {
  return buildPaymentPayload(nfce);
}

function buildPaymentPayload(doc: any) {
  const entrada = doc.payload_entrada || {};
  const firstPresent = (...values: any[]) => values.find((value) => value !== undefined && value !== null && value !== '');
  const rawPag = firstPresent(
    entrada.pagamento,
    entrada.pagamentos,
    entrada.formas_pagamento,
    entrada.forma_pagamento,
    entrada.pag?.detPag,
    entrada.detPag,
    entrada.pag
  );
  const rawList = Array.isArray(rawPag) ? rawPag : (rawPag ? [rawPag] : []);
  const sourceList = rawList.length > 0 ? rawList : [{ tPag: '01', vPag: doc.valor_total }];

  const detPag = sourceList.map((p: any) => {
    const card = p?.card ?? p?.cartao ?? p;
    const tPagRaw = firstPresent(p?.tPag, p?.tpag, p?.forma, p?.forma_pagamento, p?.tipo_pagamento, p?.codigo, '01');
    const tPag = String(tPagRaw).replace(/\D/g, '').padStart(2, '0').slice(-2) || '01';
    const vPag = Number(firstPresent(p?.vPag, p?.vpag, p?.valor, p?.valor_pagamento, p?.total, doc.valor_total)).toFixed(2);
    const det: any = {
      indPag: Number(firstPresent(p?.indPag, p?.indpag, p?.indicador_pagamento, 0)),
      tPag,
      forma_pagamento: tPag,
      tipo_pagamento: tPag,
      vPag,
      valor_pagamento: vPag,
      valor: vPag,
    };
    // Pagamentos eletrônicos exigem tpIntegra (NT 2020.006 v1.20):
    // 03/04 cartão crédito/débito, 10-13 vouchers, 17 PIX, 18 transferência bancária.
    const isCartaoReal = ['03','04','10','11','12','13'].includes(tPag);
    const isPixOuTransf = ['17','18'].includes(tPag);
    if (isCartaoReal || isPixOuTransf) {
      // Para PIX/transferência, default tpIntegra=2 (não integrado). Cartão default=1.
      const tpIntegraRaw = Number(firstPresent(card?.tpIntegra, card?.tpintegra, p?.tpIntegra, p?.tipo_integracao, isPixOuTransf ? 2 : 1));
      let tpIntegra = tpIntegraRaw === 2 ? 2 : 1;
      const cnpjCard = String(firstPresent(card?.CNPJ, card?.cnpj, p?.CNPJ, p?.cnpj, p?.cnpj_credenciadora, '')).replace(/\D/g, '');
      // tpIntegra=1 (integrado) exige CNPJ da credenciadora válido (14 díg). Sem CNPJ, força 2.
      if (tpIntegra === 1 && cnpjCard.length !== 14) tpIntegra = 2;
      const tBand = firstPresent(card?.tBand, card?.tband, p?.tBand, p?.bandeira_operadora);
      const cAut = firstPresent(card?.cAut, card?.caut, p?.cAut, p?.numero_autorizacao);
      const nsu = firstPresent(card?.NSU, card?.nsu, p?.NSU, p?.nsu);
      const cardPayload: any = { tpIntegra };
      if (tpIntegra === 1 && cnpjCard) {
        Object.assign(cardPayload, { CNPJ: cnpjCard, cnpj: cnpjCard, cnpj_credenciadora: cnpjCard });
      }
      // tBand/cAut/NSU só valem para cartão real (03/04/10-13). PIX/Transferência não têm.
      if (isCartaoReal) {
        if (tBand) Object.assign(cardPayload, { tBand: String(tBand).padStart(2, '0'), bandeira_operadora: String(tBand).padStart(2, '0') });
        if (cAut) Object.assign(cardPayload, { cAut: String(cAut), numero_autorizacao: String(cAut) });
        if (nsu) Object.assign(cardPayload, { NSU: String(nsu), nsu: String(nsu) });
      }
      Object.assign(det, cardPayload, { card: cardPayload, cartao: cardPayload });
    }
    return det;
  });

  const primary = detPag[0];
  const pagamentosObj = Object.fromEntries(detPag.map((pag, idx) => [String(idx + 1), pag]));
  const vTroco = Number(firstPresent(entrada.vTroco, entrada.troco, 0));
  const pagBlock = { ...(vTroco > 0 ? { vTroco: vTroco.toFixed(2) } : {}), detPag: pagamentosObj };

  return { detPag, primary, pagamentosObj, pagBlock, vTroco };
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Health check
  if (req.method === 'GET') {
    return new Response(
      JSON.stringify({ status: 'ok', service: 'fiscal-api', timestamp: new Date().toISOString() }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.json();
    const { action, empresa_id, nfce_id, nfe_id, mdfe_id } = body;

    // ========================================================================
    // ACTION: register_empresa
    // ========================================================================
    if (action === 'register_empresa') {
      const { empresa, certificate, error } = await ensureRegistered(supabase, empresa_id);

      if (error) {
        return new Response(
          JSON.stringify({ error }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`✅ Empresa ${empresa.razao_social} synced (key: ${empresa.api_key_fiscal.substring(0, 8)}...)`);

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            api_key: empresa.api_key_fiscal,
            has_certificate: !!certificate,
          },
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========================================================================
    // ACTION: emit_nfce
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
        .select('*, nfce_itens(*)')
        .eq('id', nfce_id)
        .single();

      if (nfceError || !nfce) {
        return new Response(
          JSON.stringify({ error: 'NFC-e não encontrada', details: nfceError?.message }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Auto-register empresa (ensures api_key, syncs with PHP, loads certificate)
      const { empresa, certificate, error: regError } = await ensureRegistered(supabase, nfce.empresa_id);

      if (regError || !empresa) {
        return new Response(
          JSON.stringify({ error: regError || 'Empresa não encontrada' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update status to processing
      await supabase.from('nfce').update({ status: 'processando' }).eq('id', nfce_id);

      // Build payload for PHP
      const clientePayload = buildNfceClientePayload(nfce.payload_entrada?.cliente, empresa.ambiente);

      const itensObj: Record<string, any> = {};
      (nfce.nfce_itens || []).forEach((item: any, idx: number) => {
        const qtd = Number(item.quantidade) || 0;
        const vUnit = Number(item.valor_unitario) || 0;
        const vTotal = Number(item.valor_total) || +(qtd * vUnit).toFixed(2);
        const cstPis = item.cst_pis || '49';
        const cstCofins = item.cst_cofins || '49';
        const aliqPis = Number(item.aliquota_pis) || 0;
        const aliqCofins = Number(item.aliquota_cofins) || 0;
        const aliqIcms = Number(item.aliquota_icms) || 0;

        // PHP/sped-nfe: envia todos os aliases para garantir que <xProd> e <cProd>
        // sejam preenchidos sempre com os dados reais recebidos do cliente.
        const descProduto = String(item.descricao ?? '').trim() || 'PRODUTO';
        const codProduto = String(item.codigo_produto ?? '').trim() || String(idx + 1).padStart(3, '0');
        itensObj[String(idx)] = {
          // Descrição (todos os aliases conhecidos)
          descricao: descProduto,
          descricao_produto: descProduto,
          nome: descProduto,
          produto: descProduto,
          xProd: descProduto,
          quantidade: qtd,
          valor_unitario: vUnit,
          // PHP exige valor_total para montar <vProd>; enviar também aliases por segurança
          valor_total: vTotal,
          valor_bruto: vTotal,
          // Código do produto (todos os aliases conhecidos)
          codigo: codProduto,
          codigo_produto: codProduto,
          cProd: codProduto,
          ncm: item.ncm,
          cfop: item.cfop,
          unidade: item.unidade,
          uCom: item.unidade,
          uTrib: item.unidade,
          // ICMS (regime simples → CSOSN; regime normal → CST)
          cst_icms: item.cst_icms,
          csosn: item.csosn,
          aliquota_icms: aliqIcms,
          base_calculo_icms: vTotal,
          valor_icms: +((vTotal * aliqIcms) / 100).toFixed(2),
          // PIS
          cst_pis: cstPis,
          aliquota_pis: aliqPis,
          base_calculo_pis: vTotal,
          valor_pis: +((vTotal * aliqPis) / 100).toFixed(2),
          // COFINS
          cst_cofins: cstCofins,
          aliquota_cofins: aliqCofins,
          base_calculo_cofins: vTotal,
          valor_cofins: +((vTotal * aliqCofins) / 100).toFixed(2),
        };
      });

      const tpAmb = empresa.ambiente === 'producao' ? 1 : 2;
      const { detPag: pagArray, primary: primaryPayment, pagamentosObj, pagBlock, vTroco } = buildNfcePaymentPayload(nfce);
      const payload: any = {
        api_key: empresa.api_key_fiscal,
        ind_sinc: 1,
        tpAmb,
        siglaUF: empresa.uf,
        CSC: empresa.csc_token || '',
        CSCid: empresa.csc_id || '',
        sped_config: {
          tpAmb,
          siglaUF: empresa.uf,
          CSC: empresa.csc_token || '',
          CSCid: empresa.csc_id || '',
          razaosocial: empresa.razao_social,
          cnpj: (empresa.cnpj || '').replace(/\D/g, ''),
        },
        // Pagamento também no top-level em formato plano e estruturado.
        // O PHP legado lia forma_pagamento no topo; se isso não existir ele força dinheiro.
        tPag: primaryPayment.tPag,
        forma_pagamento: primaryPayment.tPag,
        tipo_pagamento: primaryPayment.tPag,
        vPag: primaryPayment.vPag,
        valor_pagamento: primaryPayment.vPag,
        valor_pago: primaryPayment.vPag,
        tpIntegra: primaryPayment.tpIntegra,
        tipo_integracao: primaryPayment.tpIntegra,
        CNPJ: primaryPayment.CNPJ,
        cnpj_credenciadora: primaryPayment.cnpj_credenciadora,
        tBand: primaryPayment.tBand,
        bandeira_operadora: primaryPayment.bandeira_operadora,
        cAut: primaryPayment.cAut,
        numero_autorizacao: primaryPayment.numero_autorizacao,
        NSU: primaryPayment.NSU,
        nsu: primaryPayment.nsu,
        pag: pagBlock,
        pagamentos: pagamentosObj,
        pagamento: primaryPayment,
        formas_pagamento: pagamentosObj,
        detPag: pagamentosObj,
        nota: {
          numero: parseInt(nfce.numero, 10).toString(),
          serie: parseInt(nfce.serie, 10).toString(),
          valor_total: nfce.valor_total,
          tPag: primaryPayment.tPag,
          forma_pagamento: primaryPayment.tPag,
          tipo_pagamento: primaryPayment.tPag,
          vPag: primaryPayment.vPag,
          valor_pagamento: primaryPayment.vPag,
          valor_pago: primaryPayment.vPag,
          tpIntegra: primaryPayment.tpIntegra,
          tipo_integracao: primaryPayment.tpIntegra,
          CNPJ: primaryPayment.CNPJ,
          cnpj_credenciadora: primaryPayment.cnpj_credenciadora,
          tBand: primaryPayment.tBand,
          bandeira_operadora: primaryPayment.bandeira_operadora,
          cAut: primaryPayment.cAut,
          numero_autorizacao: primaryPayment.numero_autorizacao,
          NSU: primaryPayment.NSU,
          nsu: primaryPayment.nsu,
          ...((clientePayload?.cpf || clientePayload?.cnpj) ? { cliente: clientePayload } : {}),
          itens: itensObj,
          // Pagamento em todos os formatos/aliases conhecidos do PHP/sped-nfe
          pag: pagBlock,
          pagamentos: pagamentosObj,
          pagamento: primaryPayment,
          formas_pagamento: pagamentosObj,
          detPag: pagamentosObj,
          // Manter também versão objeto-indexada (algumas versões do PHP exigem)
          pagamentos_obj: pagamentosObj,
          ...(vTroco > 0 ? { vTroco: vTroco.toFixed(2), troco: vTroco.toFixed(2) } : {}),
        },
      };

      // Always include certificate in emission payload
      if (certificate) {
        payload.certificado = {
          pfx_base64: certificate.base64,
          senha: certificate.senha,
        };
      }

      console.log(`📡 Emitting NFC-e ${nfce.numero} via fiscal API...`);
      console.log(`   pag payload: ${JSON.stringify(pagBlock)}`);

      const emitUrl = `${FISCAL_API_BASE_URL}/nfce/emitir?api_key=${encodeURIComponent(empresa.api_key_fiscal)}`;
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
      console.log(`📡 NFC-e emit response (${response.status}):`, responseText.substring(0, 500));

      let responseData: any;
      try {
        responseData = JSON.parse(responseText);
      } catch {
        console.error('❌ Non-JSON response:', responseText.substring(0, 300));
        await supabase.from('nfce').update({
          status: 'rejeitada',
          erro_processamento: `API fiscal retornou resposta inválida (status ${response.status})`,
          motivo_retorno: responseText.substring(0, 500),
        }).eq('id', nfce_id);

        await supabase.rpc('registrar_log', {
          p_empresa_id: nfce.empresa_id,
          p_nfce_id: nfce_id,
          p_token_api_id: nfce.token_api_id || empresa.id,
          p_tipo: 'erro',
          p_categoria: 'emissao',
          p_mensagem: `NFC-e ${nfce.numero}: resposta não-JSON (status ${response.status})`,
          p_detalhes: { raw_response: responseText.substring(0, 500) },
        });

        return new Response(
          JSON.stringify({ error: 'API fiscal retornou resposta inválida', details: responseText.substring(0, 300) }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!response.ok) {
        await supabase.from('nfce').update({
          status: 'rejeitada',
          erro_processamento: responseData.error || 'Erro na API fiscal',
          motivo_retorno: JSON.stringify(responseData),
        }).eq('id', nfce_id);

        await supabase.rpc('registrar_log', {
          p_empresa_id: nfce.empresa_id,
          p_nfce_id: nfce_id,
          p_token_api_id: nfce.token_api_id || empresa.id,
          p_tipo: 'erro',
          p_categoria: 'emissao',
          p_mensagem: `Erro NFC-e ${nfce.numero}: ${responseData.error || 'Erro desconhecido'}`,
          p_detalhes: responseData,
        });

        return new Response(
          JSON.stringify({ error: 'Erro na emissão fiscal', details: responseData }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Success - update NFC-e
      const updateData = buildNfUpdateData(responseData);

      // Extract QR Code from XML if not present
      if (!updateData.qrcode_url && updateData.xml_retorno) {
        try {
          let xmlStr = updateData.xml_retorno;
          if (!xmlStr.startsWith('<') && !xmlStr.startsWith('<?')) xmlStr = atob(xmlStr);
          const qrMatch = xmlStr.match(/<qrCode>(.*?)<\/qrCode>/);
          if (qrMatch?.[1]) updateData.qrcode_url = qrMatch[1];
          if (!updateData.data_autorizacao) {
            const dhMatch = xmlStr.match(/<dhRecbto>(.*?)<\/dhRecbto>/);
            if (dhMatch?.[1]) updateData.data_autorizacao = dhMatch[1];
          }
        } catch {}
      }

      await supabase.from('nfce').update(updateData).eq('id', nfce_id);

      await supabase.rpc('registrar_log', {
        p_empresa_id: nfce.empresa_id,
        p_nfce_id: nfce_id,
        p_token_api_id: nfce.token_api_id || empresa.id,
        p_tipo: 'sucesso',
        p_categoria: 'emissao',
        p_mensagem: `NFC-e ${nfce.numero} ${updateData.status} via API fiscal`,
        p_detalhes: { protocolo: updateData.protocolo, chave_acesso: updateData.chave_acesso, qrcode_url: updateData.qrcode_url },
      });

      // Dispatch webhook
      try {
        const evento = updateData.status === 'autorizada' ? 'nfce.autorizada' :
                       updateData.status === 'rejeitada' ? 'nfce.rejeitada' : 'nfce.processando';
        await supabase.functions.invoke('send-webhook', { body: { nfce_id, evento } });
      } catch {}

      return new Response(
        JSON.stringify({ success: true, data: { ...updateData, id: nfce_id } }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========================================================================
    // ACTION: emit_nfe
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
        .select('*, nfe_itens(*)')
        .eq('id', nfeId)
        .single();

      if (nfeError || !nfe) {
        return new Response(
          JSON.stringify({ error: 'NF-e não encontrada', details: nfeError?.message }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Auto-register empresa
      const { empresa, certificate, error: regError } = await ensureRegistered(supabase, nfe.empresa_id);

      if (regError || !empresa) {
        return new Response(
          JSON.stringify({ error: regError || 'Empresa não encontrada' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update status to processing
      await supabase.from('nfe').update({ status: 'processando' }).eq('id', nfeId);

      const isPF = empresa.tipo_pessoa === 'PF';
      const empresaCRT = ({ simples_nacional: 1, lucro_presumido: 3, lucro_real: 3 } as Record<string, number>)[empresa.regime_tributario] || 1;
      const isSimples = empresaCRT === 1 || empresaCRT === 4;

      // Build items with full tax data
      const itensObj: Record<string, any> = {};
      (nfe.nfe_itens || []).forEach((item: any, idx: number) => {
        const descProduto = String(item.descricao ?? '').trim();
        const codProduto = String(item.codigo_produto ?? item.codigo ?? '').trim();
        if (!descProduto || !codProduto) {
          throw new Error(`NF-e ${nfe.numero}: item ${idx + 1} sem código ou descrição do produto no payload original`);
        }
        const forbiddenTestProductPattern = new RegExp(['produto', 'teste'].join('\\s*'), 'i');
        if (forbiddenTestProductPattern.test(descProduto)) {
          throw new Error(`NF-e ${nfe.numero}: item ${idx + 1} contém descrição genérica de teste proibida`);
        }
        const quantidade = Number(item.quantidade) || 0;
        const valorUnitario = Number(item.valor_unitario) || 0;
        const valorTotal = Number(item.valor_total ?? quantidade * valorUnitario);
        const unidade = String(item.unidade || 'UN').trim();
        const itemData: any = {
          descricao: descProduto,
          descricao_produto: descProduto,
          nome_produto: descProduto,
          produto: descProduto,
          xProd: descProduto,
          quantidade,
          qCom: quantidade,
          qTrib: quantidade,
          valor_unitario: valorUnitario,
          vUnCom: valorUnitario,
          vUnTrib: valorUnitario,
          valor_total: valorTotal,
          vProd: valorTotal,
          codigo: codProduto,
          codigo_produto: codProduto,
          cod_produto: codProduto,
          cProd: codProduto,
          ncm: item.ncm,
          NCM: item.ncm,
          cfop: item.cfop,
          CFOP: item.cfop,
          unidade,
          uCom: unidade,
          uTrib: unidade,
          // Códigos de barras (cEAN/cEANTrib): "SEM" quando ausente (exigência NT 2016)
          cean: item.cean || 'SEM GTIN',
          cEAN: item.cean || 'SEM GTIN',
          cean_trib: item.cean_trib || item.cean || 'SEM GTIN',
          cEANTrib: item.cean_trib || item.cean || 'SEM GTIN',
          ...(item.ex_tipi ? { ex_tipi: item.ex_tipi, EXTIPI: item.ex_tipi } : {}),
          ...(item.cest ? { cest: item.cest, CEST: item.cest } : {}),
          ...(item.cnpj_fab ? { cnpj_fab: item.cnpj_fab, CNPJFab: item.cnpj_fab } : {}),
          ...(item.ind_escala ? { ind_escala: item.ind_escala, indEscala: item.ind_escala } : {}),
          ...(item.inf_ad_prod ? { inf_ad_prod: item.inf_ad_prod, infAdProd: item.inf_ad_prod } : {}),
          // ICMS: regime Simples (CRT 1/4) usa CSOSN; regime Normal (CRT 3) usa CST
          crt: empresaCRT,
          CRT: empresaCRT,
          orig: item.origem ?? '0',
          ...(isSimples
            ? {
                csosn: item.csosn || '102',
                CSOSN: item.csosn || '102',
                icms: { orig: item.origem ?? '0', CSOSN: item.csosn || '102', pCredSN: item.aliquota_icms || 0, vCredICMSSN: item.valor_icms || 0 },
              }
            : {
                cst_icms: item.cst_icms || '00',
                cst: item.cst_icms || '00',
                CST: item.cst_icms || '00',
                icms: {
                  orig: item.origem ?? '0',
                  CST: item.cst_icms || '00',
                  modBC: '0',
                  vBC: item.base_calculo_icms || item.valor_total || 0,
                  pICMS: item.aliquota_icms || 0,
                  vICMS: item.valor_icms || +(((item.base_calculo_icms || item.valor_total || 0) * (item.aliquota_icms || 0)) / 100).toFixed(2),
                },
              }),
          aliquota_icms: item.aliquota_icms,
          base_calculo_icms: item.base_calculo_icms || item.valor_total || 0,
          // ICMS extras (suporte completo a todos CSTs/CSOSNs)
          p_red_bc: item.p_red_bc || 0,
          pRedBC: item.p_red_bc || 0,
          mod_bc: item.mod_bc || '3',
          modBC: item.mod_bc || '3',
          p_diferimento: item.p_diferimento || 0,
          pDif: item.p_diferimento || 0,
          valor_icms_op: item.valor_icms_op || 0,
          vICMSOp: item.valor_icms_op || 0,
          valor_icms_dif: item.valor_icms_dif || 0,
          motivo_desoneracao: item.motivo_desoneracao || null,
          motDesICMS: item.motivo_desoneracao || null,
          valor_icms_desonerado: item.valor_icms_desonerado || 0,
          vICMSDeson: item.valor_icms_desonerado || 0,
          p_cred_sn: item.p_cred_sn || 0,
          pCredSN: item.p_cred_sn || 0,
          valor_cred_icms_sn: item.valor_cred_icms_sn || 0,
          vCredICMSSN: item.valor_cred_icms_sn || 0,
          aliquota_fcp: item.aliquota_fcp || 0,
          // ICMS-ST
          base_calculo_icms_st: item.base_calculo_icms_st || 0,
          vBCST: item.base_calculo_icms_st || 0,
          aliquota_icms_st: item.aliquota_icms_st || 0,
          pICMSST: item.aliquota_icms_st || 0,
          mva_icms_st: item.mva_icms_st || 0,
          pMVAST: item.mva_icms_st || 0,
          p_red_bc_st: item.p_red_bc_st || 0,
          pRedBCST: item.p_red_bc_st || 0,
          mod_bc_st: item.mod_bc_st || '4',
          modBCST: item.mod_bc_st || '4',
          valor_icms_st: item.valor_icms_st || 0,
          vICMSST: item.valor_icms_st || 0,
          cst_ipi: item.cst_ipi || '99',
          aliquota_ipi: item.aliquota_ipi ?? 0,
          base_calculo_ipi: item.base_calculo_ipi || item.valor_total || 0,
          valor_ipi: item.valor_ipi ?? +(((item.base_calculo_ipi || item.valor_total || 0) * (item.aliquota_ipi || 0)) / 100).toFixed(2),
          vIPI: item.valor_ipi ?? +(((item.base_calculo_ipi || item.valor_total || 0) * (item.aliquota_ipi || 0)) / 100).toFixed(2),
          valor_ipi_total: item.valor_ipi ?? +(((item.base_calculo_ipi || item.valor_total || 0) * (item.aliquota_ipi || 0)) / 100).toFixed(2),
          c_enq_ipi: item.c_enq_ipi || '999',
          cEnq: item.c_enq_ipi || '999',
          cst_pis: item.cst_pis || '99',
          aliquota_pis: item.aliquota_pis ?? 0,
          base_calculo_pis: item.base_calculo_pis || item.valor_total || 0,
          cst_cofins: item.cst_cofins || '99',
          aliquota_cofins: item.aliquota_cofins ?? 0,
          base_calculo_cofins: item.base_calculo_cofins || item.valor_total || 0,
          // PHP NFePHP field names
          vBC_pis: item.base_calculo_pis || valorTotal || 0,
          pPIS: item.aliquota_pis ?? 0,
          vPIS: item.valor_pis ?? 0,
          vBC_cofins: item.base_calculo_cofins || valorTotal || 0,
          pCOFINS: item.aliquota_cofins ?? 0,
          vCOFINS: item.valor_cofins ?? 0,
          vBC_icms: item.base_calculo_icms || valorTotal || 0,
        };

        // IBS/CBS (Reforma Tributária)
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

        if (item.ind_bem_movel_usado) itemData.indBemMovelUsado = item.ind_bem_movel_usado;

        itensObj[String(idx)] = itemData;
      });

      // Build destinatário
      const clientePayload: any = {};
      if (nfe.dest_cpf_cnpj) {
        const doc = nfe.dest_cpf_cnpj.replace(/\D/g, '');
        if (doc.length > 11) clientePayload.cnpj = doc;
        else clientePayload.cpf = doc;
      }
      if (nfe.dest_nome) clientePayload.nome = nfe.dest_nome;
      const ieClean = nfe.dest_ie ? nfe.dest_ie.replace(/\D/g, '') : null;
      if (ieClean) clientePayload.ie = ieClean;
      if (nfe.dest_email) clientePayload.email = nfe.dest_email;
      clientePayload.indIEDest = ieClean ? 1 : 9;
      if (nfe.dest_logradouro) {
        clientePayload.logradouro = nfe.dest_logradouro;
        clientePayload.numero = nfe.dest_numero || 'SN';
        clientePayload.bairro = nfe.dest_bairro || '';
        clientePayload.cMun = nfe.dest_codigo_municipio || '';
        clientePayload.xMun = nfe.dest_municipio || '';
        clientePayload.uf = nfe.dest_uf || '';
        clientePayload.cep = (nfe.dest_cep || '').replace(/\D/g, '');
      }

      // Build pagamentos (NT2016/v4: <pag> obrigatório em NF-e modelo 55)
      const { detPag: nfePagArray, primary: nfePrimaryPag, pagamentosObj: nfePagObj, pagBlock: nfePagBlock, vTroco: nfeVTroco } = buildPaymentPayload(nfe);

      // Cobrança / duplicatas (<cobr>) — necessário p/ tPag=15 (boleto) com indPag=1 (a prazo)
      const cobrancaSrc = nfe.payload_entrada?.cobranca || nfe.payload_entrada?.cobr || null;
      let cobrancaPayload: any = null;
      if (cobrancaSrc) {
        const dupListRaw = Array.isArray(cobrancaSrc.dup)
          ? cobrancaSrc.dup
          : (Array.isArray(cobrancaSrc.duplicatas) ? cobrancaSrc.duplicatas : []);
        const dupList = dupListRaw.map((d: any, i: number) => ({
          nDup: String(d?.nDup ?? d?.numero ?? String(i + 1).padStart(3, '0')).padStart(3, '0').slice(-3),
          dVenc: d?.dVenc ?? d?.data_vencimento ?? d?.vencimento,
          vDup: Number(d?.vDup ?? d?.valor ?? 0).toFixed(2),
        })).filter((d: any) => d.dVenc && Number(d.vDup) > 0);

        const fatSrc = cobrancaSrc.fat || cobrancaSrc.fatura || {};
        const vOrig = Number(fatSrc.vOrig ?? fatSrc.valor_original ?? nfe.valor_total ?? 0);
        const vDesc = Number(fatSrc.vDesc ?? fatSrc.valor_desconto ?? 0);
        const vLiq = Number(fatSrc.vLiq ?? fatSrc.valor_liquido ?? (vOrig - vDesc));
        const fat = {
          nFat: String(fatSrc.nFat ?? fatSrc.numero ?? nfe.numero).slice(-60),
          vOrig: vOrig.toFixed(2),
          vDesc: vDesc.toFixed(2),
          vLiq: vLiq.toFixed(2),
        };
        // formato múltiplo p/ compat. NFePHP / PHP legado
        const dupObj = Object.fromEntries(dupList.map((d: any, i: number) => [String(i + 1), d]));
        cobrancaPayload = {
          fat,
          dup: dupList,
          duplicatas: dupObj,
          fatura: fat,
        };
      }


      // ===== Blocos adicionais (ide extras, entrega, transp, infAdic, infRespTec) =====
      const payloadEntrada = nfe.payload_entrada || {};

      // ide opcionais
      const ideExtras: any = {};
      if (nfe.dh_sai_ent) ideExtras.dhSaiEnt = nfe.dh_sai_ent;
      if (nfe.id_dest != null) ideExtras.idDest = nfe.id_dest;
      if (nfe.ind_final != null) ideExtras.indFinal = nfe.ind_final;
      if (nfe.ind_pres != null) ideExtras.indPres = nfe.ind_pres;
      if (nfe.tp_nf != null) ideExtras.tpNF = nfe.tp_nf;
      Object.assign(ideExtras, payloadEntrada.ide || {});

      // Endereço de entrega (quando diferente do destinatário) — aceita aliases ERP
      const entregaSrc = nfe.entrega || payloadEntrada.entrega || payloadEntrada.endereco_entrega || null;
      const _entregaHasContent = entregaSrc && (entregaSrc.logradouro || entregaSrc.xLgr || entregaSrc.municipio || entregaSrc.xMun || entregaSrc.cep || entregaSrc.CEP);
      const _entregaRawDoc = entregaSrc ? String(entregaSrc.cnpj || entregaSrc.CNPJ || entregaSrc.cpf || entregaSrc.CPF || entregaSrc.cpf_cnpj || '').replace(/\D/g, '') : '';
      const _destDocClean = String(nfe.dest_cpf_cnpj || '').replace(/\D/g, '');
      const _entregaDocFinal = _entregaRawDoc || _destDocClean;
      const entregaPayload = _entregaHasContent && _entregaDocFinal
        ? {
            ...(_entregaDocFinal.length === 14 ? { CNPJ: _entregaDocFinal } : {}),
            ...(_entregaDocFinal.length === 11 ? { CPF: _entregaDocFinal } : {}),
            xNome: entregaSrc.nome || entregaSrc.xNome || nfe.dest_nome,
            xLgr: entregaSrc.logradouro || entregaSrc.xLgr,
            nro: entregaSrc.numero || entregaSrc.nro || 'SN',
            xCpl: entregaSrc.complemento || entregaSrc.xCpl,
            xBairro: entregaSrc.bairro || entregaSrc.xBairro,
            cMun: entregaSrc.codigo_municipio || entregaSrc.cMun,
            xMun: entregaSrc.municipio || entregaSrc.xMun,
            UF: entregaSrc.uf || entregaSrc.UF,
            CEP: String(entregaSrc.cep || entregaSrc.CEP || '').replace(/\D/g, ''),
          }
        : null;

      // Transporte (transp + veicTransp + vol) — aceita aliases vindos do ERP (transportador, transportadora, flat)
      const transpSrc = nfe.transporte || payloadEntrada.transporte || payloadEntrada.transp || payloadEntrada.transportador || payloadEntrada.transportadora || null;
      let transpPayload: any = null;
      if (transpSrc) {
        const t: any = { modFrete: String(transpSrc.modFrete ?? transpSrc.mod_frete ?? nfe.modalidade_frete ?? '9') };
        // Aceita {transportadora:{...}}, {transporta:{...}} ou estrutura plana
        const tr = transpSrc.transportadora || transpSrc.transporta || (
          (transpSrc.cnpj || transpSrc.CNPJ || transpSrc.cpf || transpSrc.CPF || transpSrc.cnpj_cpf || transpSrc.razao_social || transpSrc.nome || transpSrc.xNome)
            ? transpSrc
            : null
        );
        if (tr) {
          const trDoc = String(tr.cnpj || tr.CNPJ || tr.cpf || tr.CPF || tr.cnpj_cpf || '').replace(/\D/g, '');
          t.transporta = {
            ...(trDoc.length === 14 ? { CNPJ: trDoc } : {}),
            ...(trDoc.length === 11 ? { CPF: trDoc } : {}),
            xNome: tr.razao_social || tr.nome || tr.xNome,
            ...(tr.ie || tr.IE || tr.inscricao_estadual ? { IE: String(tr.ie || tr.IE || tr.inscricao_estadual).replace(/\D/g, '') } : {}),
            xEnder: tr.endereco || tr.xEnder,
            xMun: tr.municipio || tr.cidade || tr.xMun,
            UF: tr.uf || tr.UF,
          };
        }
        // Veículo — aninhado {veiculo:{}} ou flat (placa_veiculo, uf_veiculo, rntc)
        const veic = transpSrc.veiculo || transpSrc.veicTransp || (
          (transpSrc.placa || transpSrc.placa_veiculo)
            ? { placa: transpSrc.placa || transpSrc.placa_veiculo, uf: transpSrc.uf_veiculo || transpSrc.uf, rntc: transpSrc.rntc || transpSrc.RNTC }
            : null
        );
        if (veic?.placa) {
          t.veicTransp = {
            placa: String(veic.placa).replace(/[^A-Z0-9]/gi, '').toUpperCase(),
            UF: veic.uf || veic.UF,
            ...(veic.rntc || veic.RNTC ? { RNTC: veic.rntc || veic.RNTC } : {}),
          };
        }
        const vols = Array.isArray(transpSrc.volumes) ? transpSrc.volumes : (transpSrc.vol ? [transpSrc.vol] : []);
        if (vols.length) {
          t.vol = vols.map((v: any) => ({
            ...(v.qVol || v.quantidade ? { qVol: v.qVol || v.quantidade } : {}),
            ...(v.esp || v.especie ? { esp: v.esp || v.especie } : {}),
            ...(v.marca ? { marca: v.marca } : {}),
            ...(v.nVol || v.numeracao ? { nVol: v.nVol || v.numeracao } : {}),
            ...(v.pesoL || v.peso_liquido ? { pesoL: Number(v.pesoL || v.peso_liquido).toFixed(3) } : {}),
            ...(v.pesoB || v.peso_bruto ? { pesoB: Number(v.pesoB || v.peso_bruto).toFixed(3) } : {}),
          }));
        }
        transpPayload = t;
      }

      // Informações adicionais — aceita vários aliases comuns do ERP
      const infAdicPayload: any = {};
      const _infCpl = nfe.inf_cpl
        || payloadEntrada.inf_cpl
        || payloadEntrada.infCpl
        || payloadEntrada.informacoes_complementares
        || payloadEntrada.informacoes_adicionais_contribuinte
        || payloadEntrada.informacoes_adicionais
        || payloadEntrada.info_adicional
        || payloadEntrada.observacoes
        || null;
      const _infAdFisco = nfe.inf_ad_fisco
        || payloadEntrada.inf_ad_fisco
        || payloadEntrada.infAdFisco
        || payloadEntrada.informacoes_adicionais_fisco
        || null;
      if (_infCpl) infAdicPayload.infCpl = String(_infCpl);
      if (_infAdFisco) infAdicPayload.infAdFisco = String(_infAdFisco);

      // Responsável Técnico (RS exige) — nota > empresa > payload
      const rtSrc = nfe.resp_tec || payloadEntrada.resp_tec || payloadEntrada.infRespTec || (
        empresa.resp_tec_cnpj ? {
          cnpj: empresa.resp_tec_cnpj,
          contato: empresa.resp_tec_contato,
          email: empresa.resp_tec_email,
          fone: empresa.resp_tec_fone,
        } : null
      );
      const respTecPayload = rtSrc && (rtSrc.cnpj || rtSrc.CNPJ) ? {
        CNPJ: (rtSrc.cnpj || rtSrc.CNPJ).replace(/\D/g, ''),
        xContato: (rtSrc.contato || rtSrc.xContato || '').toString().slice(0, 60),
        email: rtSrc.email,
        fone: (rtSrc.fone || rtSrc.telefone || '').toString().replace(/\D/g, ''),
      } : null;

      const payload: any = {
        api_key: empresa.api_key_fiscal,
        ind_sinc: 1,
        modelo: 55,
        tipo_pessoa: isPF ? 'PF' : 'PJ',
        crt: empresaCRT,
        CRT: empresaCRT,
        regime_tributario: empresa.regime_tributario,
        cMun: empresa.codigo_municipio || '',
        xMun: empresa.municipio || '',
        codigo_municipio: empresa.codigo_municipio || '',
        municipio: empresa.municipio || '',
        nota: {
          numero: parseInt(nfe.numero, 10).toString(),
          serie: parseInt(nfe.serie, 10).toString(),
          crt: empresaCRT,
          CRT: empresaCRT,
          valor_total: nfe.valor_total,
          // vProd em <total> = somatório de vProd dos itens (SEFAZ regra W16/528)
          valor_total_produtos: Number(nfe.valor_produtos ?? Object.values(itensObj).reduce((s: number, it: any) => s + (Number(it.valor_total) || 0), 0)),
          valor_produtos: Number(nfe.valor_produtos ?? Object.values(itensObj).reduce((s: number, it: any) => s + (Number(it.valor_total) || 0), 0)),
          vProd: Number(nfe.valor_produtos ?? Object.values(itensObj).reduce((s: number, it: any) => s + (Number(it.valor_total) || 0), 0)),
          // Bloco <total><ICMSTot> explícito (NFePHP)
          total: {
            ICMSTot: {
              vBC: Number(nfe.valor_produtos || 0).toFixed(2),
              vICMS: Number(nfe.valor_icms || 0).toFixed(2),
              vICMSDeson: 0,
              vFCP: 0,
              vBCST: 0,
              vST: 0,
              vFCPST: 0,
              vFCPSTRet: 0,
              vProd: Number(nfe.valor_produtos || 0).toFixed(2),
              vFrete: Number(nfe.valor_frete || 0).toFixed(2),
              vSeg: Number(nfe.valor_seguro || 0).toFixed(2),
              vDesc: Number(nfe.valor_desconto || 0).toFixed(2),
              vII: 0,
              vIPI: Number(nfe.valor_ipi || 0).toFixed(2),
              vIPIDevol: 0,
              vPIS: Number(nfe.valor_pis || 0).toFixed(2),
              vCOFINS: Number(nfe.valor_cofins || 0).toFixed(2),
              vOutro: Number(nfe.valor_outras_despesas || 0).toFixed(2),
              vNF: Number(nfe.valor_total || 0).toFixed(2),
              vTotTrib: 0,
            },
          },
          natureza_operacao: nfe.natureza_operacao || 'VENDA',
          finalidade: nfe.finalidade || '1',
          modalidade_frete: nfe.modalidade_frete || '9',
          cliente: clientePayload,
          itens: itensObj,
          // Pagamentos (formatos múltiplos para compat. com PHP legado/NFePHP)
          pag: nfePagBlock,
          pagamentos: nfePagObj,
          pagamento: nfePrimaryPag,
          formas_pagamento: nfePagObj,
          detPag: nfePagObj,
          tPag: nfePrimaryPag.tPag,
          vPag: nfePrimaryPag.vPag,
          forma_pagamento: nfePrimaryPag.tPag,
          ...(nfeVTroco > 0 ? { vTroco: nfeVTroco.toFixed(2), troco: nfeVTroco.toFixed(2) } : {}),
          // Cobrança / duplicatas
          ...(cobrancaPayload ? {
            cobranca: cobrancaPayload,
            cobr: cobrancaPayload,
            fatura: cobrancaPayload.fat,
            duplicatas: cobrancaPayload.duplicatas,
          } : {}),
          // Reforma Tributária
          ...(nfe.d_prev_entrega ? { dPrevEntrega: nfe.d_prev_entrega } : {}),
          ...(nfe.c_mun_fg_ibs ? { cMunFGIBS: nfe.c_mun_fg_ibs } : {}),
          ...(nfe.tp_nf_debito ? { tpNFDebito: nfe.tp_nf_debito } : {}),
          ...(nfe.tp_nf_credito ? { tpNFCredito: nfe.tp_nf_credito } : {}),
          ...(nfe.ind_intermed != null ? { indIntermed: nfe.ind_intermed } : {}),
          ...(nfe.tp_ente_gov != null ? { gCompraGov: { tpEnteGov: nfe.tp_ente_gov, tpOperGov: nfe.tp_oper_gov, pRedutor: nfe.p_redutor_gov || 0 } } : {}),
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
          // ide extras (dhSaiEnt, idDest, indFinal, indPres, tpNF)
          ...ideExtras,
          ide: ideExtras,
          // Entrega (endereço diferente do destinatário)
          ...(entregaPayload ? { entrega: entregaPayload } : {}),
          // Transporte completo
          ...(transpPayload ? { transp: transpPayload, transporte: transpPayload } : {}),
          // Informações adicionais
          ...(Object.keys(infAdicPayload).length ? { infAdic: infAdicPayload, ...infAdicPayload } : {}),
          // Responsável Técnico
          ...(respTecPayload ? { infRespTec: respTecPayload, resp_tec: respTecPayload, responsavel_tecnico: respTecPayload } : {}),
        },
        // Pagamento também no nível raiz (PHP legado lê do topo)
        pag: nfePagBlock,
        pagamentos: nfePagObj,
        pagamento: nfePrimaryPag,
        formas_pagamento: nfePagObj,
        detPag: nfePagObj,
        tPag: nfePrimaryPag.tPag,
        vPag: nfePrimaryPag.vPag,
        forma_pagamento: nfePrimaryPag.tPag,
        ...(cobrancaPayload ? {
          cobranca: cobrancaPayload,
          cobr: cobrancaPayload,
          fatura: cobrancaPayload.fat,
          duplicatas: cobrancaPayload.duplicatas,
        } : {}),
        // Blocos adicionais também no nível raiz p/ compat. PHP legado
        ...(entregaPayload ? { entrega: entregaPayload } : {}),
        ...(transpPayload ? { transp: transpPayload, transporte: transpPayload } : {}),
        ...(Object.keys(infAdicPayload).length ? { infAdic: infAdicPayload, ...infAdicPayload } : {}),
        ...(respTecPayload ? { infRespTec: respTecPayload, resp_tec: respTecPayload, responsavel_tecnico: respTecPayload } : {}),
        ...ideExtras,
        valor_total_produtos: Number(nfe.valor_produtos ?? Object.values(itensObj).reduce((s: number, it: any) => s + (Number(it.valor_total) || 0), 0)),
        valor_produtos: Number(nfe.valor_produtos ?? Object.values(itensObj).reduce((s: number, it: any) => s + (Number(it.valor_total) || 0), 0)),
        vProd: Number(nfe.valor_produtos ?? Object.values(itensObj).reduce((s: number, it: any) => s + (Number(it.valor_total) || 0), 0)),
        emitente: {
          CRT: empresaCRT,
          crt: empresaCRT,
          cMun: empresa.codigo_municipio || '',
          xMun: empresa.municipio || '',
          UF: empresa.uf || '',
          IE: (empresa.inscricao_estadual || '').replace(/\D/g, ''),
          ...(isPF
            ? { CPF: (empresa.cpf || '').replace(/\D/g, '') }
            : { CNPJ: (empresa.cnpj || '').replace(/\D/g, '') }),
        },
      };

      // PF: pad CPF to 14 digits for access key generation
      if (isPF) {
        const cpfClean = (empresa.cpf || '').replace(/\D/g, '');
        payload.cnpj = cpfClean.padStart(14, '0');
        payload.cpf = cpfClean;
        payload.tipo_pessoa = 'PF';
      } else {
        payload.cnpj = (empresa.cnpj || '').replace(/\D/g, '');
      }

      // Always include certificate
      if (certificate) {
        payload.certificado = {
          pfx_base64: certificate.base64,
          senha: certificate.senha,
        };
      }

      console.log(`📡 Emitting NF-e ${nfe.numero} via fiscal API (modelo 55, ${isPF ? 'PF' : 'PJ'})...`);
      console.log(`💰 vProd=${payload.nota.valor_total_produtos} vNF=${payload.nota.valor_total} total.ICMSTot.vProd=${payload.nota.total?.ICMSTot?.vProd}`);

      const emitUrl = `${FISCAL_API_BASE_URL}/nfe/emitir?api_key=${encodeURIComponent(empresa.api_key_fiscal)}`;

      // Retry automático em caso de instabilidade SEFAZ (Connection reset / Recv failure / timeout)
      const MAX_EMIT_RETRIES = 3;
      let response!: Response;
      let responseText = '';
      let lastTransient = '';
      for (let attempt = 1; attempt <= MAX_EMIT_RETRIES; attempt++) {
        response = await fetch(emitUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Api-Key': empresa.api_key_fiscal,
            'Authorization': `Bearer ${empresa.api_key_fiscal}`,
          },
          body: JSON.stringify(payload),
        });
        responseText = await response.text();
        console.log(`📡 NF-e emit response (try ${attempt}/${MAX_EMIT_RETRIES}, status ${response.status}):`, responseText.substring(0, 500));

        const isTransient = /Connection reset by peer|Recv failure|Operation timed out|Could not resolve host|SSL connect error|getaddrinfo|Empty reply from server/i.test(responseText);
        if (!isTransient || attempt === MAX_EMIT_RETRIES) break;
        lastTransient = responseText.substring(0, 200);
        const delayMs = 800 * attempt; // 0.8s, 1.6s
        console.log(`⏳ Erro transitório SEFAZ; aguardando ${delayMs}ms e retry...`);
        await new Promise(r => setTimeout(r, delayMs));
      }
      if (lastTransient && response.ok) {
        console.log(`✅ Recuperado após retry de erro transitório: ${lastTransient}`);
      }


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
      const updateData = buildNfUpdateData(responseData);

      const xmlProductNames = extractXmlProductNames(updateData.xml_retorno || responseData?.xml_retorno || responseData?.xml || responseData?.nfeProc);
      const expectedProductNames = Object.values(itensObj).map((it: any) => String(it.xProd || it.descricao || '').trim()).filter(Boolean);
      const forbiddenTestProductPattern = new RegExp(['produto', 'teste'].join('\\s*'), 'i');
      const xmlHasProdutoTeste = xmlProductNames.some((name) => forbiddenTestProductPattern.test(name));
      const xmlMissingExpectedItems = expectedProductNames.length > 0
        && !expectedProductNames.every((expected) => xmlProductNames.some((actual) => actual === expected));
      if (xmlHasProdutoTeste || xmlMissingExpectedItems) {
        await supabase.from('nfe').update({
          status: 'rejeitada',
          erro_processamento: 'Bloqueio de segurança: XML autorizado retornou itens divergentes do payload original',
          motivo_retorno: JSON.stringify({ expectedProductNames, xmlProductNames }),
        }).eq('id', nfeId);
        return new Response(
          JSON.stringify({ error: 'XML autorizado divergente dos itens originais; emissão bloqueada', expectedProductNames, xmlProductNames }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Extract data_autorizacao from XML if not present
      if (!updateData.data_autorizacao && updateData.xml_retorno) {
        try {
          let xmlStr = updateData.xml_retorno;
          if (!xmlStr.startsWith('<')) xmlStr = atob(xmlStr);
          const dhMatch = xmlStr.match(/<dhRecbto>(.*?)<\/dhRecbto>/);
          if (dhMatch) updateData.data_autorizacao = dhMatch[1];
        } catch {}
      }

      await supabase.from('nfe').update(updateData).eq('id', nfeId);

      await supabase.rpc('registrar_log', {
        p_empresa_id: nfe.empresa_id,
        p_nfce_id: nfeId,
        p_token_api_id: nfe.token_api_id || empresa.id,
        p_tipo: 'sucesso',
        p_categoria: 'emissao',
        p_mensagem: `NF-e ${nfe.numero} ${updateData.status} via API fiscal`,
        p_detalhes: { protocolo: updateData.protocolo, chave_acesso: updateData.chave_acesso, tipo: 'nfe' },
      });

      // Webhook
      try {
        const nfeEvento = updateData.status === 'autorizada' ? 'nfe.autorizada' :
                         updateData.status === 'rejeitada' ? 'nfe.rejeitada' : null;
        if (nfeEvento) {
          await supabase.functions.invoke('send-webhook', { body: { nfe_id: nfeId, evento: nfeEvento } });
        }
      } catch {}

      return new Response(
        JSON.stringify({ success: true, data: { ...updateData, id: nfeId } }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========================================================================
    // ACTION: cancel_nfce
    // ========================================================================
    if (action === 'cancel_nfce') {
      return await handleCancel(supabase, 'nfce', nfce_id);
    }

    // ========================================================================
    // ACTION: cancel_nfe
    // ========================================================================
    if (action === 'cancel_nfe') {
      return await handleCancel(supabase, 'nfe', nfe_id);
    }

    // ========================================================================
    // ACTION: cce_nfe (Carta de Correção Eletrônica)
    // ========================================================================
    if (action === 'cce_nfe') {
      return await handleCCe(supabase, nfe_id, body.correcao, body.sequencia);
    }

    // ========================================================================
    // ACTION: emit_mdfe / encerrar_mdfe / cancel_mdfe (modelo 58)
    // ========================================================================
    if (action === 'emit_mdfe') {
      return await handleMdfeEmit(supabase, mdfe_id);
    }
    if (action === 'encerrar_mdfe') {
      return await handleMdfeEncerrar(supabase, mdfe_id, body.c_mun_descarga, body.data_encerramento);
    }
    if (action === 'cancel_mdfe') {
      return await handleMdfeCancelar(supabase, mdfe_id);
    }

    // ========================================================================
    // ACTION: inutilizar_nfe (inutilização de numeração NF-e modelo 55)
    // ========================================================================
    if (action === 'inutilizar_nfe') {
      return await handleInutilizar(
        supabase,
        empresa_id,
        body.serie,
        body.numero_inicial,
        body.numero_final ?? body.numero_inicial,
        body.justificativa,
      );
    }

    // ========================================================================
    // ACTION: danfe_nfe — DANFE oficial (sped-da) a partir do XML autorizado
    // ========================================================================
    if (action === 'danfe_nfe') {
      if (!nfe_id) {
        return new Response(
          JSON.stringify({ error: 'nfe_id é obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: nfe } = await supabase
        .from('nfe')
        .select('id, numero, chave_acesso, xml_retorno, xml_envio, empresa_id')
        .eq('id', nfe_id)
        .maybeSingle();

      if (!nfe) {
        return new Response(
          JSON.stringify({ error: 'NF-e não encontrada' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const xml = normalizeXmlForDanfe(nfe.xml_retorno) || normalizeXmlForDanfe(nfe.xml_envio);
      if (!xml) {
        return new Response(
          JSON.stringify({ error: 'XML autorizado indisponível para esta NF-e' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      let phpResponse: Response;
      let phpText = '';
      try {
        phpResponse = await fetch(`${FISCAL_API_BASE_URL}/nfe/danfe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ xml, tipo: 'base64', orientacao: 'P', tamanho: 'A4', mostrar_canhoto: true }),
        });
        phpText = await phpResponse.text();
      } catch (err: any) {
        return new Response(
          JSON.stringify({ error: 'Falha ao contatar gerador DANFE', details: err?.message }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      let phpData: any;
      try { phpData = JSON.parse(phpText); } catch { phpData = { raw: phpText }; }

      if (!phpResponse.ok || !phpData?.pdf_base64) {
        console.error('❌ DANFE PHP error', phpResponse.status, phpText.substring(0, 400));
        return new Response(
          JSON.stringify({
            error: phpData?.erro || 'Gerador DANFE indisponível (endpoint /nfe/danfe não publicado no api2)',
            status: phpResponse.status,
            details: phpText.substring(0, 500),
          }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          sucesso: true,
          pdf_base64: phpData.pdf_base64,
          chave: nfe.chave_acesso,
          numero: nfe.numero,
          filename: `DANFE-${nfe.numero || nfe.chave_acesso || nfe.id}.pdf`,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Ação inválida. Use: register_empresa, emit_nfce, emit_nfe, cancel_nfce, cancel_nfe, cce_nfe, inutilizar_nfe, danfe_nfe, emit_mdfe, encerrar_mdfe, cancel_mdfe' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );


  } catch (error: any) {
    console.error('❌ Fiscal API error:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ============================================================================
// SHARED: Build update data from fiscal API response
// ============================================================================
function buildNfUpdateData(responseData: any): any {
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
  const xmlRetorno = normalizeFiscalXml(responseData.xml_retorno || responseData.xml || responseData.xmlRetorno || responseData.procNFe || responseData.nfeProc);
  const qrcodeUrl = responseData.qrcode_url || responseData.qrcode || responseData.urlQRCode || responseData.qr_code || responseData.qrCode || responseData.url_qrcode;
  const dataAutorizacao = responseData.data_autorizacao || responseData.dhRecbto || responseData.data_recebimento;

  if (chaveAcesso) updateData.chave_acesso = chaveAcesso;
  if (protocolo) updateData.protocolo = protocolo;
  if (codigoRetorno) updateData.codigo_retorno = codigoRetorno;
  if (motivoRetorno) updateData.motivo_retorno = motivoRetorno;
  if (xmlRetorno) updateData.xml_retorno = xmlRetorno;
  if (qrcodeUrl) updateData.qrcode_url = qrcodeUrl;
  if (dataAutorizacao) updateData.data_autorizacao = dataAutorizacao;

  return updateData;
}

function extractXmlCandidate(value: any): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value !== 'object') return '';

  const preferred = ['xml_retorno', 'xml', 'xmlRetorno', 'procNFe', 'nfeProc', 'xml_envio'];
  for (const key of preferred) {
    const found = extractXmlCandidate(value[key]);
    if (found) return found;
  }
  for (const nested of Object.values(value)) {
    const found = extractXmlCandidate(nested);
    if (found) return found;
  }
  return '';
}

function normalizeFiscalXml(raw: any): string {
  let xml = extractXmlCandidate(raw).trim();
  if (!xml) return '';

  if (xml.startsWith('{') || xml.startsWith('[')) {
    try { xml = extractXmlCandidate(JSON.parse(xml)).trim() || xml; } catch {}
  }

  if (xml.includes('&lt;') && !xml.includes('<NFe') && !xml.includes('<procNFe')) {
    xml = xml
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, '&');
  }

  const trimmed = xml.trim();
  const compact = trimmed.replace(/\s+/g, '');
  if (!trimmed.startsWith('<') && /^[A-Za-z0-9+/=]+$/.test(compact) && compact.length > 40) {
    try {
      const bin = atob(compact);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      xml = new TextDecoder('utf-8').decode(bytes).trim();
    } catch {
      return '';
    }
  }

  const start = xml.search(/<\?xml|<procNFe|<NFe/i);
  if (start > 0) xml = xml.slice(start);
  xml = xml.replace(/^\uFEFF/, '').trim();
  return xml.startsWith('<') ? xml : '';
}

// ============================================================================
// SHARED: Handle cancel for both NFC-e and NF-e
// ============================================================================
async function handleCancel(supabase: any, tipo: 'nfce' | 'nfe', docId: string) {
  if (!docId) {
    return new Response(
      JSON.stringify({ error: `${tipo}_id é obrigatório` }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const table = tipo;
  const eventosTable = `${tipo}_eventos`;

  const { data: doc } = await supabase
    .from(table)
    .select(`*, ${eventosTable}(*)`)
    .eq('id', docId)
    .single();

  if (!doc) {
    return new Response(
      JSON.stringify({ error: `${tipo.toUpperCase()} não encontrada` }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Auto-register to ensure api_key is synced
  const { empresa, certificate, error: regError } = await ensureRegistered(supabase, doc.empresa_id);

  if (regError || !empresa?.api_key_fiscal) {
    return new Response(
      JSON.stringify({ error: 'Empresa não registrada na API fiscal' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const eventos = doc[eventosTable] || [];
  const cancelEvento = eventos
    .filter((e: any) => e.tipo_evento === 'cancelamento')
    .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

  const justificativa = cancelEvento?.justificativa || 'Cancelamento solicitado pelo emitente';

  const cancelPayload: any = {
    api_key: empresa.api_key_fiscal,
    chave: doc.chave_acesso,
    protocolo: doc.protocolo,
    justificativa,
  };

  if (certificate) {
    cancelPayload.certificado = {
      pfx_base64: certificate.base64,
      senha: certificate.senha,
    };
  }

  const endpoint = tipo === 'nfce' ? 'nfce/cancelar' : 'nfe/cancelar';
  console.log(`📡 Cancelling ${tipo.toUpperCase()} ${doc.numero}...`);

  const { response, text: responseText, data: responseData } = await postWithRetry(
    `${FISCAL_API_BASE_URL}/${endpoint}?api_key=${encodeURIComponent(empresa.api_key_fiscal)}`,
    cancelPayload,
    { label: `Cancel ${tipo.toUpperCase()} ${doc.numero}` }
  );
  console.log(`📡 Cancel response (${response.status}):`, responseText.substring(0, 500));

  // Detect "already cancelled" (cStat 573) as success - happens when retrying
  const errStr = JSON.stringify(responseData).toLowerCase();
  const alreadyCancelled = errStr.includes('573') || errStr.includes('duplicidade de evento');

  if ((response.ok && (responseData.sucesso || responseData.success || responseData.status === 'cancelada')) || alreadyCancelled) {
    await supabase.from(table).update({ status: 'cancelada' }).eq('id', docId);

    if (cancelEvento) {
      await supabase.from(eventosTable).update({
        protocolo: responseData.protocolo || responseData.nProt || null,
        codigo_retorno: responseData.cStat || responseData.codigo_retorno || '135',
        motivo_retorno: responseData.xMotivo || responseData.motivo || 'Evento registrado e vinculado a NF-e',
        xml_retorno: responseData.xml_retorno || responseData.xml || null,
      }).eq('id', cancelEvento.id);
    }

    return new Response(
      JSON.stringify({ success: true, data: { id: docId, status: 'cancelada', ...responseData } }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ error: `Erro ao cancelar ${tipo.toUpperCase()} na SEFAZ`, details: responseData }),
    { status: response.status || 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// ============================================================================
// SHARED: Carta de Correção Eletrônica (CC-e) - apenas NF-e modelo 55
// ============================================================================
async function handleCCe(supabase: any, nfeId: string, correcao: string, sequencia?: number) {
  if (!nfeId) {
    return new Response(
      JSON.stringify({ error: 'nfe_id é obrigatório' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  if (!correcao || correcao.trim().length < 15 || correcao.trim().length > 1000) {
    return new Response(
      JSON.stringify({ error: 'Correção deve ter entre 15 e 1000 caracteres' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const { data: nfe } = await supabase
    .from('nfe')
    .select('*, nfe_eventos(*)')
    .eq('id', nfeId)
    .single();

  if (!nfe) {
    return new Response(
      JSON.stringify({ error: 'NF-e não encontrada' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  if (nfe.status !== 'autorizada') {
    return new Response(
      JSON.stringify({ error: 'CC-e só pode ser emitida para NF-e autorizada' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  if (!nfe.chave_acesso) {
    return new Response(
      JSON.stringify({ error: 'NF-e sem chave de acesso' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Determinar próxima sequência (max existente + 1) se não informada
  const cceEventos = (nfe.nfe_eventos || []).filter((e: any) => e.tipo_evento === 'carta_correcao');
  const nextSeq = sequencia && sequencia > 0
    ? sequencia
    : (cceEventos.reduce((max: number, e: any) => Math.max(max, e.sequencia || 0), 0) + 1);

  if (nextSeq > 20) {
    return new Response(
      JSON.stringify({ error: 'Limite de 20 CC-e por NF-e atingido' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const { empresa, certificate, error: regError } = await ensureRegistered(supabase, nfe.empresa_id);
  if (regError || !empresa?.api_key_fiscal) {
    return new Response(
      JSON.stringify({ error: 'Empresa não registrada na API fiscal' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Cria evento como pendente
  const { data: evento, error: insError } = await supabase
    .from('nfe_eventos')
    .insert({
      nfe_id: nfeId,
      tipo_evento: 'carta_correcao',
      sequencia: nextSeq,
      justificativa: correcao.trim(),
    })
    .select()
    .single();

  if (insError) {
    return new Response(
      JSON.stringify({ error: 'Erro ao registrar evento', details: insError.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const ccePayload: any = {
    api_key: empresa.api_key_fiscal,
    chave: nfe.chave_acesso,
    correcao: correcao.trim(),
    sequencia: nextSeq,
  };
  if (certificate) {
    ccePayload.certificado = { pfx_base64: certificate.base64, senha: certificate.senha };
  }

  console.log(`📡 Sending CC-e #${nextSeq} for NF-e ${nfe.numero}...`);

  const { response, text: responseText, data: responseData } = await postWithRetry(
    `${FISCAL_API_BASE_URL}/nfe/cce?api_key=${encodeURIComponent(empresa.api_key_fiscal)}`,
    ccePayload,
    { label: `CC-e #${nextSeq} NF-e ${nfe.numero}` }
  );
  console.log(`📡 CC-e response (${response.status}):`, responseText.substring(0, 500));

  const isSuccess = response.ok && (responseData.sucesso || responseData.status === 'registrada' ||
    ['135', '136'].includes(String(responseData.cStat || '')));

  if (isSuccess) {
    await supabase.from('nfe_eventos').update({
      protocolo: responseData.protocolo || null,
      codigo_retorno: String(responseData.cStat || '135'),
      motivo_retorno: responseData.xMotivo || 'Evento registrado e vinculado a NF-e',
      xml_retorno: responseData.xml_retorno || null,
    }).eq('id', evento.id);

    return new Response(
      JSON.stringify({ success: true, data: { id: evento.id, sequencia: nextSeq, ...responseData } }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Falha: marca o evento com erro
  await supabase.from('nfe_eventos').update({
    codigo_retorno: String(responseData.cStat || ''),
    motivo_retorno: responseData.error || responseData.xMotivo || 'Erro ao registrar CC-e',
  }).eq('id', evento.id);

  return new Response(
    JSON.stringify({ error: 'Erro ao registrar CC-e na SEFAZ', details: responseData }),
    { status: response.status || 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// ============================================================================
// MDF-e (modelo 58) handlers — delega ao PHP api2 (sped-mdfe)
// ============================================================================
async function handleMdfeEmit(supabase: any, mdfeId: string) {
  if (!mdfeId) {
    return new Response(JSON.stringify({ error: 'mdfe_id é obrigatório' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const { data: mdfe } = await supabase
    .from('mdfe')
    .select('*, mdfe_documentos(*)')
    .eq('id', mdfeId).single();

  if (!mdfe) {
    return new Response(JSON.stringify({ error: 'MDF-e não encontrado' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const { empresa, certificate, error: regError } = await ensureRegistered(supabase, mdfe.empresa_id);
  if (regError || !empresa?.api_key_fiscal) {
    return new Response(JSON.stringify({ error: 'Empresa não registrada na API fiscal' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const cnpjEmit = (empresa.cnpj || '').replace(/\D/g, '');
  const nMDF = String(parseInt(mdfe.numero, 10)); // strip zeros
  const serie = String(parseInt(mdfe.serie, 10));

  const phpPayload: any = {
    api_key: empresa.api_key_fiscal,
    cnpj: cnpjEmit,
    mdfe: {
      numero: nMDF,
      serie,
      modal: 1,
      uf_ini: mdfe.uf_ini,
      uf_fim: mdfe.uf_fim,
      uf_percurso: mdfe.uf_percurso || [],
      dh_ini_viagem: mdfe.payload_entrada?.data_inicio_viagem || new Date().toISOString().replace(/\.\d{3}Z$/, '-03:00'),
      veiculo: {
        placa: mdfe.placa,
        uf: mdfe.uf_placa || mdfe.uf_ini,
        tara: mdfe.tara,
        cap_kg: mdfe.cap_kg || 0,
        cap_m3: mdfe.cap_m3 || 0,
        tipo_rodado: mdfe.payload_entrada?.veiculo?.tipo_rodado || '06',
        tipo_carroceria: mdfe.payload_entrada?.veiculo?.tipo_carroceria || '02',
        renavam: mdfe.payload_entrada?.veiculo?.renavam || null,
        rntrc: mdfe.rntrc || mdfe.payload_entrada?.veiculo?.rntrc || null,
      },
      condutor: { nome: mdfe.condutor_nome, cpf: mdfe.condutor_cpf },
      documentos: (mdfe.mdfe_documentos || []).map((d: any) => ({
        tipo: d.tipo, chave: d.chave,
        c_mun_descarga: d.c_mun_descarga, x_mun_descarga: d.x_mun_descarga,
      })),
      totais: {
        valor_carga: Number(mdfe.valor_carga),
        peso_bruto: Number(mdfe.peso_bruto),
        unidade_peso: mdfe.unidade_peso === 2 ? '02' : '01',
      },
      produto_predominante: mdfe.produto_predominante || null,
      cep_carregamento: mdfe.cep_carregamento || null,
      cep_descarregamento: mdfe.cep_descarregamento || null,
      info_adicional: mdfe.info_adicional || null,
      // tpEmit SEFAZ: 1=Prestador de Serviço de Transporte (exige seguro), 2=Carga Própria, 3=Prestador CT-e Globalizado
      // Default seguro = carga própria (2) para evitar rejeição 698 quando ERP não envia o campo
      tp_emit: Number(mdfe.tp_emit ?? mdfe.payload_entrada?.tp_emit ?? 2),
      seguros: mdfe.seguros || mdfe.payload_entrada?.seguros || [],
    },
  };
  if (certificate) phpPayload.certificado = { pfx_base64: certificate.base64, senha: certificate.senha };

  console.log(`📡 Emitting MDF-e ${mdfe.numero} via fiscal API...`);

  const url = `${FISCAL_API_BASE_URL}/mdfe/emitir?api_key=${encodeURIComponent(empresa.api_key_fiscal)}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${empresa.api_key_fiscal}` },
    body: JSON.stringify(phpPayload),
  });
  const text = await resp.text();
  console.log(`📡 MDF-e emit response (${resp.status}):`, text.substring(0, 800));

  // Detecta HTML / fatal error do PHP (api2). PHP fatal retorna HTTP 200 com HTML.
  const looksLikeHtml = /<br\s*\/?>|<b>|Fatal error|Stack trace|<html/i.test(text);
  let data: any;
  if (looksLikeHtml) {
    const fatalMatch = text.match(/Uncaught[^<]+/i)?.[0]?.trim()
      || text.match(/Fatal error[^<]+/i)?.[0]?.trim()
      || 'Fatal error PHP na API fiscal MDF-e';
    data = { erro: fatalMatch.substring(0, 500), php_error: true, raw: text.substring(0, 500) };
  } else {
    try { data = JSON.parse(text); } catch { data = { erro: 'Resposta não-JSON da API fiscal', raw: text.substring(0, 500) }; }
  }

  // Trata erro: HTTP !ok, ou {erro}, ou {success:false}, ou status rejeitado
  const hasErr = !resp.ok || data.erro || data.error
    || data.success === false || data.sucesso === false
    || (data.status && ['rejeitada','denegada','erro'].includes(String(data.status).toLowerCase()));

  if (hasErr) {
    const errMsg = data.erro || data.error || data.motivo || data.xMotivo || 'Erro na API fiscal MDF-e';
    await supabase.from('mdfe').update({
      status: 'rejeitada',
      erro_processamento: String(errMsg).substring(0, 1000),
      motivo_retorno: JSON.stringify(data).substring(0, 1000),
      codigo_retorno: data.cStat || data.codigo || (data.php_error ? 'PHP_FATAL' : null),
      processado_em: new Date().toISOString(),
    }).eq('id', mdfeId);

    await supabase.rpc('registrar_log', {
      p_empresa_id: mdfe.empresa_id, p_nfce_id: mdfeId, p_token_api_id: mdfe.token_api_id,
      p_tipo: 'erro', p_categoria: 'emissao',
      p_mensagem: `Falha ao emitir MDF-e ${mdfe.numero}: ${String(errMsg).substring(0, 200)}`,
      p_detalhes: { tipo: 'mdfe', http_status: resp.status, php_error: !!data.php_error, response: data },
    });

    return new Response(JSON.stringify({ success: false, error: errMsg, details: data }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  // Sucesso — exige chave/protocolo OU status válido
  const chaveOk = data.chave || data.chave_acesso || data.chNFe;
  const protoOk = data.protocolo || data.nProt;
  const statusOk = data.status === 'autorizada' || (chaveOk && protoOk);

  const update: any = {
    status: statusOk ? 'autorizada' : 'processando',
    chave_acesso: data.chave || null,
    protocolo: data.protocolo || null,
    xml_retorno: data.xml || null,
    motivo_retorno: data.motivo || data.xMotivo || null,
    codigo_retorno: data.cStat || null,
    data_autorizacao: data.dhRecbto || (data.status === 'autorizada' ? new Date().toISOString() : null),
    processado_em: new Date().toISOString(),
  };
  await supabase.from('mdfe').update(update).eq('id', mdfeId);

  await supabase.rpc('registrar_log', {
    p_empresa_id: mdfe.empresa_id, p_nfce_id: mdfeId, p_token_api_id: mdfe.token_api_id,
    p_tipo: 'sucesso', p_categoria: 'emissao',
    p_mensagem: `MDF-e ${mdfe.numero} ${update.status} via API fiscal`,
    p_detalhes: { tipo: 'mdfe', protocolo: update.protocolo, chave: update.chave_acesso },
  });

  return new Response(JSON.stringify({ success: true, data: { ...update, id: mdfeId, numero: mdfe.numero, serie: mdfe.serie } }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function handleMdfeEncerrar(supabase: any, mdfeId: string, cMunDescarga: string, dtEnc: string) {
  const { data: mdfe } = await supabase.from('mdfe').select('*').eq('id', mdfeId).single();
  if (!mdfe) {
    return new Response(JSON.stringify({ error: 'MDF-e não encontrado' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  const { empresa, certificate } = await ensureRegistered(supabase, mdfe.empresa_id);
  if (!empresa?.api_key_fiscal) {
    return new Response(JSON.stringify({ error: 'Empresa não registrada' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const payload: any = {
    api_key: empresa.api_key_fiscal,
    cnpj: (empresa.cnpj || '').replace(/\D/g, ''),
    chave: mdfe.chave_acesso, protocolo: mdfe.protocolo,
    uf_descarga: mdfe.uf_fim,
    c_mun_descarga: cMunDescarga,
    data_encerramento: dtEnc,
  };
  if (certificate) payload.certificado = { pfx_base64: certificate.base64, senha: certificate.senha };

  const resp = await fetch(`${FISCAL_API_BASE_URL}/mdfe/encerrar?api_key=${encodeURIComponent(empresa.api_key_fiscal)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${empresa.api_key_fiscal}` },
    body: JSON.stringify(payload),
  });
  const text = await resp.text();
  let data: any; try { data = JSON.parse(text); } catch { data = { raw: text }; }
  console.log(`📡 MDF-e encerrar (${resp.status}):`, text.substring(0, 400));

  if (!resp.ok || data.erro) {
    return new Response(JSON.stringify({ error: 'Erro ao encerrar', details: data }),
      { status: resp.status || 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  await supabase.from('mdfe').update({
    status: 'encerrada' as any, // status enum genérico — usa string livre se enum não tiver
    data_encerramento: new Date().toISOString(),
    protocolo_encerramento: data.protocolo || null,
  }).eq('id', mdfeId).then(async (r: any) => {
    // Se enum 'encerrada' não existir, faz fallback
    if (r.error) {
      await supabase.from('mdfe').update({
        data_encerramento: new Date().toISOString(),
        protocolo_encerramento: data.protocolo || null,
      }).eq('id', mdfeId);
    }
  });

  return new Response(JSON.stringify({ success: true, data: { id: mdfeId, ...data } }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function handleMdfeCancelar(supabase: any, mdfeId: string) {
  const { data: mdfe } = await supabase.from('mdfe').select('*, mdfe_eventos(*)').eq('id', mdfeId).single();
  if (!mdfe) {
    return new Response(JSON.stringify({ error: 'MDF-e não encontrado' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  const { empresa, certificate } = await ensureRegistered(supabase, mdfe.empresa_id);
  if (!empresa?.api_key_fiscal) {
    return new Response(JSON.stringify({ error: 'Empresa não registrada' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const cancelEvent = (mdfe.mdfe_eventos || [])
    .filter((e: any) => e.tipo_evento === 'cancelamento')
    .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
  const justificativa = cancelEvent?.justificativa || 'Cancelamento solicitado pelo emitente';

  const payload: any = {
    api_key: empresa.api_key_fiscal,
    cnpj: (empresa.cnpj || '').replace(/\D/g, ''),
    chave: mdfe.chave_acesso, protocolo: mdfe.protocolo,
    justificativa,
  };
  if (certificate) payload.certificado = { pfx_base64: certificate.base64, senha: certificate.senha };

  const resp = await fetch(`${FISCAL_API_BASE_URL}/mdfe/cancelar?api_key=${encodeURIComponent(empresa.api_key_fiscal)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${empresa.api_key_fiscal}` },
    body: JSON.stringify(payload),
  });
  const text = await resp.text();
  let data: any; try { data = JSON.parse(text); } catch { data = { raw: text }; }
  console.log(`📡 MDF-e cancelar (${resp.status}):`, text.substring(0, 400));

  const errStr = JSON.stringify(data).toLowerCase();
  const alreadyCancelled = errStr.includes('573') || errStr.includes('duplicidade de evento');

  if ((resp.ok && (data.success || data.sucesso || data.status === 'cancelada')) || alreadyCancelled) {
    await supabase.from('mdfe').update({
      status: 'cancelada',
      data_cancelamento: new Date().toISOString(),
      protocolo_cancelamento: data.protocolo || null,
    }).eq('id', mdfeId);
    if (cancelEvent) {
      await supabase.from('mdfe_eventos').update({
        protocolo: data.protocolo || null,
        codigo_retorno: data.cStat || '135',
        motivo_retorno: data.xMotivo || 'Evento registrado e vinculado a MDF-e',
        xml_retorno: data.xml_retorno || null,
      }).eq('id', cancelEvent.id);
    }
    return new Response(JSON.stringify({ success: true, data: { id: mdfeId, status: 'cancelada', ...data } }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  return new Response(JSON.stringify({ error: 'Erro ao cancelar MDF-e na SEFAZ', details: data }),
    { status: resp.status || 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

// ============================================================================
// SHARED: Inutilização de numeração NF-e (modelo 55)
// ============================================================================
async function handleInutilizar(
  supabase: any,
  empresaId: string,
  serie: any,
  numeroInicial: any,
  numeroFinal: any,
  justificativa: string,
) {
  if (!empresaId) {
    return new Response(JSON.stringify({ error: 'empresa_id é obrigatório' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  const nSerie = parseInt(String(serie ?? '1'), 10);
  const nIni = parseInt(String(numeroInicial ?? ''), 10);
  const nFin = parseInt(String(numeroFinal ?? numeroInicial ?? ''), 10);
  if (!nIni || !nFin || nFin < nIni) {
    return new Response(JSON.stringify({ error: 'numero_inicial / numero_final inválidos' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  const just = String(justificativa || '').trim();
  if (just.length < 15 || just.length > 255) {
    return new Response(JSON.stringify({ error: 'justificativa deve ter entre 15 e 255 caracteres' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const { empresa, certificate, error: regError } = await ensureRegistered(supabase, empresaId);
  if (regError || !empresa?.api_key_fiscal) {
    return new Response(JSON.stringify({ error: 'Empresa não registrada na API fiscal' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const payload: any = {
    api_key: empresa.api_key_fiscal,
    serie: nSerie,
    numero_inicial: nIni,
    numero_final: nFin,
    justificativa: just,
  };
  if (certificate) {
    payload.certificado = { pfx_base64: certificate.base64, senha: certificate.senha };
  }

  console.log(`📡 Inutilizando NF-e série ${nSerie} ${nIni}-${nFin} (empresa ${empresaId})...`);
  const { response, text: responseText, data: responseData } = await postWithRetry(
    `${FISCAL_API_BASE_URL}/nfe/inutilizar?api_key=${encodeURIComponent(empresa.api_key_fiscal)}`,
    payload,
    { label: `Inutilizar NF-e ${nIni}-${nFin}` }
  );
  console.log(`📡 Inutilizar response (${response.status}):`, responseText.substring(0, 500));

  const ok = response.ok && (responseData?.sucesso || responseData?.status === 'inutilizada' || String(responseData?.cStat) === '102');

  await supabase.from('logs_fiscais').insert({
    empresa_id: empresaId,
    tipo: ok ? 'sucesso' : 'erro',
    categoria: 'inutilizacao_nfe',
    mensagem: ok
      ? `NF-e série ${nSerie} ${nIni}-${nFin} inutilizada (cStat ${responseData?.cStat})`
      : `Falha ao inutilizar NF-e série ${nSerie} ${nIni}-${nFin}`,
    detalhes: responseData,
  });

  if (ok) {
    // Remove eventuais registros pendentes na faixa inutilizada
    await supabase.from('nfe')
      .delete()
      .eq('empresa_id', empresaId)
      .eq('serie', String(nSerie).padStart(3, '0'))
      .in('status', ['pendente', 'rejeitada', 'denegada'])
      .gte('numero', String(nIni).padStart(9, '0'))
      .lte('numero', String(nFin).padStart(9, '0'));

    return new Response(JSON.stringify({ success: true, data: responseData }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  return new Response(JSON.stringify({ error: 'Erro ao inutilizar NF-e na SEFAZ', details: responseData }),
    { status: response.status || 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

