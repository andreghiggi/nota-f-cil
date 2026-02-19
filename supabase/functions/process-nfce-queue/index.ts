import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import forge from 'npm:node-forge@1.3.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================================
// CONFIGURAÇÃO SEFAZ RS (foco inicial)
// ============================================================================

interface SefazEndpoints {
  autorizacao: string;
  retAutorizacao: string;
  consulta: string;
  statusServico: string;
  recepcaoEvento: string;
}

// Endpoints SEFAZ RS para NFC-e
const SEFAZ_RS_ENDPOINTS: Record<string, SefazEndpoints> = {
  homologacao: {
    autorizacao: 'https://nfce-homologacao.sefazrs.rs.gov.br/ws/NfeAutorizacao/NfeAutorizacao4.asmx',
    retAutorizacao: 'https://nfce-homologacao.sefazrs.rs.gov.br/ws/NfeRetAutorizacao/NfeRetAutorizacao4.asmx',
    consulta: 'https://nfce-homologacao.sefazrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx',
    statusServico: 'https://nfce-homologacao.sefazrs.rs.gov.br/ws/NfeStatusServico/NfeStatusServico4.asmx',
    recepcaoEvento: 'https://nfce-homologacao.sefazrs.rs.gov.br/ws/recepcaoevento/recepcaoevento4.asmx',
  },
  producao: {
    autorizacao: 'https://nfce.sefazrs.rs.gov.br/ws/NfeAutorizacao/NfeAutorizacao4.asmx',
    retAutorizacao: 'https://nfce.sefazrs.rs.gov.br/ws/NfeRetAutorizacao/NfeRetAutorizacao4.asmx',
    consulta: 'https://nfce.sefazrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx',
    statusServico: 'https://nfce.sefazrs.rs.gov.br/ws/NfeStatusServico/NfeStatusServico4.asmx',
    recepcaoEvento: 'https://nfce.sefazrs.rs.gov.br/ws/recepcaoevento/recepcaoevento4.asmx',
  },
};

// SVRS endpoints (para outros estados que usam SEFAZ Virtual RS)
const SVRS_ENDPOINTS: Record<string, SefazEndpoints> = {
  homologacao: {
    autorizacao: 'https://nfce-homologacao.svrs.rs.gov.br/ws/NfeAutorizacao/NfeAutorizacao4.asmx',
    retAutorizacao: 'https://nfce-homologacao.svrs.rs.gov.br/ws/NfeRetAutorizacao/NfeRetAutorizacao4.asmx',
    consulta: 'https://nfce-homologacao.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx',
    statusServico: 'https://nfce-homologacao.svrs.rs.gov.br/ws/NfeStatusServico/NfeStatusServico4.asmx',
    recepcaoEvento: 'https://nfce-homologacao.svrs.rs.gov.br/ws/RecepcaoEvento/RecepcaoEvento4.asmx',
  },
  producao: {
    autorizacao: 'https://nfce.svrs.rs.gov.br/ws/NfeAutorizacao/NfeAutorizacao4.asmx',
    retAutorizacao: 'https://nfce.svrs.rs.gov.br/ws/NfeRetAutorizacao/NfeRetAutorizacao4.asmx',
    consulta: 'https://nfce.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx',
    statusServico: 'https://nfce.svrs.rs.gov.br/ws/NfeStatusServico/NfeStatusServico4.asmx',
    recepcaoEvento: 'https://nfce.svrs.rs.gov.br/ws/RecepcaoEvento/RecepcaoEvento4.asmx',
  },
};

// QR Code consultation URLs
const QRCODE_URLS: Record<string, Record<string, string>> = {
  RS: { homologacao: 'https://www.sefaz.rs.gov.br/NFCE/NFCE-COM.aspx', producao: 'https://www.sefaz.rs.gov.br/NFCE/NFCE-COM.aspx' },
};

// Códigos IBGE dos estados
const UF_CODIGOS: Record<string, string> = {
  'AC': '12', 'AL': '27', 'AP': '16', 'AM': '13', 'BA': '29', 'CE': '23',
  'DF': '53', 'ES': '32', 'GO': '52', 'MA': '21', 'MT': '51', 'MS': '50',
  'MG': '31', 'PA': '15', 'PB': '25', 'PR': '41', 'PE': '26', 'PI': '22',
  'RJ': '33', 'RN': '24', 'RS': '43', 'RO': '11', 'RR': '14', 'SC': '42',
  'SP': '35', 'SE': '28', 'TO': '17'
};

// ============================================================================
// INTERFACES
// ============================================================================

interface NFCeItem {
  numero_item: number;
  codigo_produto: string;
  descricao: string;
  ncm: string | null;
  cfop: string;
  unidade: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  cst_icms: string | null;
  csosn: string | null;
  aliquota_icms: number;
  valor_icms: number;
  cst_pis: string | null;
  aliquota_pis: number;
  valor_pis: number;
  cst_cofins: string | null;
  aliquota_cofins: number;
  valor_cofins: number;
}

interface NFCeData {
  id: string;
  empresa_id: string;
  numero: string;
  serie: string;
  ambiente: 'homologacao' | 'producao';
  valor_total: number;
  valor_produtos: number;
  valor_desconto: number;
  valor_frete: number;
  valor_icms: number;
  valor_pis: number;
  valor_cofins: number;
  data_emissao: string;
  payload_entrada: any;
}

interface EmpresaData {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string | null;
  inscricao_estadual: string | null;
  uf: string;
  municipio: string;
  codigo_municipio: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cep: string | null;
  telefone: string | null;
  regime_tributario: string;
  csc_id: string | null;
  csc_token: string | null;
}

interface CertificadoData {
  arquivo_path: string;
  senha_hash: string | null;
  cnpj_certificado: string | null;
}

interface ParsedCertificate {
  privateKey: forge.pki.rsa.PrivateKey;
  certificate: forge.pki.Certificate;
  certPem: string;
  keyPem: string;
}

// ============================================================================
// FUNÇÕES AUXILIARES
// ============================================================================

function getSefazEndpoints(uf: string, ambiente: 'homologacao' | 'producao'): SefazEndpoints {
  if (uf === 'RS') {
    return SEFAZ_RS_ENDPOINTS[ambiente];
  }
  // Para outros estados, usar SVRS por enquanto
  return SVRS_ENDPOINTS[ambiente];
}

function getQRCodeBaseUrl(uf: string, ambiente: 'homologacao' | 'producao'): string {
  const urls = QRCODE_URLS[uf];
  if (!urls) {
    return 'https://www.sefaz.rs.gov.br/NFCE/NFCE-COM.aspx';
  }
  return urls[ambiente];
}

// Generate access key (chave de acesso) for NFC-e
function generateChaveAcesso(
  uf: string,
  dataEmissao: Date,
  cnpj: string,
  modelo: string,
  serie: string,
  numero: string,
  tipoEmissao: string,
  codigoNumerico: string
): string {
  const ano = dataEmissao.getFullYear().toString().slice(-2);
  const mes = (dataEmissao.getMonth() + 1).toString().padStart(2, '0');
  
  const cUF = UF_CODIGOS[uf] || '43';
  const AAMM = ano + mes;
  const CNPJ = cnpj.replace(/\D/g, '').padStart(14, '0');
  const mod = modelo.padStart(2, '0');
  const ser = serie.padStart(3, '0');
  const nNF = numero.padStart(9, '0');
  const tpEmis = tipoEmissao;
  const cNF = codigoNumerico.padStart(8, '0');
  
  const chaveBase = cUF + AAMM + CNPJ + mod + ser + nNF + tpEmis + cNF;
  
  // Calculate DV (verification digit) using mod 11
  let peso = 2;
  let soma = 0;
  for (let i = chaveBase.length - 1; i >= 0; i--) {
    soma += parseInt(chaveBase[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  const dv = resto < 2 ? 0 : 11 - resto;
  
  return chaveBase + dv.toString();
}

// QR Code hash using SHA-1
async function generateQRCodeHash(data: string, cscToken: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataWithCSC = data + cscToken;
  const hashBuffer = await crypto.subtle.digest('SHA-1', encoder.encode(dataWithCSC));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

// Generate QR Code URL - NFC-e QR Code Versão 2.00 (NT 2015.002)
// Online (sem contingência): URL?p=chNFe|nVersao|tpAmb|cIdToken|cHashQRCode
async function generateQRCodeUrl(
  uf: string,
  chaveAcesso: string,
  ambiente: 'homologacao' | 'producao',
  cscId: string,
  cscToken: string,
): Promise<string> {
  const tpAmb = ambiente === 'producao' ? '1' : '2';
  const baseUrl = getQRCodeBaseUrl(uf, ambiente);
  
  // Formato ONLINE (sem contingência) - 5 campos conforme NT 2015.002
  const qrCodeData = `${chaveAcesso}|2|${tpAmb}|${cscId}|`;
  const hash = await generateQRCodeHash(qrCodeData, cscToken);
  return `${baseUrl}?p=${qrCodeData}${hash}`;
}

function getCRT(regimeTributario: string): string {
  switch (regimeTributario) {
    case 'simples_nacional': return '1';
    case 'simples_nacional_excesso': return '2';
    case 'lucro_presumido':
    case 'lucro_real': return '3';
    default: return '1';
  }
}

function formatDateTimeXML(date: Date): string {
  return date.toISOString().replace('Z', '-03:00');
}

// ============================================================================
// CERTIFICADO DIGITAL - PARSE PFX
// ============================================================================

async function downloadAndParsePfx(
  supabase: any,
  certificado: CertificadoData
): Promise<ParsedCertificate> {
  console.log('🔐 Downloading certificate from storage...');
  
  // Download PFX from storage
  const { data: pfxData, error: downloadError } = await supabase.storage
    .from('certificados')
    .download(certificado.arquivo_path);
  
  if (downloadError || !pfxData) {
    throw new Error(`Erro ao baixar certificado: ${downloadError?.message || 'Arquivo não encontrado'}`);
  }
  
  // Decode password from base64
  const password = certificado.senha_hash ? atob(certificado.senha_hash) : '';
  
  // Parse PFX with node-forge
  console.log('🔐 Parsing PFX certificate...');
  const pfxArrayBuffer = await pfxData.arrayBuffer();
  const pfxBinary = forge.util.createBuffer(new Uint8Array(pfxArrayBuffer));
  const pfxAsn1 = forge.asn1.fromDer(pfxBinary);
  const pfx = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, password);
  
  // Extract private key
  const keyBags = pfx.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
  const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag];
  if (!keyBag || keyBag.length === 0 || !keyBag[0].key) {
    throw new Error('Chave privada não encontrada no certificado');
  }
  const privateKey = keyBag[0].key as forge.pki.rsa.PrivateKey;
  
  // Extract ALL certificates (end-entity + intermediate CAs) for full chain
  const certBags = pfx.getBags({ bagType: forge.pki.oids.certBag });
  const certBag = certBags[forge.pki.oids.certBag];
  if (!certBag || certBag.length === 0) {
    throw new Error('Certificado não encontrado no arquivo PFX');
  }
  
  // Find the end-entity certificate (the one matching the private key)
  let certificate: forge.pki.Certificate | null = null;
  const allCerts: forge.pki.Certificate[] = [];
  
  for (const bag of certBag) {
    if (bag.cert) {
      allCerts.push(bag.cert);
      // The end-entity cert is the one whose public key matches our private key
      try {
        const certPublicKeyPem = forge.pki.publicKeyToPem(bag.cert.publicKey);
        const privPublicKeyPem = forge.pki.publicKeyToPem(forge.pki.rsa.setPublicKey(
          (privateKey as any).n, (privateKey as any).e
        ));
        if (certPublicKeyPem === privPublicKeyPem) {
          certificate = bag.cert;
        }
      } catch {
        // If comparison fails, try by subject/issuer
      }
    }
  }
  
  // Fallback: use first certificate if no match found
  if (!certificate) {
    certificate = allCerts[0];
  }
  
  // Build full certificate chain PEM (end-entity first, then intermediaries)
  // Sort: end-entity cert first, then CAs ordered by chain
  const chainCerts = [certificate];
  const remainingCerts = allCerts.filter(c => c !== certificate);
  
  // Order remaining certs by chain (each cert's issuer should match next cert's subject)
  let current = certificate;
  for (let i = 0; i < remainingCerts.length; i++) {
    const issuerCN = current.issuer.getField('CN')?.value;
    const nextCert = remainingCerts.find(c => c.subject.getField('CN')?.value === issuerCN);
    if (nextCert) {
      chainCerts.push(nextCert);
      current = nextCert;
    }
  }
  
  // Build full chain PEM (all certs concatenated)
  const certPem = chainCerts.map(c => forge.pki.certificateToPem(c)).join('\n');
  const keyPem = forge.pki.privateKeyToPem(privateKey);
  
  console.log('✅ Certificate parsed successfully');
  console.log(`   Subject: ${certificate.subject.getField('CN')?.value}`);
  console.log(`   Issuer: ${certificate.issuer.getField('CN')?.value}`);
  console.log(`   Valid until: ${certificate.validity.notAfter.toISOString()}`);
  console.log(`   Chain certificates: ${chainCerts.length} (total in PFX: ${allCerts.length})`);
  
  return { privateKey, certificate, certPem, keyPem };
}

// ============================================================================
// ASSINATURA DIGITAL XML - XMLDSig (RSA-SHA1 + C14N)
// ============================================================================

// Simplified Canonical XML 1.0 for our generated XML
// Since we control the XML generation, we ensure it's already canonical-compatible
function canonicalize(xml: string): string {
  // Remove XML declaration
  let canonical = xml.replace(/<\?xml[^?]*\?>\s*/g, '');
  // Remove extra whitespace between tags (but preserve content)
  canonical = canonical.replace(/>\s+</g, '><');
  // Ensure no self-closing tags (except for those without content)
  // For NFC-e, all our tags either have content or are explicitly closed
  return canonical.trim();
}

// Extract the infNFe element from the XML (the part that gets signed)
function extractInfNFe(xml: string): string {
  const match = xml.match(/<infNFe[^>]*>[\s\S]*<\/infNFe>/);
  if (!match) throw new Error('infNFe element not found in XML');
  return match[0];
}

// Compute SHA-1 digest and return as base64
function computeSha1Digest(data: string): string {
  const md = forge.md.sha1.create();
  md.update(data, 'utf8');
  return forge.util.encode64(md.digest().getBytes());
}

// Sign data with RSA-SHA1 and return as base64
function rsaSha1Sign(data: string, privateKey: forge.pki.rsa.PrivateKey): string {
  const md = forge.md.sha1.create();
  md.update(data, 'utf8');
  const signature = privateKey.sign(md);
  return forge.util.encode64(signature);
}

// Get X.509 certificate as base64 (DER format, no PEM headers)
function getCertificateBase64(certificate: forge.pki.Certificate): string {
  const certAsn1 = forge.pki.certificateToAsn1(certificate);
  const certDer = forge.asn1.toDer(certAsn1).getBytes();
  return forge.util.encode64(certDer);
}

// Sign NFC-e XML with XMLDSig
function signNFCeXml(
  xml: string,
  chaveAcesso: string,
  parsedCert: ParsedCertificate
): string {
  console.log('✍️ Signing XML with certificate...');
  
  // 1. Extract and canonicalize infNFe
  const infNFe = extractInfNFe(xml);
  const canonicalInfNFe = canonicalize(infNFe);
  
  // 2. Compute SHA-1 digest of canonicalized infNFe
  const digestValue = computeSha1Digest(canonicalInfNFe);
  console.log(`   DigestValue: ${digestValue.substring(0, 20)}...`);
  
  // 3. Build SignedInfo element
  const signedInfo = `<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#"><CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"></CanonicalizationMethod><SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"></SignatureMethod><Reference URI="#NFe${chaveAcesso}"><Transforms><Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"></Transform><Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"></Transform></Transforms><DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"></DigestMethod><DigestValue>${digestValue}</DigestValue></Reference></SignedInfo>`;
  
  // 4. Canonicalize SignedInfo  
  const canonicalSignedInfo = canonicalize(signedInfo);
  
  // 5. Sign canonicalized SignedInfo with RSA-SHA1
  const signatureValue = rsaSha1Sign(canonicalSignedInfo, parsedCert.privateKey);
  console.log(`   SignatureValue: ${signatureValue.substring(0, 20)}...`);
  
  // 6. Get X.509 certificate as base64
  const x509Certificate = getCertificateBase64(parsedCert.certificate);
  
  // 7. Build complete Signature element
  const signatureElement = `<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">${signedInfo}<SignatureValue>${signatureValue}</SignatureValue><KeyInfo><X509Data><X509Certificate>${x509Certificate}</X509Certificate></X509Data></KeyInfo></Signature>`;
  
  // 8. Insert Signature after </infNFe> and before </NFe>
  const signedXml = xml.replace('</NFe>', `${signatureElement}</NFe>`);
  
  console.log('✅ XML signed successfully');
  return signedXml;
}

// ============================================================================
// TRANSMISSÃO SEFAZ VIA mTLS (usando node:https para suporte adequado)
// ============================================================================

async function sendSoapToSefaz(
  url: string,
  soapBody: string,
  certPem: string,
  keyPem: string
): Promise<string> {
  console.log(`📤 Sending SOAP request to: ${url}`);
  
  // Use node:https for proper mTLS support
  const https = await import('node:https');
  const { URL } = await import('node:url');
  
  const parsedUrl = new URL(url);
  
  return new Promise((resolve, reject) => {
    const options = {
      hostname: parsedUrl.hostname,
      port: 443,
      path: parsedUrl.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/soap+xml; charset=utf-8; action="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4/nfeAutorizacaoLote"',
        'Content-Length': new TextEncoder().encode(soapBody).length,
      },
      cert: certPem,
      key: keyPem,
      rejectUnauthorized: false, // SEFAZ uses ICP-Brasil certs, skip strict chain validation
    };
    
    const req = https.request(options, (res: any) => {
      let data = '';
      res.on('data', (chunk: any) => { data += chunk; });
      res.on('end', () => {
        console.log(`📥 SEFAZ response status: ${res.statusCode}`);
        
        if (res.statusCode === 403) {
          reject(new Error(`SEFAZ retornou 403 (Acesso Negado). Verifique se o CNPJ está credenciado para NFC-e no ambiente de homologação/produção da SEFAZ do estado. Resposta: ${data.substring(0, 300)}`));
          return;
        }
        
        if (res.statusCode >= 500) {
          reject(new Error(`SEFAZ retornou status HTTP ${res.statusCode}. Resposta: ${data.substring(0, 300)}`));
          return;
        }
        
        resolve(data);
      });
    });
    
    req.on('error', (error: any) => {
      console.error(`❌ HTTPS request error: ${error.message}`);
      reject(new Error(`Erro de conexão com SEFAZ: ${error.message}`));
    });
    
    req.write(soapBody);
    req.end();
  });
}

// ============================================================================
// XML GENERATION
// ============================================================================

function generateNFCeXML(
  nfce: NFCeData,
  empresa: EmpresaData,
  itens: NFCeItem[],
  chaveAcesso: string,
  codigoNumerico: string
): string {
  const dataEmissao = new Date(nfce.data_emissao);
  const dhEmi = formatDateTimeXML(dataEmissao);
  const tpAmb = nfce.ambiente === 'producao' ? '1' : '2';
  const cUF = UF_CODIGOS[empresa.uf] || '43';
  const cRT = getCRT(empresa.regime_tributario);
  
  const xNome = nfce.ambiente === 'homologacao' 
    ? 'NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL'
    : empresa.razao_social.substring(0, 60);
  
  let xml = `<NFe xmlns="http://www.portalfiscal.inf.br/nfe">`;
  xml += `<infNFe versao="4.00" Id="NFe${chaveAcesso}">`;
  
  // Identificação da NFC-e
  xml += `<ide>`;
  xml += `<cUF>${cUF}</cUF>`;
  xml += `<cNF>${codigoNumerico}</cNF>`;
  xml += `<natOp>VENDA</natOp>`;
  xml += `<mod>65</mod>`;
  xml += `<serie>${nfce.serie}</serie>`;
  xml += `<nNF>${nfce.numero}</nNF>`;
  xml += `<dhEmi>${dhEmi}</dhEmi>`;
  xml += `<tpNF>1</tpNF>`;
  xml += `<idDest>1</idDest>`;
  xml += `<cMunFG>${empresa.codigo_municipio || '0000000'}</cMunFG>`;
  xml += `<tpImp>4</tpImp>`;
  xml += `<tpEmis>1</tpEmis>`;
  xml += `<cDV>${chaveAcesso.slice(-1)}</cDV>`;
  xml += `<tpAmb>${tpAmb}</tpAmb>`;
  xml += `<finNFe>1</finNFe>`;
  xml += `<indFinal>1</indFinal>`;
  xml += `<indPres>1</indPres>`;
  xml += `<procEmi>0</procEmi>`;
  xml += `<verProc>NFCE-API-1.0</verProc>`;
  xml += `</ide>`;
  
  // Emitente
  xml += `<emit>`;
  xml += `<CNPJ>${empresa.cnpj.replace(/\D/g, '')}</CNPJ>`;
  xml += `<xNome>${xNome}</xNome>`;
  if (empresa.nome_fantasia) {
    xml += `<xFant>${empresa.nome_fantasia.substring(0, 60)}</xFant>`;
  }
  xml += `<enderEmit>`;
  xml += `<xLgr>${empresa.logradouro || 'NAO INFORMADO'}</xLgr>`;
  xml += `<nro>${empresa.numero || 'S/N'}</nro>`;
  if (empresa.complemento) {
    xml += `<xCpl>${empresa.complemento}</xCpl>`;
  }
  xml += `<xBairro>${empresa.bairro || 'NAO INFORMADO'}</xBairro>`;
  xml += `<cMun>${empresa.codigo_municipio || '0000000'}</cMun>`;
  xml += `<xMun>${empresa.municipio}</xMun>`;
  xml += `<UF>${empresa.uf}</UF>`;
  xml += `<CEP>${(empresa.cep || '00000000').replace(/\D/g, '')}</CEP>`;
  xml += `<cPais>1058</cPais>`;
  xml += `<xPais>BRASIL</xPais>`;
  if (empresa.telefone) {
    xml += `<fone>${empresa.telefone.replace(/\D/g, '')}</fone>`;
  }
  xml += `</enderEmit>`;
  if (empresa.inscricao_estadual) {
    xml += `<IE>${empresa.inscricao_estadual.replace(/\D/g, '')}</IE>`;
  }
  xml += `<CRT>${cRT}</CRT>`;
  xml += `</emit>`;
  
  // Destinatário (opcional em NFC-e para valores < R$ 200,00)
  const dest = nfce.payload_entrada?.destinatario;
  if (dest) {
    xml += `<dest>`;
    if (dest.cpf) {
      xml += `<CPF>${dest.cpf.replace(/\D/g, '')}</CPF>`;
    } else if (dest.cnpj) {
      xml += `<CNPJ>${dest.cnpj.replace(/\D/g, '')}</CNPJ>`;
    }
    if (dest.nome) {
      xml += `<xNome>${dest.nome.substring(0, 60)}</xNome>`;
    }
    xml += `<indIEDest>9</indIEDest>`;
    xml += `</dest>`;
  }
  
  // Itens (detalhes)
  for (const item of itens) {
    xml += `<det nItem="${item.numero_item}">`;
    xml += `<prod>`;
    xml += `<cProd>${item.codigo_produto}</cProd>`;
    xml += `<cEAN>SEM GTIN</cEAN>`;
    xml += `<xProd>${nfce.ambiente === 'homologacao' ? 'NOTA FISCAL EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL' : item.descricao}</xProd>`;
    xml += `<NCM>${item.ncm || '00000000'}</NCM>`;
    xml += `<CFOP>${item.cfop}</CFOP>`;
    xml += `<uCom>${item.unidade}</uCom>`;
    xml += `<qCom>${item.quantidade.toFixed(4)}</qCom>`;
    xml += `<vUnCom>${item.valor_unitario.toFixed(10)}</vUnCom>`;
    xml += `<vProd>${item.valor_total.toFixed(2)}</vProd>`;
    xml += `<cEANTrib>SEM GTIN</cEANTrib>`;
    xml += `<uTrib>${item.unidade}</uTrib>`;
    xml += `<qTrib>${item.quantidade.toFixed(4)}</qTrib>`;
    xml += `<vUnTrib>${item.valor_unitario.toFixed(10)}</vUnTrib>`;
    xml += `<indTot>1</indTot>`;
    xml += `</prod>`;
    
    // Impostos
    xml += `<imposto>`;
    xml += `<ICMS>`;
    if (cRT === '1') {
      xml += `<ICMSSN102>`;
      xml += `<orig>0</orig>`;
      xml += `<CSOSN>${item.csosn || '102'}</CSOSN>`;
      xml += `</ICMSSN102>`;
    } else {
      xml += `<ICMS00>`;
      xml += `<orig>0</orig>`;
      xml += `<CST>${item.cst_icms || '00'}</CST>`;
      xml += `<modBC>0</modBC>`;
      xml += `<vBC>${item.valor_total.toFixed(2)}</vBC>`;
      xml += `<pICMS>${(item.aliquota_icms || 0).toFixed(2)}</pICMS>`;
      xml += `<vICMS>${(item.valor_icms || 0).toFixed(2)}</vICMS>`;
      xml += `</ICMS00>`;
    }
    xml += `</ICMS>`;
    
    xml += `<PIS>`;
    xml += `<PISOutr>`;
    xml += `<CST>${item.cst_pis || '99'}</CST>`;
    xml += `<vBC>0.00</vBC>`;
    xml += `<pPIS>0.00</pPIS>`;
    xml += `<vPIS>0.00</vPIS>`;
    xml += `</PISOutr>`;
    xml += `</PIS>`;
    
    xml += `<COFINS>`;
    xml += `<COFINSOutr>`;
    xml += `<CST>${item.cst_cofins || '99'}</CST>`;
    xml += `<vBC>0.00</vBC>`;
    xml += `<pCOFINS>0.00</pCOFINS>`;
    xml += `<vCOFINS>0.00</vCOFINS>`;
    xml += `</COFINSOutr>`;
    xml += `</COFINS>`;
    xml += `</imposto>`;
    
    xml += `</det>`;
  }
  
  // Totais
  xml += `<total>`;
  xml += `<ICMSTot>`;
  xml += `<vBC>${(nfce.valor_total - (nfce.valor_desconto || 0)).toFixed(2)}</vBC>`;
  xml += `<vICMS>${(nfce.valor_icms || 0).toFixed(2)}</vICMS>`;
  xml += `<vICMSDeson>0.00</vICMSDeson>`;
  xml += `<vFCPUFDest>0.00</vFCPUFDest>`;
  xml += `<vICMSUFDest>0.00</vICMSUFDest>`;
  xml += `<vICMSUFRemet>0.00</vICMSUFRemet>`;
  xml += `<vFCP>0.00</vFCP>`;
  xml += `<vBCST>0.00</vBCST>`;
  xml += `<vST>0.00</vST>`;
  xml += `<vFCPST>0.00</vFCPST>`;
  xml += `<vFCPSTRet>0.00</vFCPSTRet>`;
  xml += `<vProd>${(nfce.valor_produtos || nfce.valor_total).toFixed(2)}</vProd>`;
  xml += `<vFrete>${(nfce.valor_frete || 0).toFixed(2)}</vFrete>`;
  xml += `<vSeg>0.00</vSeg>`;
  xml += `<vDesc>${(nfce.valor_desconto || 0).toFixed(2)}</vDesc>`;
  xml += `<vII>0.00</vII>`;
  xml += `<vIPI>0.00</vIPI>`;
  xml += `<vIPIDevol>0.00</vIPIDevol>`;
  xml += `<vPIS>${(nfce.valor_pis || 0).toFixed(2)}</vPIS>`;
  xml += `<vCOFINS>${(nfce.valor_cofins || 0).toFixed(2)}</vCOFINS>`;
  xml += `<vOutro>0.00</vOutro>`;
  xml += `<vNF>${nfce.valor_total.toFixed(2)}</vNF>`;
  xml += `</ICMSTot>`;
  xml += `</total>`;
  
  // Transporte
  xml += `<transp>`;
  xml += `<modFrete>9</modFrete>`;
  xml += `</transp>`;
  
  // Pagamento
  const pagamentos = nfce.payload_entrada?.pagamentos || [{ tipo: '01', valor: nfce.valor_total }];
  xml += `<pag>`;
  for (const pag of pagamentos) {
    xml += `<detPag>`;
    xml += `<tPag>${pag.tipo || '01'}</tPag>`;
    xml += `<vPag>${(pag.valor || nfce.valor_total).toFixed(2)}</vPag>`;
    xml += `</detPag>`;
  }
  xml += `<vTroco>${(nfce.payload_entrada?.troco || 0).toFixed(2)}</vTroco>`;
  xml += `</pag>`;
  
  // Informações adicionais
  xml += `<infAdic>`;
  xml += `<infCpl>NFC-e emitida via API AgilizeERP</infCpl>`;
  xml += `</infAdic>`;
  
  xml += `</infNFe>`;
  xml += `</NFe>`;
  
  return xml;
}

// Generate SOAP envelope for NFC-e authorization (lote síncrono)
// NF-e 4.00 (NT 2016/002): nfeCabecMsg was REMOVED from SOAP header
function generateSOAPEnvelope(signedXml: string, cUF: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?><soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body><nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4"><enviNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><idLote>${Date.now()}</idLote><indSinc>1</indSinc>${signedXml}</enviNFe></nfeDadosMsg></soap12:Body></soap12:Envelope>`;
}

// Parse SEFAZ response
function parseSefazResponse(responseXml: string): {
  cStat: string;
  xMotivo: string;
  nProt?: string;
  dhRecbto?: string;
  digVal?: string;
} {
  // Try to find protocol info in the response (may be in protNFe or retEnviNFe)
  const cStatMatches = responseXml.match(/<cStat>(\d+)<\/cStat>/g);
  const xMotivoMatches = responseXml.match(/<xMotivo>([^<]+)<\/xMotivo>/g);
  const nProtMatch = responseXml.match(/<nProt>(\d+)<\/nProt>/);
  const dhRecbtoMatch = responseXml.match(/<dhRecbto>([^<]+)<\/dhRecbto>/);
  const digValMatch = responseXml.match(/<digVal>([^<]+)<\/digVal>/);
  
  // For synchronous processing, the last cStat/xMotivo is the authorization result
  let cStat = '999';
  let xMotivo = 'Erro ao processar resposta da SEFAZ';
  
  if (cStatMatches && cStatMatches.length > 0) {
    // Get the last cStat (which is the individual authorization result)
    const lastMatch = cStatMatches[cStatMatches.length - 1];
    const val = lastMatch.match(/<cStat>(\d+)<\/cStat>/);
    if (val) cStat = val[1];
  }
  
  if (xMotivoMatches && xMotivoMatches.length > 0) {
    const lastMatch = xMotivoMatches[xMotivoMatches.length - 1];
    const val = lastMatch.match(/<xMotivo>([^<]+)<\/xMotivo>/);
    if (val) xMotivo = val[1];
  }
  
  return {
    cStat,
    xMotivo,
    nProt: nProtMatch ? nProtMatch[1] : undefined,
    dhRecbto: dhRecbtoMatch ? dhRecbtoMatch[1] : undefined,
    digVal: digValMatch ? digValMatch[1] : undefined,
  };
}

// ============================================================================
// MAIN: SEND TO SEFAZ
// ============================================================================

async function sendToSefaz(
  nfce: NFCeData, 
  empresa: EmpresaData, 
  itens: NFCeItem[],
  certificado: CertificadoData | null,
  supabase: any
): Promise<{
  success: boolean;
  protocolo?: string;
  chaveAcesso?: string;
  qrcodeUrl?: string;
  codigoRetorno: string;
  motivoRetorno: string;
  xmlEnvio?: string;
  xmlRetorno?: string;
}> {
  const codigoNumerico = Math.floor(Math.random() * 99999999).toString().padStart(8, '0');
  
  const chaveAcesso = generateChaveAcesso(
    empresa.uf,
    new Date(nfce.data_emissao),
    empresa.cnpj,
    '65',
    nfce.serie,
    nfce.numero,
    '1',
    codigoNumerico
  );
  
  console.log(`📍 Estado: ${empresa.uf} | Ambiente: ${nfce.ambiente}`);
  console.log(`🔑 Chave de Acesso: ${chaveAcesso}`);
  
  // Validate prerequisites
  if (!empresa.csc_id || !empresa.csc_token) {
    return {
      success: false,
      codigoRetorno: '450',
      motivoRetorno: 'CSC não configurado para a empresa. Configure o CSC antes de emitir NFC-e.',
    };
  }
  
  if (!empresa.logradouro || !empresa.bairro || !empresa.cep || !empresa.codigo_municipio) {
    return {
      success: false,
      codigoRetorno: '451',
      motivoRetorno: 'Endereço incompleto. Preencha logradouro, bairro, CEP e código do município.',
    };
  }
  
  // CERTIFICADO OBRIGATÓRIO para transmissão real
  if (!certificado) {
    return {
      success: false,
      codigoRetorno: '280',
      motivoRetorno: 'Certificado digital não encontrado ou expirado. Configure o certificado A1 da empresa.',
    };
  }
  
  // Parse PFX certificate
  let parsedCert: ParsedCertificate;
  try {
    parsedCert = await downloadAndParsePfx(supabase, certificado);
  } catch (error: any) {
    return {
      success: false,
      codigoRetorno: '281',
      motivoRetorno: `Erro ao processar certificado digital: ${error.message}`,
    };
  }
  
  // Generate XML
  const xmlNFCe = generateNFCeXML(nfce, empresa, itens, chaveAcesso, codigoNumerico);
  
  // Sign XML with certificate
  let signedXml: string;
  try {
    signedXml = signNFCeXml(xmlNFCe, chaveAcesso, parsedCert);
  } catch (error: any) {
    return {
      success: false,
      chaveAcesso,
      codigoRetorno: '282',
      motivoRetorno: `Erro na assinatura digital do XML: ${error.message}`,
      xmlEnvio: xmlNFCe,
    };
  }
  
  // Generate QR Code URL (formato online v2 - NT 2015.002)
  const qrcodeUrl = await generateQRCodeUrl(
    empresa.uf,
    chaveAcesso,
    nfce.ambiente,
    empresa.csc_id,
    empresa.csc_token,
  );
  
  // Get SEFAZ endpoints
  const endpoints = getSefazEndpoints(empresa.uf, nfce.ambiente);
  console.log(`🌐 Endpoint SEFAZ: ${endpoints.autorizacao}`);
  
  // Generate SOAP envelope with signed XML
  const cUF = UF_CODIGOS[empresa.uf] || '43';
  const soapEnvelope = generateSOAPEnvelope(signedXml, cUF);
  
  // ===== DIAGNOSTIC: Test statusServico first =====
  try {
    const statusSoapBody = `<?xml version="1.0" encoding="UTF-8"?><soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body><nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4"><consStatServ xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><tpAmb>${nfce.ambiente === 'producao' ? '1' : '2'}</tpAmb><cUF>${cUF}</cUF><xServ>STATUS</xServ></consStatServ></nfeDadosMsg></soap12:Body></soap12:Envelope>`;
    
    console.log(`🔍 DIAGNOSTIC: Testing statusServico at ${endpoints.statusServico}`);
    const statusResponse = await sendSoapToSefaz(
      endpoints.statusServico,
      statusSoapBody,
      parsedCert.certPem,
      parsedCert.keyPem
    );
    console.log(`🔍 DIAGNOSTIC statusServico response (${statusResponse.length} bytes): ${statusResponse.substring(0, 500)}`);
  } catch (statusError: any) {
    console.log(`🔍 DIAGNOSTIC statusServico ERROR: ${statusError.message}`);
  }
  // ===== END DIAGNOSTIC =====
  
  // Send to SEFAZ via mTLS
  try {
    console.log('📤 Transmitindo NFC-e para SEFAZ...');
    
    const responseXml = await sendSoapToSefaz(
      endpoints.autorizacao,
      soapEnvelope,
      parsedCert.certPem,
      parsedCert.keyPem
    );
    
    console.log(`📥 Resposta SEFAZ recebida (${responseXml.length} bytes)`);
    console.log(`📥 Response preview: ${responseXml.substring(0, 800)}`);
    
    // Parse response
    const parsed = parseSefazResponse(responseXml);
    console.log(`   cStat: ${parsed.cStat} | xMotivo: ${parsed.xMotivo}`);
    
    // Status 100 = Autorizado, 104 = Lote processado
    if (parsed.cStat === '100') {
      return {
        success: true,
        protocolo: parsed.nProt,
        chaveAcesso,
        qrcodeUrl,
        codigoRetorno: parsed.cStat,
        motivoRetorno: parsed.xMotivo,
        xmlEnvio: signedXml,
        xmlRetorno: responseXml,
      };
    } else if (parsed.cStat === '104') {
      // Lote processado - check individual status
      // For synchronous processing with indSinc=1, the result is embedded
      const innerParsed = parseSefazResponse(responseXml);
      if (innerParsed.nProt) {
        return {
          success: true,
          protocolo: innerParsed.nProt,
          chaveAcesso,
          qrcodeUrl,
          codigoRetorno: '100',
          motivoRetorno: innerParsed.xMotivo,
          xmlEnvio: signedXml,
          xmlRetorno: responseXml,
        };
      }
      return {
        success: false,
        chaveAcesso,
        codigoRetorno: parsed.cStat,
        motivoRetorno: parsed.xMotivo,
        xmlEnvio: signedXml,
        xmlRetorno: responseXml,
      };
    } else {
      // Rejection or error
      return {
        success: false,
        chaveAcesso,
        codigoRetorno: parsed.cStat,
        motivoRetorno: parsed.xMotivo,
        xmlEnvio: signedXml,
        xmlRetorno: responseXml,
      };
    }
  } catch (error: any) {
    console.error('❌ Erro na transmissão SEFAZ:', error.message);
    
    return {
      success: false,
      chaveAcesso,
      codigoRetorno: '999',
      motivoRetorno: `Erro de comunicação com SEFAZ: ${error.message}`,
      xmlEnvio: signedXml,
    };
  }
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    console.log('🔄 Starting NFC-e processing worker...');
    console.log(`📅 Timestamp: ${new Date().toISOString()}`);

    // Get pending items from processing queue
    const { data: filaItems, error: filaError } = await supabase
      .from('fila_processamento')
      .select('*')
      .lte('proximo_processamento', new Date().toISOString())
      .lt('tentativas', 3)
      .order('prioridade', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(10);

    if (filaError) {
      console.error('Error fetching queue:', filaError);
      throw filaError;
    }

    if (!filaItems || filaItems.length === 0) {
      console.log('✓ No pending items in queue');
      return new Response(
        JSON.stringify({ success: true, message: 'No pending items', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📋 Found ${filaItems.length} items to process`);

    let processed = 0;
    let authorized = 0;
    let rejected = 0;

    for (const item of filaItems) {
      try {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`🔄 Processing NFC-e ID: ${item.nfce_id}`);

        // Get NFC-e data
        const { data: nfce, error: nfceError } = await supabase
          .from('nfce')
          .select('*')
          .eq('id', item.nfce_id)
          .single();

        if (nfceError || !nfce) {
          console.error(`NFC-e not found: ${item.nfce_id}`);
          await supabase.from('fila_processamento').delete().eq('id', item.id);
          continue;
        }

        // Skip if already processed
        if (['autorizada', 'cancelada', 'denegada'].includes(nfce.status)) {
          console.log(`NFC-e ${nfce.numero} already processed with status: ${nfce.status}`);
          await supabase.from('fila_processamento').delete().eq('id', item.id);
          continue;
        }

        // Update status to processing
        await supabase.from('nfce').update({ status: 'processando' }).eq('id', item.nfce_id);

        // Get empresa data
        const { data: empresa, error: empresaError } = await supabase
          .from('empresas')
          .select('*')
          .eq('id', nfce.empresa_id)
          .single();

        if (empresaError || !empresa) {
          throw new Error('Empresa não encontrada');
        }

        console.log(`🏢 Empresa: ${empresa.razao_social} (${empresa.uf})`);
        console.log(`📝 NFC-e: ${nfce.numero}/${nfce.serie} - R$ ${nfce.valor_total}`);

        // Get NFC-e items
        const { data: itens } = await supabase
          .from('nfce_itens')
          .select('*')
          .eq('nfce_id', item.nfce_id)
          .order('numero_item', { ascending: true });

        // Get valid certificate
        const { data: certificado } = await supabase
          .from('certificados_digitais')
          .select('arquivo_path, senha_hash, cnpj_certificado')
          .eq('empresa_id', nfce.empresa_id)
          .in('status', ['valido', 'expirando'])
          .order('data_vencimento', { ascending: false })
          .limit(1)
          .maybeSingle();

        // Send to SEFAZ (transmissão real com assinatura digital)
        const result = await sendToSefaz(nfce, empresa, itens || [], certificado, supabase);

        if (result.success) {
          console.log(`✅ NFC-e ${nfce.numero} authorized - Protocol: ${result.protocolo}`);

          await supabase.from('nfce').update({
            status: 'autorizada',
            chave_acesso: result.chaveAcesso,
            protocolo: result.protocolo,
            qrcode_url: result.qrcodeUrl,
            codigo_retorno: result.codigoRetorno,
            motivo_retorno: result.motivoRetorno,
            xml_envio: result.xmlEnvio,
            xml_retorno: result.xmlRetorno,
            data_autorizacao: new Date().toISOString(),
            processado_em: new Date().toISOString(),
            tentativas: nfce.tentativas + 1,
          }).eq('id', item.nfce_id);

          await supabase.from('fila_processamento').delete().eq('id', item.id);

          await supabase.rpc('registrar_log', {
            p_empresa_id: nfce.empresa_id,
            p_nfce_id: nfce.id,
            p_token_api_id: nfce.token_api_id,
            p_tipo: 'info',
            p_categoria: 'sefaz',
            p_mensagem: `NFC-e ${nfce.numero} autorizada com protocolo ${result.protocolo}`,
            p_detalhes: { 
              chave_acesso: result.chaveAcesso,
              codigo_retorno: result.codigoRetorno,
              uf: empresa.uf,
            },
          });

          try {
            await supabase.functions.invoke('send-webhook', {
              body: { nfce_id: nfce.id, evento: 'nfce.autorizada' }
            });
          } catch (webhookError) {
            console.error('Webhook dispatch error:', webhookError);
          }

          authorized++;
        } else {
          console.log(`❌ NFC-e ${nfce.numero} rejected: ${result.motivoRetorno}`);

          const novasTentativas = item.tentativas + 1;
          const isDenegada = result.codigoRetorno.startsWith('3');
          
          await supabase.from('nfce').update({
            status: isDenegada ? 'denegada' : (novasTentativas >= 3 ? 'rejeitada' : 'pendente'),
            chave_acesso: result.chaveAcesso,
            codigo_retorno: result.codigoRetorno,
            motivo_retorno: result.motivoRetorno,
            erro_processamento: result.motivoRetorno,
            xml_envio: result.xmlEnvio,
            xml_retorno: result.xmlRetorno,
            processado_em: new Date().toISOString(),
            tentativas: nfce.tentativas + 1,
          }).eq('id', item.nfce_id);

          if (isDenegada || novasTentativas >= 3) {
            await supabase.from('fila_processamento').delete().eq('id', item.id);
          } else {
            const nextRetry = new Date();
            nextRetry.setMinutes(nextRetry.getMinutes() + Math.pow(2, novasTentativas) * 5);
            
            await supabase.from('fila_processamento').update({
              tentativas: novasTentativas,
              proximo_processamento: nextRetry.toISOString(),
              erro_ultimo: result.motivoRetorno,
            }).eq('id', item.id);
          }

          await supabase.rpc('registrar_log', {
            p_empresa_id: nfce.empresa_id,
            p_nfce_id: nfce.id,
            p_token_api_id: nfce.token_api_id,
            p_tipo: 'error',
            p_categoria: 'sefaz',
            p_mensagem: `NFC-e ${nfce.numero} rejeitada: ${result.motivoRetorno}`,
            p_detalhes: { 
              codigo_retorno: result.codigoRetorno,
              tentativa: novasTentativas,
              uf: empresa.uf,
            },
          });

          if (isDenegada || novasTentativas >= 3) {
            try {
              const webhookEvento = isDenegada ? 'nfce.denegada' : 'nfce.rejeitada';
              await supabase.functions.invoke('send-webhook', {
                body: { nfce_id: nfce.id, evento: webhookEvento }
              });
            } catch (webhookError) {
              console.error('Webhook dispatch error:', webhookError);
            }
          }

          rejected++;
        }

        processed++;
      } catch (itemError: any) {
        console.error(`Error processing item ${item.id}:`, itemError);
        
        await supabase.from('fila_processamento').update({
          tentativas: item.tentativas + 1,
          erro_ultimo: itemError.message,
          proximo_processamento: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        }).eq('id', item.id);

        await supabase.from('nfce').update({ 
          status: 'pendente', 
          erro_processamento: itemError.message 
        }).eq('id', item.nfce_id);
      }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ Processing complete: ${processed} processed, ${authorized} authorized, ${rejected} rejected`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Processing complete',
        stats: { processed, authorized, rejected }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Fatal error in worker:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
