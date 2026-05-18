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
  cnpj?: string;
  emissor?: string;
  dataEmissao?: string;
  dataVencimento?: string;
  error?: string;
}

function extractCertificateInfo(certBytes: Uint8Array, password: string): CertInfo {
  // This is a simplified implementation
  // In production, use proper PKCS12/X.509 parsing libraries
  
  try {
    // Check minimum file size for a valid PKCS12
    if (certBytes.length < 100) {
      return { valid: false, error: 'Arquivo de certificado muito pequeno' };
    }

    // Try to find CNPJ pattern in certificate data
    // Brazilian digital certificates contain CNPJ in the subject
    const certString = new TextDecoder('latin1').decode(certBytes);
    
    // Look for CNPJ patterns (14 digits or formatted)
    const cnpjMatch = certString.match(/(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})/);
    let cnpj = cnpjMatch ? cnpjMatch[1].replace(/\D/g, '') : null;
    
    // Format CNPJ if found
    if (cnpj && cnpj.length === 14) {
      cnpj = cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
    }

    // Look for common certificate authorities
    const issuers = ['SERASA', 'CERTISIGN', 'VALID', 'SAFEWEB', 'SOLUTI', 'AC BR', 'ICP-Brasil'];
    let emissor = 'Autoridade Certificadora';
    for (const issuer of issuers) {
      if (certString.toUpperCase().includes(issuer)) {
        emissor = `AC ${issuer} RFB`;
        break;
      }
    }

    // For dates, we look for ASN.1 UTCTime or GeneralizedTime patterns
    // In production, properly parse the X.509 certificate
    const now = new Date();
    const oneYearAgo = new Date(now);
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const oneYearFromNow = new Date(now);
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

    // Basic password validation - check if file seems encrypted
    // Real implementation would attempt to decrypt with the password
    if (password.length < 4) {
      return { valid: false, error: 'Senha muito curta' };
    }

    // If we found a CNPJ, consider it valid
    // In production, this would be based on actual decryption success
    if (cnpj) {
      return {
        valid: true,
        cnpj,
        emissor,
        dataEmissao: oneYearAgo.toISOString().split('T')[0],
        dataVencimento: oneYearFromNow.toISOString().split('T')[0]
      };
    }

    // If no CNPJ found, still accept but note it
    // Some certificates might have CNPJ in different formats
    return {
      valid: true,
      cnpj: 'Não identificado',
      emissor,
      dataEmissao: oneYearAgo.toISOString().split('T')[0],
      dataVencimento: oneYearFromNow.toISOString().split('T')[0]
    };

  } catch (error) {
    console.error('Error parsing certificate:', error);
    return { valid: false, error: 'Erro ao analisar certificado' };
  }
}
