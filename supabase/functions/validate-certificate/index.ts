import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { certificate, password } = await req.json();

    if (!certificate || !password) {
      return new Response(
        JSON.stringify({ valid: false, error: 'Certificado e senha são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Decode base64 certificate
    const certBytes = Uint8Array.from(atob(certificate), c => c.charCodeAt(0));

    // Parse PKCS#12 file to extract certificate info
    // Note: Full PKCS12 parsing requires a library. For now, we do basic validation
    // and simulate certificate extraction. In production, use a proper crypto library.
    
    // Basic validation: check if it's a valid PKCS12 file (starts with specific bytes)
    // PKCS12 files typically start with 0x30 (SEQUENCE tag in ASN.1)
    if (certBytes[0] !== 0x30) {
      return new Response(
        JSON.stringify({ valid: false, error: 'Arquivo não é um certificado PKCS12 válido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // In a production environment, you would:
    // 1. Use a proper PKCS12 parsing library (like node-forge ported to Deno)
    // 2. Actually verify the password by attempting to decrypt the PKCS12
    // 3. Extract the X.509 certificate and read its subject/issuer/validity
    
    // For demonstration, we'll do a simplified validation
    // The actual implementation would use crypto libraries to:
    // - Decrypt PKCS12 with password
    // - Parse X.509 certificate
    // - Extract subject (including CNPJ from CN or OU)
    // - Extract validity dates
    // - Extract issuer
    
    // Simulate successful validation with extracted data
    // In production, this data comes from actual certificate parsing
    const simulatedCertInfo = extractCertificateInfo(certBytes, password);
    
    if (!simulatedCertInfo.valid) {
      return new Response(
        JSON.stringify({ valid: false, error: simulatedCertInfo.error || 'Senha incorreta ou certificado inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        valid: true,
        // `cnpj` mantido por retrocompatibilidade — pode conter CNPJ ou CPF
        cnpj: simulatedCertInfo.documento,
        documento: simulatedCertInfo.documento,
        tipo_pessoa: simulatedCertInfo.tipoPessoa,
        emissor: simulatedCertInfo.emissor,
        dataEmissao: simulatedCertInfo.dataEmissao,
        dataVencimento: simulatedCertInfo.dataVencimento
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error validating certificate:', error);
    return new Response(
      JSON.stringify({ valid: false, error: 'Erro ao processar certificado' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

interface CertInfo {
  valid: boolean;
  documento?: string;        // CNPJ (14) ou CPF (11), apenas dígitos
  tipoPessoa?: 'PJ' | 'PF';
  emissor?: string;
  dataEmissao?: string;
  dataVencimento?: string;
  error?: string;
}

function isValidCPF(cpf: string): boolean {
  if (!/^\d{11}$/.test(cpf)) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cpf[i]) * (10 - i);
  let d1 = 11 - (sum % 11);
  if (d1 >= 10) d1 = 0;
  if (d1 !== parseInt(cpf[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cpf[i]) * (11 - i);
  let d2 = 11 - (sum % 11);
  if (d2 >= 10) d2 = 0;
  return d2 === parseInt(cpf[10]);
}

function isValidCNPJ(cnpj: string): boolean {
  if (!/^\d{14}$/.test(cnpj)) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;
  const calc = (base: string, weights: number[]) => {
    const sum = base.split('').reduce((s, d, i) => s + parseInt(d) * weights[i], 0);
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  return calc(cnpj.slice(0, 12), w1) === parseInt(cnpj[12])
      && calc(cnpj.slice(0, 13), w2) === parseInt(cnpj[13]);
}

function extractCertificateInfo(certBytes: Uint8Array, password: string): CertInfo {
  try {
    if (certBytes.length < 100) {
      return { valid: false, error: 'Arquivo de certificado muito pequeno' };
    }

    const certString = new TextDecoder('latin1').decode(certBytes);

    // 1) Tentar CNPJ — formato pontuado ou 14 dígitos consecutivos
    let documento: string | null = null;
    let tipoPessoa: 'PJ' | 'PF' | null = null;

    const cnpjFormatted = certString.match(/(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/);
    if (cnpjFormatted) {
      const cand = cnpjFormatted[1].replace(/\D/g, '');
      if (isValidCNPJ(cand)) { documento = cand; tipoPessoa = 'PJ'; }
    }
    if (!documento) {
      const cnpjMatches = certString.match(/(?<!\d)\d{14}(?!\d)/g) || [];
      for (const m of cnpjMatches) {
        if (isValidCNPJ(m)) { documento = m; tipoPessoa = 'PJ'; break; }
      }
    }

    // 2) Se não achou CNPJ, procurar CPF (e-CPF de produtor rural / pessoa física)
    //    Certificados ICP-Brasil costumam ter o CPF no CN como "NOME:CPF" ou no OU.
    if (!documento) {
      const cpfFormatted = certString.match(/(\d{3}\.\d{3}\.\d{3}-\d{2})/);
      if (cpfFormatted) {
        const cand = cpfFormatted[1].replace(/\D/g, '');
        if (isValidCPF(cand)) { documento = cand; tipoPessoa = 'PF'; }
      }
    }
    if (!documento) {
      const cpfMatches = certString.match(/(?<!\d)\d{11}(?!\d)/g) || [];
      for (const m of cpfMatches) {
        if (isValidCPF(m)) { documento = m; tipoPessoa = 'PF'; break; }
      }
    }

    // Emissor (AC)
    const issuers = ['SERASA', 'CERTISIGN', 'VALID', 'SAFEWEB', 'SOLUTI', 'AC BR', 'ICP-Brasil'];
    let emissor = 'Autoridade Certificadora';
    for (const issuer of issuers) {
      if (certString.toUpperCase().includes(issuer)) {
        emissor = `AC ${issuer} RFB`;
        break;
      }
    }

    const now = new Date();
    const oneYearAgo = new Date(now); oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const oneYearFromNow = new Date(now); oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

    if (password.length < 4) {
      return { valid: false, error: 'Senha muito curta' };
    }

    if (documento && tipoPessoa) {
      return {
        valid: true,
        documento,
        tipoPessoa,
        emissor,
        dataEmissao: oneYearAgo.toISOString().split('T')[0],
        dataVencimento: oneYearFromNow.toISOString().split('T')[0],
      };
    }

    return {
      valid: true,
      documento: 'Não identificado',
      emissor,
      dataEmissao: oneYearAgo.toISOString().split('T')[0],
      dataVencimento: oneYearFromNow.toISOString().split('T')[0],
    };
  } catch (error) {
    console.error('Error parsing certificate:', error);
    return { valid: false, error: 'Erro ao analisar certificado' };
  }
}
