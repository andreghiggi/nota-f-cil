import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

/** Conferir deploy: GET .../nfe-api?build=1 */
const NFE_API_BUILD_ID = 'c5e5f92-serie-canon';

interface NFePayload {
  external_id?: string;
  natureza_operacao?: string;
  finalidade?: string;
  modalidade_frete?: string;
  // Reforma Tributária - Grupo B
  d_prev_entrega?: string;
  c_mun_fg_ibs?: string;
  tp_nf_debito?: string;
  tp_nf_credito?: string;
  ind_intermed?: number;
  // Compra Governamental
  tp_ente_gov?: number;
  tp_oper_gov?: number;
  p_redutor_gov?: number;
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
  serie?: string;
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
    base_calculo_icms?: number;
    aliquota_fcp?: number;
    base_calculo_icms_st?: number;
    aliquota_icms_st?: number;
    mva_icms_st?: number;
    // Campos opcionais para CSTs específicos
    p_red_bc?: number;          // CST 20, 70 (redução de BC)
    p_red_bc_st?: number;       // CST 10, 70 (redução de BC do ST)
    p_diferimento?: number;     // CST 51 (% diferimento)
    valor_icms_op?: number;     // CST 51 (ICMS da operação)
    valor_icms_dif?: number;    // CST 51 (ICMS diferido)
    mod_bc?: string;            // Modalidade BC ICMS (0,1,2,3)
    mod_bc_st?: string;         // Modalidade BC ICMS-ST (0..6)
    motivo_desoneracao?: string; // CST 40, 41, 50 desoneradas
    valor_icms_desonerado?: number;
    p_cred_sn?: number;         // CSOSN 101, 201, 900
    valor_cred_icms_sn?: number;
    cst_ipi?: string;
    aliquota_ipi?: number;
    base_calculo_ipi?: number;
    cst_pis?: string;
    aliquota_pis?: number;
    base_calculo_pis?: number;
    cst_cofins?: string;
    aliquota_cofins?: number;
    base_calculo_cofins?: number;
    // Reforma Tributária - IBS/CBS (Grupo UB)
    cst_ibs_cbs?: string;
    c_class_trib?: string;
    vbc_ibs_cbs?: number;
    aliquota_ibs_uf?: number;
    aliquota_ibs_mun?: number;
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
    ind_doacao?: number;
    ind_bem_movel_usado?: number;
    // Imposto Seletivo
    cst_is?: string;
    c_class_trib_is?: string;
    vbc_is?: number;
    aliquota_is?: number;
    base_calculo_is?: number;
    base_calculo_ibs?: number;
    base_calculo_cbs?: number;
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

/**
 * Mapeia aliases do emit-smart / nfe-proxy (cst_cbs, cst_ibs, base_calculo_*)
 * para o formato nativo da API (cst_ibs_cbs, vbc_ibs_cbs, aliquota_ibs_uf).
 */
function normalizeReformaPayloadItem(item: Record<string, unknown>): Record<string, unknown> {
  const aliqCbs = Number(item.aliquota_cbs ?? 0);
  const aliqIbsUf = Number(item.aliquota_ibs_uf ?? item.aliquota_ibs ?? 0);
  const aliqIbsMun = Number(item.aliquota_ibs_mun ?? 0);
  const hasReforma = Boolean(
    item.cst_ibs_cbs || item.cst_cbs || item.cst_ibs || item.g_trib_fed || item.ibscbs
    || aliqCbs > 0 || aliqIbsUf > 0 || aliqIbsMun > 0,
  );
  if (!hasReforma) return item;

  const qty = Number(item.quantidade ?? 0);
  const vUnit = Number(item.valor_unitario ?? 0);
  const valorItem = Number(item.valor_total ?? qty * vUnit);
  const vbc = Number(
    item.vbc_ibs_cbs ?? item.base_calculo_cbs ?? item.base_calculo_ibs ?? valorItem,
  );
  const cst = String(item.cst_ibs_cbs ?? item.cst_cbs ?? item.cst_ibs ?? '000').trim() || '000';

  return {
    ...item,
    cst_ibs_cbs: cst,
    vbc_ibs_cbs: vbc > 0 ? vbc : valorItem,
    aliquota_cbs: aliqCbs,
    aliquota_ibs_uf: aliqIbsUf,
    aliquota_ibs_mun: aliqIbsMun,
    base_calculo_cbs: Number(item.base_calculo_cbs ?? vbc),
    base_calculo_ibs: Number(item.base_calculo_ibs ?? vbc),
  };
}

/** Série canônica: "001" e "1" passam a ser a mesma chave em series_fiscais. */
function normalizeSerieFiscal(serie: string | null | undefined): string {
  const t = String(serie ?? '1').trim();
  if (!t) return '1';
  if (/^\d+$/.test(t)) return String(parseInt(t, 10));
  return t;
}

function serieAliases(serie: string): string[] {
  const t = String(serie).trim();
  const canon = normalizeSerieFiscal(t);
  const set = new Set<string>([t, canon]);
  if (/^\d+$/.test(canon)) {
    const n = parseInt(canon, 10);
    for (const width of [1, 2, 3, 4]) {
      set.add(String(n).padStart(width, '0'));
    }
  }
  return [...set];
}

/** Evita reiniciar em 000000003 quando já existem NF-e autorizadas na mesma série. */
async function syncSerieNumeroAtual(
  supabase: ReturnType<typeof createClient>,
  empresaId: string,
  serie: string,
): Promise<void> {
  const aliases = serieAliases(serie);
  const canon = normalizeSerieFiscal(serie);

  const { data: nfes } = await supabase
    .from('nfe')
    .select('numero, serie, status')
    .eq('empresa_id', empresaId)
    .in('serie', aliases)
    .in('status', ['autorizada', 'autorizado', 'cancelada']);

  let maxNum = 0;
  for (const row of nfes || []) {
    const digits = String(row.numero || '').replace(/\D/g, '');
    const n = parseInt(digits || '0', 10);
    if (n > maxNum) maxNum = n;
  }
  if (maxNum <= 0) return;

  for (const s of aliases) {
    const { data: row } = await supabase
      .from('series_fiscais')
      .select('id, numero_atual')
      .eq('empresa_id', empresaId)
      .eq('tipo', 'nfe')
      .eq('serie', s)
      .maybeSingle();

    if (row && (row.numero_atual ?? 0) < maxNum) {
      await supabase
        .from('series_fiscais')
        .update({ numero_atual: maxNum, updated_at: new Date().toISOString() })
        .eq('id', row.id);
    }
  }

  const { data: canonRow } = await supabase
    .from('series_fiscais')
    .select('id, numero_atual')
    .eq('empresa_id', empresaId)
    .eq('tipo', 'nfe')
    .eq('serie', canon)
    .maybeSingle();

  if (!canonRow) {
    await supabase.from('series_fiscais').insert({
      empresa_id: empresaId,
      tipo: 'nfe',
      serie: canon,
      numero_atual: maxNum,
      ativo: true,
    });
  } else if ((canonRow.numero_atual ?? 0) < maxNum) {
    await supabase
      .from('series_fiscais')
      .update({ numero_atual: maxNum, updated_at: new Date().toISOString() })
      .eq('id', canonRow.id);
  }
}

function shouldDeferTransmit(payload: NFePayload): boolean {
  const p = payload as Record<string, unknown>;
  return p.transmitir === false
    || p.transmitir_sefaz === false
    || p.auto_transmitir === false
    || p.somente_gerar === true
    || p.validar_apenas === true
    || p.preview === true;
}

function decodeXmlBodyField(raw: unknown): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const s = raw.trim();
  if (!s) return null;
  if (s.startsWith('<')) return s;
  try {
    const dec = atob(s);
    if (dec.includes('<')) return dec;
  } catch { /* ignore */ }
  return null;
}

async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function extractXmlCandidate(value: any): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value !== 'object') return '';

  for (const key of ['xml_retorno', 'xml', 'xmlRetorno', 'procNFe', 'nfeProc', 'xml_envio']) {
    const found = extractXmlCandidate(value[key]);
    if (found) return found;
  }
  for (const nested of Object.values(value)) {
    const found = extractXmlCandidate(nested);
    if (found) return found;
  }
  return '';
}

function normalizeXmlResponse(raw: any): string | null {
  let xml = extractXmlCandidate(raw).trim();
  if (!xml) return null;

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

  const compact = xml.trim().replace(/\s+/g, '');
  if (!xml.trim().startsWith('<') && /^[A-Za-z0-9+/=]+$/.test(compact) && compact.length > 40) {
    try {
      const bin = atob(compact);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      xml = new TextDecoder('utf-8').decode(bytes).trim();
    } catch {
      return null;
    }
  }

  const start = xml.search(/<\?xml|<procNFe|<NFe/i);
  if (start > 0) xml = xml.slice(start);
  xml = xml.replace(/^\uFEFF/, '').trim();
  return xml.startsWith('<') ? xml : null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const urlBuild = new URL(req.url);
  if (req.method === 'GET' && urlBuild.searchParams.get('build') === '1') {
    return new Response(
      JSON.stringify({ build: NFE_API_BUILD_ID, function: 'nfe-api' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Nfe-Api-Build': NFE_API_BUILD_ID } },
    );
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);

    // ===== PUBLIC ENDPOINT: POST /nfe-api/register =====
    const subPath = pathParts.length >= 2 ? pathParts.slice(1).join('/') : '';

    if (req.method === 'POST' && subPath === 'register') {
      const body = await req.json();
      const { cnpj, razao_social, email, nome_fantasia, inscricao_estadual, uf, municipio, codigo_municipio } = body;

      if (!cnpj || !razao_social) {
        return new Response(
          JSON.stringify({ success: false, error: 'Campos cnpj e razao_social são obrigatórios.', code: 'VALIDATION_ERROR' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const cnpjClean = cnpj.replace(/\D/g, '');
      if (cnpjClean.length !== 11 && cnpjClean.length !== 14) {
        return new Response(
          JSON.stringify({ success: false, error: 'CNPJ/CPF deve ter 11 ou 14 dígitos.', code: 'VALIDATION_ERROR' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if CNPJ already registered
      const tipoPessoa = cnpjClean.length === 11 ? 'PF' : 'PJ';
      const cnpjField = tipoPessoa === 'PF' ? 'cpf' : 'cnpj';
      const { data: existingEmpresa } = await supabase
        .from('empresas')
        .select('id')
        .eq(cnpjField, cnpjClean)
        .maybeSingle();

      if (existingEmpresa) {
        return new Response(
          JSON.stringify({ success: false, error: 'CNPJ/CPF já possui cadastro. Use o endpoint de tokens para gerar novos acessos.', code: 'ALREADY_REGISTERED' }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Create empresa (user_id will be a system UUID since this is API-driven)
      const systemUserId = '00000000-0000-0000-0000-000000000000';
      const empresaInsert: any = {
        user_id: systemUserId,
        razao_social,
        nome_fantasia: nome_fantasia || razao_social,
        tipo_pessoa: tipoPessoa,
        uf: uf || 'SP',
        municipio: municipio || 'SAO PAULO',
        codigo_municipio: codigo_municipio || '3550308',
        ambiente: 'homologacao',
      };
      if (tipoPessoa === 'PF') {
        empresaInsert.cpf = cnpjClean;
      } else {
        empresaInsert.cnpj = cnpjClean;
        empresaInsert.inscricao_estadual = inscricao_estadual || null;
      }

      const { data: novaEmpresa, error: empresaError } = await supabase
        .from('empresas')
        .insert(empresaInsert)
        .select('id, razao_social, ambiente, created_at')
        .single();

      if (empresaError) {
        console.error('Register empresa error:', empresaError);
        return new Response(
          JSON.stringify({ success: false, error: 'Erro ao cadastrar empresa.', details: empresaError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Generate API token
      const token = `sk_live_${crypto.randomUUID()}`;
      const tokenPrefix = token.substring(0, 16);
      const newTokenHash = await hashToken(token);

      const { error: tokenInsertError } = await supabase
        .from('tokens_api')
        .insert({
          empresa_id: novaEmpresa.id,
          nome: `Token principal - ${razao_social}`,
          token_hash: newTokenHash,
          token_prefix: tokenPrefix,
          permissoes: ['emitir_nfce', 'emitir_nfe', 'emitir', 'consultar', 'cancelar', 'gerenciar'],
          status: 'ativo',
        });

      if (tokenInsertError) {
        console.error('Register token error:', tokenInsertError);
      }

      // Create default series
      await supabase.from('series_fiscais').insert([
        { empresa_id: novaEmpresa.id, tipo: 'nfe', serie: '001', numero_atual: 0 },
        { empresa_id: novaEmpresa.id, tipo: 'nfce', serie: '001', numero_atual: 0 },
      ]);

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            api_key: token,
            cnpj: cnpjClean,
            razao_social: novaEmpresa.razao_social,
            ambiente: novaEmpresa.ambiente,
            empresa_id: novaEmpresa.id,
            created_at: novaEmpresa.created_at,
            message: 'Empresa registrada com sucesso. Guarde a api_key, ela não será exibida novamente.',
          },
        }),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== PUBLIC ENDPOINT: POST /nfe-api/tokens/create =====
    if (req.method === 'POST' && subPath === 'tokens/create') {
      const body = await req.json();
      const { cnpj, api_key_master, nome, permissoes: novasPermissoes, expires_at } = body;

      if (!api_key_master || !nome) {
        return new Response(
          JSON.stringify({ success: false, error: 'Campos api_key_master e nome são obrigatórios.', code: 'VALIDATION_ERROR' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Validate master token
      const masterHash = await hashToken(api_key_master);
      const { data: masterData } = await supabase
        .rpc('validar_token_api', { p_token_hash: masterHash });

      if (!masterData || masterData.length === 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'api_key_master inválida ou expirada.', code: 'AUTH_INVALID' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const master = masterData[0];
      if (!master.permissoes.includes('gerenciar') && !master.permissoes.includes('admin')) {
        return new Response(
          JSON.stringify({ success: false, error: 'Token master não possui permissão de gerenciamento.', code: 'PERMISSION_DENIED' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const permissoesValidas = ['emitir_nfce', 'emitir_nfe', 'emitir', 'consultar', 'cancelar', 'reprocessar', 'gerenciar'];
      const permissoesFinais = (novasPermissoes || ['emitir_nfce', 'emitir_nfe', 'consultar']).filter(
        (p: string) => permissoesValidas.includes(p)
      );

      const newToken = `nfce_${crypto.randomUUID().replace(/-/g, '')}`;
      const newPrefix = newToken.substring(0, 12);
      const newHash = await hashToken(newToken);

      const insertData: any = {
        empresa_id: master.empresa_id,
        nome,
        token_hash: newHash,
        token_prefix: newPrefix,
        permissoes: permissoesFinais,
        status: 'ativo',
      };
      if (expires_at) insertData.expires_at = expires_at;

      const { data: createdToken, error: createError } = await supabase
        .from('tokens_api')
        .insert(insertData)
        .select('id, nome, token_prefix, permissoes, status, created_at, expires_at')
        .single();

      if (createError) {
        return new Response(
          JSON.stringify({ success: false, error: 'Erro ao criar token.', details: createError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            ...createdToken,
            token: newToken,
            message: 'Token criado com sucesso. Guarde-o em local seguro.',
          },
        }),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate API Key (all other endpoints require it)
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

    // ===== POST /nfe-api/certificado - Upload certificado digital =====
    if (method === 'POST' && subPath === 'certificado') {
      const body = await req.json();
      const { certificado_base64, senha } = body;

      if (!certificado_base64 || !senha) {
        return new Response(
          JSON.stringify({ success: false, error: 'Campos certificado_base64 e senha são obrigatórios.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Try to extract info from the certificate bytes
      let titular = null;
      let cnpjCert = null;
      let dataVencimento = new Date();
      dataVencimento.setFullYear(dataVencimento.getFullYear() + 1);
      let dataEmissao = new Date();
      dataEmissao.setFullYear(dataEmissao.getFullYear() - 1);
      let emissor = 'Autoridade Certificadora';

      try {
        const certBytes = Uint8Array.from(atob(certificado_base64), c => c.charCodeAt(0));
        const certString = new TextDecoder('latin1').decode(certBytes);
        
        // Extract CNPJ/CPF
        const cnpjMatch = certString.match(/(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})/);
        const cpfMatch = certString.match(/(\d{3}\.?\d{3}\.?\d{3}-?\d{2})/);
        if (cnpjMatch) {
          cnpjCert = cnpjMatch[1].replace(/\D/g, '');
        } else if (cpfMatch) {
          cnpjCert = cpfMatch[1].replace(/\D/g, '');
        }

        // Extract issuer
        const issuers = ['SERASA', 'CERTISIGN', 'VALID', 'SAFEWEB', 'SOLUTI', 'AC BR', 'ICP-Brasil'];
        for (const iss of issuers) {
          if (certString.toUpperCase().includes(iss)) {
            emissor = `AC ${iss} RFB`;
            break;
          }
        }
      } catch (_e) { /* parsing optional */ }

      // Get empresa info for titular
      const { data: empInfo } = await supabase
        .from('empresas')
        .select('razao_social, cnpj, cpf')
        .eq('id', empresa_id)
        .single();

      titular = empInfo?.razao_social || 'Não identificado';
      if (!cnpjCert) cnpjCert = empInfo?.cnpj || empInfo?.cpf || null;

      // Determine certificate status
      const now = new Date();
      const diffDays = Math.ceil((dataVencimento.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      let certStatus: string = 'valido';
      if (diffDays <= 0) certStatus = 'expirado';
      else if (diffDays <= 30) certStatus = 'expirando';

      // Upsert certificate (one per empresa via unique constraint)
      const { data: existingCert } = await supabase
        .from('certificados_digitais')
        .select('id')
        .eq('empresa_id', empresa_id)
        .maybeSingle();

      if (existingCert) {
        await supabase
          .from('certificados_digitais')
          .update({
            arquivo_path: `api-upload/${empresa_id}`,
            senha_hash: senha,
            cnpj_certificado: cnpjCert,
            emissor,
            data_emissao: dataEmissao.toISOString().split('T')[0],
            data_vencimento: dataVencimento.toISOString().split('T')[0],
            status: certStatus,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingCert.id);
      } else {
        await supabase
          .from('certificados_digitais')
          .insert({
            empresa_id,
            tipo: 'A1',
            arquivo_path: `api-upload/${empresa_id}`,
            senha_hash: senha,
            cnpj_certificado: cnpjCert,
            emissor,
            data_emissao: dataEmissao.toISOString().split('T')[0],
            data_vencimento: dataVencimento.toISOString().split('T')[0],
            status: certStatus,
          });
      }

      // Store the base64 certificate in a way the fiscal-api can retrieve it
      // We'll store it as a storage object
      const certBlob = new Blob([certificado_base64], { type: 'text/plain' });
      await supabase.storage
        .from('certificados')
        .upload(`${empresa_id}/certificado.pfx.b64`, certBlob, { upsert: true });

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            titular,
            cnpj: cnpjCert,
            validade: dataVencimento.toISOString(),
            message: 'Certificado digital enviado com sucesso',
          },
        }),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== GET /nfe-api/certificado/status - Consulta status do certificado =====
    if (method === 'GET' && (subPath === 'certificado/status' || subPath === 'certificado')) {
      const { data: cert } = await supabase
        .from('certificados_digitais')
        .select('*')
        .eq('empresa_id', empresa_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!cert) {
        return new Response(
          JSON.stringify({ success: false, error: 'Nenhum certificado digital configurado' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const now = new Date();
      const validade = new Date(cert.data_vencimento);
      const diasRestantes = Math.ceil((validade.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      let status = 'ativo';
      if (diasRestantes <= 0) status = 'expirado';
      else if (diasRestantes <= 30) status = 'proximo_vencimento';

      const { data: empInfo2 } = await supabase
        .from('empresas')
        .select('razao_social')
        .eq('id', empresa_id)
        .single();

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            titular: empInfo2?.razao_social || 'N/A',
            cnpj: cert.cnpj_certificado,
            validade: validade.toISOString(),
            expira_em: diasRestantes > 0 ? `${diasRestantes} dias` : 'Expirado',
            dias_restantes: diasRestantes,
            status,
            emissor: cert.emissor,
            tipo: cert.tipo,
          },
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST /nfe-api - Emit new NF-e
    if (method === 'POST' && pathParts.length === 1 && pathParts[0] === 'nfe-api') {
      if (!permissoes.includes('emitir') && !permissoes.includes('emitir_nfe')) {
        return new Response(
          JSON.stringify({ error: 'Permission denied', code: 'PERMISSION_DENIED' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const payload: NFePayload = await req.json();
      payload.itens = (payload.itens || []).map((item: any) => normalizeReformaPayloadItem({
        ...item,
        codigo: String(item.codigo ?? item.cProd ?? item.codigo_produto ?? item.cod_produto ?? '').trim(),
        descricao: String(item.descricao ?? item.xProd ?? item.descricao_produto ?? item.nome_produto ?? item.produto ?? '').trim(),
        unidade: String(item.unidade ?? item.uCom ?? item.uTrib ?? 'UN').trim(),
        quantidade: Number(item.quantidade ?? item.qCom ?? item.qTrib ?? 0),
        valor_unitario: Number(item.valor_unitario ?? item.vUnCom ?? item.vUnTrib ?? 0),
      })) as NFePayload['itens'];

      if (!payload.itens || payload.itens.length === 0) {
        return new Response(
          JSON.stringify({ error: 'Items are required', code: 'VALIDATION_ERROR' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: empresaData } = await supabase
        .from('empresas')
        .select('serie_nfe, uf, regime_tributario')
        .eq('id', empresa_id)
        .single();

      // ===== Validação prévia por item (CST/CSOSN) =====
      const isSimples = empresaData?.regime_tributario === 'simples_nacional' || empresaData?.regime_tributario === 'simples_excesso';
      const erros: Array<{ item: number; campo: string; mensagem: string }> = [];
      payload.itens.forEach((it, idx) => {
        const n = idx + 1;
        const req = (cond: boolean, campo: string, msg: string) => {
          if (!cond) erros.push({ item: n, campo, mensagem: msg });
        };
        // Campos básicos universais
        req(!!String(it.codigo || '').trim(), 'codigo', 'Código do produto é obrigatório');
        const descricaoProduto = String(it.descricao || '').trim();
        req(!!descricaoProduto, 'descricao', 'Descrição do produto é obrigatória');
        const forbiddenTestProductPattern = new RegExp(['produto', 'teste'].join('\\s*'), 'i');
        req(!forbiddenTestProductPattern.test(descricaoProduto), 'descricao', 'Descrição genérica de teste é proibida; envie a descrição real do item');
        req(!!it.cfop, 'cfop', 'CFOP é obrigatório');
        req(!!it.unidade, 'unidade', 'Unidade comercial é obrigatória');
        req((it.quantidade ?? 0) > 0, 'quantidade', 'Quantidade deve ser > 0');
        req((it.valor_unitario ?? 0) >= 0, 'valor_unitario', 'Valor unitário inválido');

        if (isSimples) {
          if (it.cst_icms) erros.push({ item: n, campo: 'cst_icms', mensagem: 'Empresa do Simples deve usar CSOSN, não CST' });
          req(!!it.csosn, 'csosn', 'CSOSN é obrigatório para Simples Nacional');
          const csosn = String(it.csosn || '');
          if (['101','201','900'].includes(csosn)) {
            req((it.p_cred_sn ?? 0) > 0, 'p_cred_sn', `CSOSN ${csosn} exige p_cred_sn (% crédito SN)`);
          }
          if (['201','202','203'].includes(csosn)) {
            req((it.base_calculo_icms_st ?? 0) > 0, 'base_calculo_icms_st', `CSOSN ${csosn} exige base de cálculo ST`);
            req((it.aliquota_icms_st ?? 0) > 0, 'aliquota_icms_st', `CSOSN ${csosn} exige alíquota ICMS-ST`);
          }
        } else {
          if (it.csosn) erros.push({ item: n, campo: 'csosn', mensagem: 'Regime Normal deve usar CST, não CSOSN' });
          req(!!it.cst_icms, 'cst_icms', 'CST ICMS é obrigatório para Regime Normal');
          const cst = String(it.cst_icms || '');
          if (['00','10','20','51','70','90'].includes(cst)) {
            req((it.base_calculo_icms ?? 0) > 0 || (it.aliquota_icms ?? 0) === 0, 'base_calculo_icms', `CST ${cst} exige base de cálculo ICMS`);
            req((it.aliquota_icms ?? 0) > 0, 'aliquota_icms', `CST ${cst} exige alíquota ICMS`);
          }
          if (['20','70'].includes(cst)) {
            req((it.p_red_bc ?? 0) > 0, 'p_red_bc', `CST ${cst} exige % redução de BC (p_red_bc)`);
          }
          if (cst === '51') {
            req((it.p_diferimento ?? 0) > 0, 'p_diferimento', 'CST 51 exige % de diferimento (p_diferimento)');
          }
          if (['10','30','70','90'].includes(cst) && ((it as any).base_calculo_icms_st ?? 0) > 0) {
            req((it.aliquota_icms_st ?? 0) > 0, 'aliquota_icms_st', `CST ${cst} com ST exige alíquota ICMS-ST`);
          }
        }
        // PIS/COFINS
        const cstPis = String(it.cst_pis || '');
        if (['01','02','03','04','05'].includes(cstPis)) {
          req((it.aliquota_pis ?? 0) > 0, 'aliquota_pis', `CST PIS ${cstPis} exige alíquota PIS`);
        }
        const cstCof = String(it.cst_cofins || '');
        if (['01','02','03','04','05'].includes(cstCof)) {
          req((it.aliquota_cofins ?? 0) > 0, 'aliquota_cofins', `CST COFINS ${cstCof} exige alíquota COFINS`);
        }
      });
      if (erros.length > 0) {
        return new Response(
          JSON.stringify({ error: 'Validação prévia falhou', code: 'VALIDATION_ERROR', erros }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Série canônica (evita contador paralelo "1" vs "001")
      const serieNfe = normalizeSerieFiscal(
        payload.serie || empresaData?.serie_nfe || '1',
      );
      payload.serie = serieNfe;

      await syncSerieNumeroAtual(supabase, empresa_id, serieNfe);

      const { data: numeroData, error: numeroError } = await supabase
        .rpc('gerar_numero_nfe', { p_empresa_id: empresa_id, p_serie: serieNfe });

      if (numeroError) {
        console.error('gerar_numero_nfe error:', JSON.stringify(numeroError));
        return new Response(
          JSON.stringify({ error: 'Failed to generate NF-e number', code: 'INTERNAL_ERROR', details: numeroError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // empresaData already fetched above

      let valorProdutos = 0, valorIcms = 0, valorIpi = 0, valorPis = 0, valorCofins = 0;
      let valorIbsUfTotal = 0, valorIbsMunTotal = 0, valorCbsTotal = 0, valorIsTotal = 0;
      let valorDifIbsUfTotal = 0, valorDifIbsMunTotal = 0, valorDifCbsTotal = 0;
      let valorDevTribIbsUfTotal = 0, valorDevTribIbsMunTotal = 0, valorDevTribCbsTotal = 0;

      for (const item of payload.itens) {
        const valorItem = item.quantidade * item.valor_unitario;
        valorProdutos += valorItem;
        valorIcms += valorItem * (item.aliquota_icms || 0) / 100;
        valorIpi += valorItem * (item.aliquota_ipi || 0) / 100;
        valorPis += valorItem * (item.aliquota_pis || 0) / 100;
        valorCofins += valorItem * (item.aliquota_cofins || 0) / 100;
        // IBS/CBS/IS
        const vbcIbsCbs = item.vbc_ibs_cbs ?? valorItem;
        const aliqIbsUf = item.p_aliq_efet_ibs_uf || item.aliquota_ibs_uf || 0;
        const aliqIbsMun = item.p_aliq_efet_ibs_mun || item.aliquota_ibs_mun || 0;
        const aliqCbs = item.p_aliq_efet_cbs || item.aliquota_cbs || 0;
        valorIbsUfTotal += vbcIbsCbs * aliqIbsUf / 100;
        valorIbsMunTotal += vbcIbsCbs * aliqIbsMun / 100;
        valorCbsTotal += vbcIbsCbs * aliqCbs / 100;
        valorDifIbsUfTotal += item.valor_dif_ibs_uf || 0;
        valorDifIbsMunTotal += item.valor_dif_ibs_mun || 0;
        valorDifCbsTotal += item.valor_dif_cbs || 0;
        valorDevTribIbsUfTotal += item.valor_dev_trib_ibs_uf || 0;
        valorDevTribIbsMunTotal += item.valor_dev_trib_ibs_mun || 0;
        valorDevTribCbsTotal += item.valor_dev_trib_cbs || 0;
        valorIsTotal += (item.vbc_is || 0) * (item.aliquota_is || 0) / 100;
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
          serie: serieNfe,
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
          modalidade_frete: String(payload.modalidade_frete ?? '9'),
          dest_cpf_cnpj: dest.cpf_cnpj?.replace(/\D/g, '') || null,
          dest_nome: dest.nome,
          dest_ie: dest.ie?.replace(/\D/g, '') || null,
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
          // Reforma Tributária
          d_prev_entrega: payload.d_prev_entrega || null,
          c_mun_fg_ibs: payload.c_mun_fg_ibs || null,
          tp_nf_debito: payload.tp_nf_debito || null,
          tp_nf_credito: payload.tp_nf_credito || null,
          ind_intermed: payload.ind_intermed ?? null,
          tp_ente_gov: payload.tp_ente_gov ?? null,
          tp_oper_gov: payload.tp_oper_gov ?? null,
          p_redutor_gov: payload.p_redutor_gov || 0,
          valor_ibs_uf_total: valorIbsUfTotal,
          valor_ibs_mun_total: valorIbsMunTotal,
          valor_cbs_total: valorCbsTotal,
          valor_is_total: valorIsTotal,
          valor_dif_ibs_uf_total: valorDifIbsUfTotal,
          valor_dif_ibs_mun_total: valorDifIbsMunTotal,
          valor_dif_cbs_total: valorDifCbsTotal,
          valor_dev_trib_ibs_uf_total: valorDevTribIbsUfTotal,
          valor_dev_trib_ibs_mun_total: valorDevTribIbsMunTotal,
          valor_dev_trib_cbs_total: valorDevTribCbsTotal,
        })
        .select('id, numero, serie, status, created_at')
        .single();

      if (nfeError) {
        return new Response(
          JSON.stringify({ error: 'Failed to create NF-e', code: 'INTERNAL_ERROR', details: nfeError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Insert items with IBS/CBS/IS fields
      const itensToInsert = payload.itens.map((item, index) => {
        const valorItem = item.quantidade * item.valor_unitario;
        const vbcIbsCbs = item.vbc_ibs_cbs ?? valorItem;
        const aliqIbsUf = item.p_aliq_efet_ibs_uf || item.aliquota_ibs_uf || 0;
        const aliqIbsMun = item.p_aliq_efet_ibs_mun || item.aliquota_ibs_mun || 0;
        const aliqCbs = item.p_aliq_efet_cbs || item.aliquota_cbs || 0;
        return {
          nfe_id: nfeData.id,
          numero_item: index + 1,
          codigo_produto: item.codigo,
          descricao: item.descricao,
          ncm: item.ncm,
          cfop: item.cfop,
          unidade: item.unidade,
          quantidade: item.quantidade,
          valor_unitario: item.valor_unitario,
          valor_total: valorItem,
          cst_icms: item.cst_icms,
          csosn: item.csosn,
          aliquota_icms: item.aliquota_icms || 0,
          base_calculo_icms: item.base_calculo_icms || valorItem,
          valor_icms: valorItem * (item.aliquota_icms || 0) / 100,
          aliquota_fcp: item.aliquota_fcp || 0,
          valor_fcp: (item.base_calculo_icms || valorItem) * (item.aliquota_fcp || 0) / 100,
          base_calculo_icms_st: item.base_calculo_icms_st || 0,
          aliquota_icms_st: item.aliquota_icms_st || 0,
          mva_icms_st: item.mva_icms_st || 0,
          valor_icms_st: (item.base_calculo_icms_st || 0) * (item.aliquota_icms_st || 0) / 100,
          cst_ipi: item.cst_ipi,
          aliquota_ipi: item.aliquota_ipi || 0,
          base_calculo_ipi: item.base_calculo_ipi || valorItem,
          valor_ipi: (item.base_calculo_ipi || valorItem) * (item.aliquota_ipi || 0) / 100,
          cst_pis: item.cst_pis,
          aliquota_pis: item.aliquota_pis || 0,
          base_calculo_pis: item.base_calculo_pis || valorItem,
          valor_pis: (item.base_calculo_pis || valorItem) * (item.aliquota_pis || 0) / 100,
          cst_cofins: item.cst_cofins,
          aliquota_cofins: item.aliquota_cofins || 0,
          base_calculo_cofins: item.base_calculo_cofins || valorItem,
          valor_cofins: (item.base_calculo_cofins || valorItem) * (item.aliquota_cofins || 0) / 100,
          // Campos opcionais para CSTs específicos
          p_red_bc: item.p_red_bc || 0,
          p_red_bc_st: item.p_red_bc_st || 0,
          p_diferimento: item.p_diferimento || 0,
          valor_icms_op: item.valor_icms_op || 0,
          valor_icms_dif: item.valor_icms_dif || 0,
          mod_bc: item.mod_bc || null,
          mod_bc_st: item.mod_bc_st || null,
          motivo_desoneracao: item.motivo_desoneracao || null,
          valor_icms_desonerado: item.valor_icms_desonerado || 0,
          p_cred_sn: item.p_cred_sn || 0,
          valor_cred_icms_sn: item.valor_cred_icms_sn || 0,
          // IBS/CBS
          cst_ibs_cbs: item.cst_ibs_cbs || null,
          c_class_trib: item.c_class_trib || null,
          vbc_ibs_cbs: vbcIbsCbs,
          aliquota_ibs_uf: item.aliquota_ibs_uf || 0,
          valor_ibs_uf: vbcIbsCbs * aliqIbsUf / 100,
          p_red_aliq_ibs_uf: item.p_red_aliq_ibs_uf || 0,
          p_aliq_efet_ibs_uf: aliqIbsUf,
          valor_dif_ibs_uf: item.valor_dif_ibs_uf || 0,
          valor_dev_trib_ibs_uf: item.valor_dev_trib_ibs_uf || 0,
          aliquota_ibs_mun: item.aliquota_ibs_mun || 0,
          valor_ibs_mun: vbcIbsCbs * aliqIbsMun / 100,
          p_red_aliq_ibs_mun: item.p_red_aliq_ibs_mun || 0,
          p_aliq_efet_ibs_mun: aliqIbsMun,
          valor_dif_ibs_mun: item.valor_dif_ibs_mun || 0,
          valor_dev_trib_ibs_mun: item.valor_dev_trib_ibs_mun || 0,
          aliquota_cbs: item.aliquota_cbs || 0,
          valor_cbs: vbcIbsCbs * aliqCbs / 100,
          p_red_aliq_cbs: item.p_red_aliq_cbs || 0,
          p_aliq_efet_cbs: aliqCbs,
          valor_dif_cbs: item.valor_dif_cbs || 0,
          valor_dev_trib_cbs: item.valor_dev_trib_cbs || 0,
          ind_doacao: item.ind_doacao ?? null,
          ind_bem_movel_usado: item.ind_bem_movel_usado ?? null,
          // Imposto Seletivo
          cst_is: item.cst_is || null,
          c_class_trib_is: item.c_class_trib_is || null,
          vbc_is: item.vbc_is || 0,
          aliquota_is: item.aliquota_is || 0,
          valor_is: (item.vbc_is || 0) * (item.aliquota_is || 0) / 100,
        };
      });

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

      const deferTransmit = shouldDeferTransmit(payload);

      // Emit synchronously via fiscal-api (omitido quando cliente pede só gerar XML / transmitir depois)
      let emitResult: any = null;
      if (!deferTransmit) {
        try {
          const { data: fiscalResult, error: fiscalError } = await supabase.functions.invoke('fiscal-api', {
            body: { action: 'emit_nfe', nfe_id: nfeData.id },
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
      } else {
        console.log(`[nfe-api] Emissão adiada (pendente) NF-e ${nfeData.numero} — aguardando reprocessar/transmitir`);
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
          valor_produtos, valor_desconto, valor_frete, valor_seguro, valor_outras_despesas,
          valor_icms, valor_ipi, valor_pis, valor_cofins,
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

      // Carrega itens com todos os campos fiscais (incluindo CST/CSOSN extras)
      const { data: itensData } = await supabase
        .from('nfe_itens')
        .select('*')
        .eq('nfe_id', nfeId)
        .order('numero_item', { ascending: true });

      return new Response(
        JSON.stringify({ success: true, data: { ...nfeData, itens: itensData || [] } }),
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

      // Cancel via fiscal API (SEFAZ)
      let cancelResult: any = null;
      try {
        const { data: fiscalResult, error: fiscalError } = await supabase.functions.invoke('fiscal-api', {
          body: { action: 'cancel_nfe', nfe_id: nfeId }
        });

        if (!fiscalError && fiscalResult?.success) {
          cancelResult = fiscalResult.data;
        } else {
          console.warn('Fiscal NF-e cancel failed:', fiscalError?.message || fiscalResult?.error);
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
        console.error('NF-e Cancel exception:', cancelErr.message);
        return new Response(
          JSON.stringify({ error: 'Erro interno ao cancelar', code: 'INTERNAL_ERROR' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

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

      // Send webhook notification for NF-e cancellation
      try {
        await supabase.functions.invoke('send-webhook', {
          body: { nfe_id: nfeId, evento: 'nfe.cancelada' }
        });
      } catch (whErr: any) {
        console.error('Webhook NF-e cancel dispatch error (non-fatal):', whErr.message);
      }


      return new Response(
        JSON.stringify({ success: true, data: { id: nfeId, evento_id: eventoData?.id, status: 'cancelada' } }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST /nfe-api/inutilizar - Inutilização de numeração NF-e (modelo 55)
    if (method === 'POST' && pathParts.length === 2 && pathParts[0] === 'nfe-api' && pathParts[1] === 'inutilizar') {
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
          body: { action: 'inutilizar_nfe', empresa_id, serie, numero_inicial, numero_final, justificativa }
        });
        if (fiscalError || !fiscalResult?.success) {
          return new Response(
            JSON.stringify({ error: 'Erro ao inutilizar NF-e na SEFAZ', code: 'SEFAZ_ERROR', details: fiscalResult?.error || fiscalError?.message }),
            { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        return new Response(
          JSON.stringify({ success: true, data: fiscalResult.data }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (e: any) {
        return new Response(
          JSON.stringify({ error: 'Erro interno ao inutilizar', code: 'INTERNAL_ERROR', details: e?.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // POST /nfe-api/:id/cce - Carta de Correção Eletrônica

    if (method === 'POST' && pathParts.length === 3 && pathParts[0] === 'nfe-api' && pathParts[2] === 'cce') {
      if (!permissoes.includes('cancelar') && !permissoes.includes('gerenciar') && !permissoes.includes('emitir')) {
        return new Response(
          JSON.stringify({ error: 'Permission denied', code: 'PERMISSION_DENIED' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const nfeId = pathParts[1];
      const ccePayload = await req.json().catch(() => ({}));
      const correcao = (ccePayload.correcao || ccePayload.justificativa || '').toString().trim();
      const sequencia = ccePayload.sequencia ? Number(ccePayload.sequencia) : undefined;

      if (correcao.length < 15 || correcao.length > 1000) {
        return new Response(
          JSON.stringify({ error: 'Correção deve ter entre 15 e 1000 caracteres', code: 'VALIDATION_ERROR' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

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

      if (nfeData.status !== 'autorizada') {
        return new Response(
          JSON.stringify({ error: 'CC-e só pode ser emitida para NF-e autorizada', code: 'INVALID_STATUS' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      try {
        const { data: fiscalResult, error: fiscalError } = await supabase.functions.invoke('fiscal-api', {
          body: { action: 'cce_nfe', nfe_id: nfeId, correcao, sequencia }
        });

        if (fiscalError || !fiscalResult?.success) {
          return new Response(
            JSON.stringify({
              error: 'Erro ao registrar CC-e na SEFAZ',
              code: 'SEFAZ_ERROR',
              details: fiscalResult?.error || fiscalError?.message
            }),
            { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        await supabase.rpc('registrar_log', {
          p_empresa_id: empresa_id,
          p_nfce_id: nfeId,
          p_token_api_id: token_id,
          p_tipo: 'sucesso',
          p_categoria: 'api',
          p_mensagem: `CC-e #${fiscalResult.data?.sequencia} registrada para NF-e ${nfeData.numero}`,
          p_detalhes: { correcao, sequencia: fiscalResult.data?.sequencia, protocolo: fiscalResult.data?.protocolo, tipo: 'nfe' },
          p_ip_origem: req.headers.get('x-forwarded-for')
        });

        return new Response(
          JSON.stringify({
            success: true,
            data: {
              id: nfeId,
              evento_id: fiscalResult.data?.id,
              sequencia: fiscalResult.data?.sequencia,
              protocolo: fiscalResult.data?.protocolo,
              cStat: fiscalResult.data?.cStat,
              motivo: fiscalResult.data?.xMotivo,
              status: 'registrada',
            }
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (cceErr: any) {
        console.error('CC-e exception:', cceErr.message);
        return new Response(
          JSON.stringify({ error: 'Erro interno ao registrar CC-e', code: 'INTERNAL_ERROR' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (method === 'POST' && pathParts.length === 3 && pathParts[0] === 'nfe-api' && pathParts[2] === 'reprocessar') {
      if (!permissoes.includes('reprocessar')) {
        return new Response(
          JSON.stringify({ error: 'Permission denied', code: 'PERMISSION_DENIED' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const nfeId = pathParts[1];
      let reprocessBody: Record<string, unknown> = {};
      try {
        const raw = await req.text();
        if (raw?.trim()) reprocessBody = JSON.parse(raw);
      } catch { /* body opcional */ }

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

      if (!['rejeitada', 'pendente', 'processando', 'erro'].includes(nfeData.status)) {
        return new Response(
          JSON.stringify({ error: 'NF-e não pode ser reprocessada neste status', code: 'INVALID_STATUS', status: nfeData.status }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const xmlFromBody = decodeXmlBodyField(
        reprocessBody.xml_envio ?? reprocessBody.xml ?? reprocessBody.nfe_xml ?? reprocessBody.xml_base64,
      );
      const updateFields: Record<string, unknown> = {
        status: 'pendente',
        tentativas: 0,
        erro_processamento: null,
      };
      if (xmlFromBody) {
        updateFields.xml_envio = xmlFromBody;
        console.log(`[nfe-api][reprocessar] xml_envio recebido (${xmlFromBody.length} chars) NF-e ${nfeData.numero}`);
      }

      await supabase.from('nfe').update(updateFields).eq('id', nfeId);
      await supabase.from('fila_processamento_nfe').upsert(
        { nfe_id: nfeId, tentativas: 0, proximo_processamento: new Date().toISOString(), erro_ultimo: null },
        { onConflict: 'nfe_id' },
      );

      let emitStatus = 'pendente';
      try {
        const { data: fiscalResult, error: fiscalError } = await supabase.functions.invoke('fiscal-api', {
          body: { action: 'emit_nfe', nfe_id: nfeId },
        });
        if (!fiscalError && fiscalResult?.success) {
          emitStatus = fiscalResult.data?.status || 'processando';
          await supabase.from('fila_processamento_nfe').delete().eq('nfe_id', nfeId);
        } else {
          console.warn('[nfe-api][reprocessar] fiscal-api:', fiscalError?.message || fiscalResult?.error);
        }
      } catch (e) {
        console.warn('[nfe-api][reprocessar] invoke fiscal-api:', (e as Error).message);
      }

      await supabase.rpc('registrar_log', {
        p_empresa_id: empresa_id,
        p_nfce_id: nfeId,
        p_token_api_id: token_id,
        p_tipo: 'info',
        p_categoria: 'api',
        p_mensagem: `Reprocessamento NF-e ${nfeData.numero}${xmlFromBody ? ' (XML enriquecido)' : ''}`,
        p_ip_origem: req.headers.get('x-forwarded-for'),
      });

      return new Response(
        JSON.stringify({ success: true, data: { id: nfeId, status: emitStatus, xml_atualizado: Boolean(xmlFromBody) } }),
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

      const xmlRetorno = normalizeXmlResponse(nfeData.xml_retorno);
      const xmlEnvio = normalizeXmlResponse(nfeData.xml_envio);
      const xmlFinal = xmlRetorno || xmlEnvio;

      if (url.searchParams.get('raw') === '1') {
        if (!xmlFinal) {
          return new Response(
            JSON.stringify({ error: 'XML indisponível ou inválido', code: 'XML_NOT_AVAILABLE' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        return new Response(xmlFinal, {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/xml; charset=utf-8',
            'Content-Disposition': `attachment; filename="nfe-${nfeId}.xml"`,
          },
        });
      }

      return new Response(
        JSON.stringify({ success: true, data: { xml_envio: xmlEnvio, xml_retorno: xmlRetorno, xml: xmlFinal } }),
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
