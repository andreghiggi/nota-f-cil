import { parsePfx } from "../_shared/pfx.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const { certificate, password } = await req.json();
    if (!certificate || !password) return json({ valid: false, error: 'Certificado e senha são obrigatórios' });
    // Abre o PFX de verdade com a senha (mesma validação usada nos uploads via API)
    const info = parsePfx(certificate, password);
    if (!info.ok) return json({ valid: false, error: info.error, code: info.code });
    if (info.expirado) return json({ valid: false, error: `Certificado vencido em ${info.dataVencimento}.`, code: 'CERT_EXPIRADO' });
    return json({
      valid: true,
      cnpj: info.documento || 'Não identificado',
      documento: info.documento || 'Não identificado',
      tipo_pessoa: info.tipoPessoa,
      titular: info.titular,
      emissor: info.emissor,
      dataEmissao: info.dataEmissao,
      dataVencimento: info.dataVencimento,
    });
  } catch (error) {
    console.error('Error validating certificate:', error);
    return json({ valid: false, error: 'Erro ao processar certificado' });
  }
});
