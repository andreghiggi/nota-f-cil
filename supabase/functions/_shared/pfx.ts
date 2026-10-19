// Validação real de certificado A1 (PKCS#12) — abre o arquivo com a senha
// antes de qualquer gravação. Suporta cifras antigas (RC2/3DES) e modernas (AES).
import forge from "npm:node-forge@1.3.1";

export interface PfxInfo {
  ok: boolean;
  error?: string;
  code?: string;
  documento?: string | null;
  tipoPessoa?: "PJ" | "PF" | null;
  titular?: string | null;
  emissor?: string | null;
  dataEmissao?: string;
  dataVencimento?: string;
  expirado?: boolean;
}

export function normalizeBase64(input: string): string {
  let s = String(input || "").trim();
  const comma = s.indexOf("base64,");
  if (comma >= 0) s = s.slice(comma + 7);
  s = s.replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return s;
}

export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Codifica a senha em base64 preservando UTF-8 (fiscal-api decodifica com atob). */
export function encodeSenha(senha: string): string {
  const bytes = new TextEncoder().encode(senha);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function extractDoc(cert: any): { doc: string | null; tipo: "PJ" | "PF" | null } {
  const cn = cert.subject.getField("CN")?.value || "";
  const m14 = cn.match(/:(\d{14})\b/);
  if (m14) return { doc: m14[1], tipo: "PJ" };
  const m11 = cn.match(/:(\d{11})\b/);
  if (m11) return { doc: m11[1], tipo: "PF" };
  // OIDs ICP-Brasil no SubjectAltName: 2.16.76.1.3.3 (CNPJ) / 2.16.76.1.3.1 (CPF)
  try {
    const der = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
    const idxCnpj = der.indexOf(forge.asn1.oidToDer("2.16.76.1.3.3").getBytes());
    if (idxCnpj >= 0) {
      const m = der.slice(idxCnpj, idxCnpj + 40).match(/\d{14}/);
      if (m) return { doc: m[0], tipo: "PJ" };
    }
    const idxCpf = der.indexOf(forge.asn1.oidToDer("2.16.76.1.3.1").getBytes());
    if (idxCpf >= 0) {
      const m = der.slice(idxCpf, idxCpf + 40).match(/\d{8}(\d{11})/);
      if (m) return { doc: m[1], tipo: "PF" };
    }
  } catch { /* ignore */ }
  const any14 = cn.match(/\d{14}/);
  if (any14) return { doc: any14[0], tipo: "PJ" };
  return { doc: null, tipo: null };
}

export function parsePfx(base64: string, senha: string): PfxInfo {
  let bytes: string;
  try {
    bytes = atob(normalizeBase64(base64));
  } catch {
    return { ok: false, code: "CERT_BASE64_INVALIDO", error: "Arquivo do certificado não está em Base64 válido." };
  }
  if (bytes.length < 500) {
    return { ok: false, code: "CERT_ARQUIVO_INVALIDO", error: "Arquivo do certificado muito pequeno ou incompleto." };
  }
  let p12: any;
  try {
    const asn1 = forge.asn1.fromDer(bytes);
    p12 = forge.pkcs12.pkcs12FromAsn1(asn1, false, senha);
  } catch (e: any) {
    const msg = String(e?.message || e);
    if (/mac|password|invalid/i.test(msg)) {
      return { ok: false, code: "CERT_SENHA_INCORRETA", error: "Senha do certificado incorreta para este arquivo (.pfx). Confira a senha e envie novamente." };
    }
    return { ok: false, code: "CERT_ARQUIVO_INVALIDO", error: "Arquivo não é um certificado A1 (.pfx/.p12) válido ou está corrompido." };
  }
  const keyBags = [
    ...(p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] || []),
    ...(p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] || []),
  ];
  if (!keyBags.length || !keyBags[0]?.key) {
    return { ok: false, code: "CERT_SEM_CHAVE", error: "O certificado não contém a chave privada. Exporte o .pfx incluindo a chave privada." };
  }
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] || [];
  const key = keyBags[0].key;
  // Certificado do titular = o que corresponde à chave privada
  let cert = certBags.find((b: any) => {
    try { return b.cert && b.cert.publicKey.n.equals(key.n); } catch { return false; }
  })?.cert || certBags[0]?.cert;
  if (!cert) return { ok: false, code: "CERT_SEM_CERTIFICADO", error: "Nenhum certificado encontrado dentro do arquivo." };

  const { doc, tipo } = extractDoc(cert);
  const notAfter: Date = cert.validity.notAfter;
  return {
    ok: true,
    documento: doc,
    tipoPessoa: tipo,
    titular: cert.subject.getField("CN")?.value || null,
    emissor: cert.issuer.getField("CN")?.value || null,
    dataEmissao: cert.validity.notBefore.toISOString().split("T")[0],
    dataVencimento: notAfter.toISOString().split("T")[0],
    expirado: notAfter.getTime() < Date.now(),
  };
}

export function certStatus(dataVencimento: string): "valido" | "expirando" | "expirado" {
  const dias = Math.ceil((new Date(dataVencimento).getTime() - Date.now()) / 86400000);
  if (dias <= 0) return "expirado";
  if (dias <= 30) return "expirando";
  return "valido";
}

/**
 * Valida e grava o certificado de forma atômica:
 * 1) abre o PFX com a senha (nada é gravado se falhar);
 * 2) confere CNPJ/CPF com a empresa;
 * 3) grava o arquivo em caminho NOVO; só então troca o registro;
 * 4) se a troca falhar, remove o arquivo novo — o certificado anterior segue ativo.
 */
export async function saveCertificadoAtomico(
  supabase: any,
  empresaId: string,
  base64: string,
  senha: string,
): Promise<{ ok: boolean; status: number; error?: string; code?: string; data?: any }> {
  if (!base64 || !senha) {
    return { ok: false, status: 400, code: "CERT_CAMPOS", error: "Campos certificado_base64 e senha são obrigatórios." };
  }
  const info = parsePfx(base64, senha);
  if (!info.ok) return { ok: false, status: 422, code: info.code, error: info.error };
  if (info.expirado) {
    return { ok: false, status: 422, code: "CERT_EXPIRADO", error: `Certificado vencido em ${info.dataVencimento}. Envie um certificado válido.` };
  }

  const { data: empresa } = await supabase
    .from("empresas").select("cnpj, cpf, tipo_pessoa").eq("id", empresaId).maybeSingle();
  const docEmp = String((empresa?.tipo_pessoa === "PF" ? empresa?.cpf : empresa?.cnpj) || empresa?.cnpj || empresa?.cpf || "").replace(/\D/g, "");
  if (info.documento && docEmp) {
    const sameRoot = info.documento.length === 14 && docEmp.length === 14 && info.documento.slice(0, 8) === docEmp.slice(0, 8);
    if (info.documento !== docEmp && !sameRoot) {
      return { ok: false, status: 422, code: "CERT_DOCUMENTO_DIVERGENTE", error: `O certificado pertence ao documento ${info.documento}, diferente do cadastro da empresa (${docEmp}).` };
    }
  }

  const bytes = base64ToBytes(normalizeBase64(base64));
  const path = `${empresaId}/${docEmp || "cert"}_${Date.now()}.pfx`;
  const { error: upErr } = await supabase.storage.from("certificados")
    .upload(path, bytes, { contentType: "application/x-pkcs12", upsert: false });
  if (upErr) return { ok: false, status: 500, code: "CERT_STORAGE", error: "Erro ao armazenar o certificado. O certificado anterior foi mantido." };

  const row = {
    arquivo_path: path,
    senha_hash: encodeSenha(senha),
    cnpj_certificado: info.documento || docEmp || null,
    emissor: info.emissor,
    data_emissao: info.dataEmissao,
    data_vencimento: info.dataVencimento,
    status: certStatus(info.dataVencimento!),
    updated_at: new Date().toISOString(),
  };
  const { data: existing } = await supabase
    .from("certificados_digitais").select("id, arquivo_path").eq("empresa_id", empresaId).maybeSingle();
  const res = existing
    ? await supabase.from("certificados_digitais").update(row).eq("id", existing.id).select().single()
    : await supabase.from("certificados_digitais").insert({ empresa_id: empresaId, tipo: "A1", ...row }).select().single();
  if (res.error) {
    await supabase.storage.from("certificados").remove([path]);
    return { ok: false, status: 500, code: "CERT_DB", error: "Erro ao salvar o certificado. O certificado anterior foi mantido." };
  }
  // Força nova sincronização com a API2 (empresa re-registrada no próximo envio)
  try { await supabase.from("empresas").update({ updated_at: new Date().toISOString() }).eq("id", empresaId); } catch { /* opcional */ }

  return {
    ok: true, status: 201,
    data: {
      titular: info.titular, cnpj: row.cnpj_certificado, emissor: info.emissor,
      data_emissao: info.dataEmissao, validade: info.dataVencimento, status: row.status,
      certificado: res.data,
      message: "Certificado validado (arquivo e senha conferidos) e ativado com sucesso.",
    },
  };
}
