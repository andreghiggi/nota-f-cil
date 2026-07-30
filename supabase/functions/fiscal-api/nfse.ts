// ============================================================================
// NFS-e Nacional (SEFIN/ADN) — handlers que delegam ao PHP api2 (php-nfse-nacional)
// Rotas api2: /nfse/status, /nfse/configurar, /nfse/emitir, /nfse/consultar,
//             /nfse/cancelar, /nfse/pdf, /nfse/xml
// ============================================================================

export const FISCAL_API_BASE_URL = 'https://api2.agilizeerp.com.br';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type EnsureRegistered = (supabase: any, empresaId: string) => Promise<{
  empresa: any;
  certificate: { base64: string; senha: string } | null;
  error?: string;
}>;

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function fail(message: string, status = 400, details?: any) {
  return json({ success: false, error: message, details }, status);
}

function digits(v: any): string {
  return String(v ?? '').replace(/\D/g, '');
}

async function callApi2(path: string, apiKey: string, payload: any) {
  const resp = await fetch(`${FISCAL_API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'X-Api-Key': apiKey,
    },
    body: JSON.stringify(payload),
  });
  const text = await resp.text();
  let data: any;
  const looksLikeHtml = /<br\s*\/?>|<b>|Fatal error|Stack trace|<html/i.test(text);
  if (looksLikeHtml) {
    const fatal = text.match(/Uncaught[^<]+/i)?.[0]?.trim()
      || text.match(/Fatal error[^<]+/i)?.[0]?.trim()
      || 'Fatal error PHP na API fiscal NFS-e';
    data = { erro: fatal.substring(0, 500), php_error: true, raw: text.substring(0, 500) };
  } else {
    try { data = JSON.parse(text); } catch { data = { erro: 'Resposta não-JSON da API fiscal', raw: text.substring(0, 500) }; }
  }
  const errMsg = !resp.ok || data?.erro || data?.error || data?.sucesso === false || data?.success === false
    ? String(data?.erro || data?.error || data?.xMotivo || data?.mensagem || `HTTP ${resp.status}`)
    : null;
  return { ok: !errMsg, status: resp.status, data, error: errMsg };
}

/** Sincroniza os dados fiscais municipais da empresa no api2 antes de operar. */
async function syncNfseConfig(empresa: any) {
  try {
    await callApi2('/nfse/configurar', empresa.api_key_fiscal, {
      api_key: empresa.api_key_fiscal,
      im: empresa.inscricao_municipal || '',
      nfse_tpAmb: empresa.ambiente === 'producao' ? 1 : 2,
      nfse_serie: empresa.serie_nfse || '1',
      nfse_op_simp: empresa.nfse_op_simples ?? 0,
      nfse_reg_esp: empresa.nfse_reg_esp ?? 0,
      nfse_incentivo_cultural: empresa.nfse_incentivo_cultural ? 1 : 0,
      nfse_incluir_ibscbs: empresa.nfse_incluir_ibscbs ? 1 : 0,
      cMun: empresa.codigo_municipio || '',
      xMun: empresa.municipio || '',
      logradouro: empresa.logradouro || '',
      numero: empresa.numero || 'S/N',
      bairro: empresa.bairro || '',
      cep: digits(empresa.cep),
      uf: empresa.uf || '',
      siglaUF: empresa.uf || '',
      cnae: digits(empresa.cnae_principal),
    });
  } catch (e) {
    console.warn('NFS-e: falha ao sincronizar configuração no api2:', (e as Error).message);
  }
}

async function getEmpresaPronta(supabase: any, ensureRegistered: EnsureRegistered, empresaId: string) {
  const { empresa, certificate, error } = await ensureRegistered(supabase, empresaId);
  if (error || !empresa?.api_key_fiscal) {
    return { error: 'Empresa não registrada na API fiscal' };
  }
  if (!certificate) {
    return { error: 'Certificado digital A1 não encontrado para a empresa' };
  }
  await syncNfseConfig(empresa);
  return { empresa, certificate };
}

// ---------------------------------------------------------------------------
// Emitir NFS-e
// ---------------------------------------------------------------------------
export async function handleNfseEmit(supabase: any, ensureRegistered: EnsureRegistered, nfseId: string) {
  if (!nfseId) return fail('nfse_id é obrigatório');

  const { data: nfse } = await supabase.from('nfse').select('*').eq('id', nfseId).maybeSingle();
  if (!nfse) return fail('NFS-e não encontrada', 404);

  const prep = await getEmpresaPronta(supabase, ensureRegistered, nfse.empresa_id);
  if (prep.error) return fail(prep.error);
  const { empresa, certificate } = prep as any;

  const p = nfse.payload_entrada || {};
  const tomador = p.tomador || {};
  const servico = p.servico || {};

  const payload = {
    api_key: empresa.api_key_fiscal,
    tpAmb: (nfse.ambiente || empresa.ambiente) === 'producao' ? 1 : 2,
    certificado: { pfx_base64: certificate.base64, senha: certificate.senha },
    nfse: {
      serie: String(nfse.serie || '1'),
      numero: Number(nfse.numero_dps),
      tomador: {
        documento: nfse.tomador_documento,
        nome: nfse.tomador_nome,
        email: nfse.tomador_email || null,
        im: nfse.tomador_im || null,
        telefone: tomador.telefone || null,
        endereco: tomador.endereco || null,
      },
      servico: {
        xDescServ: nfse.discriminacao,
        cMunPrestacao: nfse.codigo_municipio_prestacao || empresa.codigo_municipio,
        cTribNac: nfse.c_trib_nac || undefined,
        cNBS: nfse.c_nbs || undefined,
        cTribMun: nfse.c_trib_mun || undefined,
        cIndOp: servico.c_ind_op || servico.cIndOp || undefined,
      },
      valores: {
        vServ: Number(nfse.valor_servicos),
        vDR: Number(nfse.valor_deducoes || 0),
        pAliq: nfse.aliquota_iss != null ? Number(nfse.aliquota_iss) : undefined,
        issRetido: Number(nfse.iss_retido ?? 1),
      },
    },
  };

  await supabase.from('nfse').update({ status: 'processando' }).eq('id', nfseId);

  const r = await callApi2('/nfse/emitir', empresa.api_key_fiscal, payload);
  const d = r.data || {};

  if (!r.ok) {
    await supabase.from('nfse').update({
      status: 'rejeitada',
      erro_processamento: String(r.error).substring(0, 1000),
      codigo_retorno: d.cStat || d.codigo || null,
      motivo_retorno: String(d.xMotivo || r.error).substring(0, 1000),
      resposta: d,
    }).eq('id', nfseId);
    return fail(`SEFIN: ${r.error}`, 502, d);
  }

  const xmlNfse = d.xml_nfse_base64 ? atob(d.xml_nfse_base64) : null;
  const autorizada = d.status === 'autorizada' || !!d.chave;

  const { data: atualizada } = await supabase.from('nfse').update({
    status: autorizada ? 'autorizada' : 'processando',
    chave_acesso: d.chave || null,
    numero_nfse: d.numero_nfse ? String(d.numero_nfse) : null,
    codigo_verificacao: d.codigo_verificacao || null,
    protocolo: d.protocolo || null,
    codigo_retorno: d.cStat ? String(d.cStat) : null,
    motivo_retorno: d.xMotivo || null,
    xml_nfse: xmlNfse,
    resposta: d,
    erro_processamento: null,
  }).eq('id', nfseId).select().single();

  return json({ success: true, data: atualizada });
}

// ---------------------------------------------------------------------------
// Consultar NFS-e
// ---------------------------------------------------------------------------
export async function handleNfseConsultar(supabase: any, ensureRegistered: EnsureRegistered, nfseId: string) {
  if (!nfseId) return fail('nfse_id é obrigatório');
  const { data: nfse } = await supabase.from('nfse').select('*').eq('id', nfseId).maybeSingle();
  if (!nfse) return fail('NFS-e não encontrada', 404);
  if (!nfse.chave_acesso) return fail('NFS-e sem chave de acesso — não é possível consultar');

  const prep = await getEmpresaPronta(supabase, ensureRegistered, nfse.empresa_id);
  if (prep.error) return fail(prep.error);
  const { empresa, certificate } = prep as any;

  const r = await callApi2('/nfse/consultar', empresa.api_key_fiscal, {
    api_key: empresa.api_key_fiscal,
    chave: nfse.chave_acesso,
    certificado: { pfx_base64: certificate.base64, senha: certificate.senha },
  });
  if (!r.ok) return fail(`SEFIN: ${r.error}`, 502, r.data);

  const d = r.data;
  const status = d.status === 'cancelada' ? 'cancelada' : (d.status === 'autorizada' ? 'autorizada' : nfse.status);
  await supabase.from('nfse').update({
    status,
    numero_nfse: d.numero_nfse ? String(d.numero_nfse) : nfse.numero_nfse,
    protocolo: d.protocolo || nfse.protocolo,
    codigo_retorno: d.cStat ? String(d.cStat) : nfse.codigo_retorno,
    motivo_retorno: d.xMotivo || nfse.motivo_retorno,
    xml_nfse: d.xml_nfse_base64 ? atob(d.xml_nfse_base64) : nfse.xml_nfse,
    resposta: d,
  }).eq('id', nfseId);

  return json({ success: true, data: { ...d, status } });
}

// ---------------------------------------------------------------------------
// Cancelar NFS-e
// ---------------------------------------------------------------------------
export async function handleNfseCancelar(
  supabase: any,
  ensureRegistered: EnsureRegistered,
  nfseId: string,
  justificativa: string,
  motivo?: number,
) {
  if (!nfseId) return fail('nfse_id é obrigatório');
  if (!justificativa || justificativa.trim().length < 15) {
    return fail('Justificativa com no mínimo 15 caracteres é obrigatória');
  }
  const { data: nfse } = await supabase.from('nfse').select('*').eq('id', nfseId).maybeSingle();
  if (!nfse) return fail('NFS-e não encontrada', 404);
  if (!nfse.chave_acesso) return fail('NFS-e sem chave de acesso — nada a cancelar');

  const prep = await getEmpresaPronta(supabase, ensureRegistered, nfse.empresa_id);
  if (prep.error) return fail(prep.error);
  const { empresa, certificate } = prep as any;

  const r = await callApi2('/nfse/cancelar', empresa.api_key_fiscal, {
    api_key: empresa.api_key_fiscal,
    chave: nfse.chave_acesso,
    justificativa: justificativa.trim(),
    motivo: motivo ?? 1,
    certificado: { pfx_base64: certificate.base64, senha: certificate.senha },
  });
  if (!r.ok) return fail(`SEFIN: ${r.error}`, 502, r.data);

  const d = r.data;
  await supabase.from('nfse').update({
    status: 'cancelada',
    data_cancelamento: new Date().toISOString(),
    justificativa_cancelamento: justificativa.trim(),
    protocolo: d.protocolo || nfse.protocolo,
    codigo_retorno: d.cStat ? String(d.cStat) : nfse.codigo_retorno,
    motivo_retorno: d.xMotivo || nfse.motivo_retorno,
    resposta: d,
  }).eq('id', nfseId);

  return json({ success: true, data: { id: nfseId, status: 'cancelada', ...d } });
}

// ---------------------------------------------------------------------------
// DANFSe (PDF) — gerado pelo api2 a partir do XML autorizado
// ---------------------------------------------------------------------------
export async function handleNfseDanfse(supabase: any, ensureRegistered: EnsureRegistered, nfseId: string) {
  if (!nfseId) return fail('nfse_id é obrigatório');
  const { data: nfse } = await supabase.from('nfse').select('*').eq('id', nfseId).maybeSingle();
  if (!nfse) return fail('NFS-e não encontrada', 404);

  const prep = await getEmpresaPronta(supabase, ensureRegistered, nfse.empresa_id);
  if (prep.error) return fail(prep.error);
  const { empresa, certificate } = prep as any;

  const body: any = {
    api_key: empresa.api_key_fiscal,
    tipo: 'base64',
    certificado: { pfx_base64: certificate.base64, senha: certificate.senha },
  };
  if (nfse.xml_nfse) body.xml = nfse.xml_nfse;
  else if (nfse.chave_acesso) body.chave = nfse.chave_acesso;
  else return fail('NFS-e sem XML autorizado para gerar o DANFSe');

  const r = await callApi2('/nfse/pdf', empresa.api_key_fiscal, body);
  if (!r.ok || !r.data?.pdf_base64) return fail(`Falha ao gerar DANFSe: ${r.error || 'sem PDF'}`, 502, r.data);

  return json({
    success: true,
    data: {
      pdf_base64: r.data.pdf_base64,
      filename: `danfse-${nfse.chave_acesso || nfse.numero_dps}.pdf`,
      chave: nfse.chave_acesso,
    },
  });
}

// ---------------------------------------------------------------------------
// XML autorizado
// ---------------------------------------------------------------------------
export async function handleNfseXml(supabase: any, ensureRegistered: EnsureRegistered, nfseId: string) {
  if (!nfseId) return fail('nfse_id é obrigatório');
  const { data: nfse } = await supabase.from('nfse').select('*').eq('id', nfseId).maybeSingle();
  if (!nfse) return fail('NFS-e não encontrada', 404);

  if (nfse.xml_nfse) {
    return json({ success: true, data: { chave: nfse.chave_acesso, xml: nfse.xml_nfse } });
  }
  if (!nfse.chave_acesso) return fail('NFS-e sem XML disponível');

  const prep = await getEmpresaPronta(supabase, ensureRegistered, nfse.empresa_id);
  if (prep.error) return fail(prep.error);
  const { empresa, certificate } = prep as any;

  const r = await callApi2('/nfse/xml', empresa.api_key_fiscal, {
    api_key: empresa.api_key_fiscal,
    chave: nfse.chave_acesso,
    certificado: { pfx_base64: certificate.base64, senha: certificate.senha },
  });
  if (!r.ok || !r.data?.xml_base64) return fail(`Falha ao baixar XML: ${r.error || 'sem XML'}`, 502, r.data);

  const xml = atob(r.data.xml_base64);
  await supabase.from('nfse').update({ xml_nfse: xml }).eq('id', nfseId);
  return json({ success: true, data: { chave: nfse.chave_acesso, xml } });
}

// ---------------------------------------------------------------------------
// Status do módulo no api2
// ---------------------------------------------------------------------------
export async function handleNfseStatus() {
  try {
    const resp = await fetch(`${FISCAL_API_BASE_URL}/nfse/status`);
    const data = await resp.json().catch(() => ({}));
    return json({ success: true, data });
  } catch (e) {
    return fail('Módulo NFS-e indisponível no servidor fiscal: ' + (e as Error).message, 502);
  }
}
