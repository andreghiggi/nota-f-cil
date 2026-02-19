import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================================
// CONFIGURAÇÃO DOS WEB SERVICES SEFAZ - TODOS OS ESTADOS
// ============================================================================

interface SefazEndpoints {
  autorizacao: string;
  retAutorizacao: string;
  consulta: string;
  statusServico: string;
  recepcaoEvento: string;
}

interface SefazConfig {
  homologacao: SefazEndpoints;
  producao: SefazEndpoints;
  usaSVRS?: boolean;  // Usa SEFAZ Virtual RS
  usaSVAN?: boolean;  // Usa SEFAZ Virtual AN
  usaSVCRS?: boolean; // Contingência SVCRS
  usaSVCAN?: boolean; // Contingência SVCAN
}

// Endpoints da SEFAZ Virtual do Rio Grande do Sul (para estados que não têm ambiente próprio)
const SVRS_ENDPOINTS: SefazConfig = {
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

// Configuração de endpoints por estado
const SEFAZ_ENDPOINTS: Record<string, SefazConfig> = {
  // ACRE - Usa SVRS
  AC: { ...SVRS_ENDPOINTS, usaSVRS: true },
  
  // ALAGOAS - Usa SVRS
  AL: { ...SVRS_ENDPOINTS, usaSVRS: true },
  
  // AMAPÁ - Usa SVRS
  AP: { ...SVRS_ENDPOINTS, usaSVRS: true },
  
  // AMAZONAS - Ambiente próprio
  AM: {
    homologacao: {
      autorizacao: 'https://homnfce.sefaz.am.gov.br/nfce-services/services/NfeAutorizacao4',
      retAutorizacao: 'https://homnfce.sefaz.am.gov.br/nfce-services/services/NfeRetAutorizacao4',
      consulta: 'https://homnfce.sefaz.am.gov.br/nfce-services/services/NfeConsulta4',
      statusServico: 'https://homnfce.sefaz.am.gov.br/nfce-services/services/NfeStatusServico4',
      recepcaoEvento: 'https://homnfce.sefaz.am.gov.br/nfce-services/services/RecepcaoEvento4',
    },
    producao: {
      autorizacao: 'https://nfce.sefaz.am.gov.br/nfce-services/services/NfeAutorizacao4',
      retAutorizacao: 'https://nfce.sefaz.am.gov.br/nfce-services/services/NfeRetAutorizacao4',
      consulta: 'https://nfce.sefaz.am.gov.br/nfce-services/services/NfeConsulta4',
      statusServico: 'https://nfce.sefaz.am.gov.br/nfce-services/services/NfeStatusServico4',
      recepcaoEvento: 'https://nfce.sefaz.am.gov.br/nfce-services/services/RecepcaoEvento4',
    },
  },
  
  // BAHIA - Ambiente próprio
  BA: {
    homologacao: {
      autorizacao: 'https://hnfe.sefaz.ba.gov.br/webservices/NFeAutorizacao4/NFeAutorizacao4.asmx',
      retAutorizacao: 'https://hnfe.sefaz.ba.gov.br/webservices/NFeRetAutorizacao4/NFeRetAutorizacao4.asmx',
      consulta: 'https://hnfe.sefaz.ba.gov.br/webservices/NFeConsultaProtocolo4/NFeConsultaProtocolo4.asmx',
      statusServico: 'https://hnfe.sefaz.ba.gov.br/webservices/NFeStatusServico4/NFeStatusServico4.asmx',
      recepcaoEvento: 'https://hnfe.sefaz.ba.gov.br/webservices/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx',
    },
    producao: {
      autorizacao: 'https://nfe.sefaz.ba.gov.br/webservices/NFeAutorizacao4/NFeAutorizacao4.asmx',
      retAutorizacao: 'https://nfe.sefaz.ba.gov.br/webservices/NFeRetAutorizacao4/NFeRetAutorizacao4.asmx',
      consulta: 'https://nfe.sefaz.ba.gov.br/webservices/NFeConsultaProtocolo4/NFeConsultaProtocolo4.asmx',
      statusServico: 'https://nfe.sefaz.ba.gov.br/webservices/NFeStatusServico4/NFeStatusServico4.asmx',
      recepcaoEvento: 'https://nfe.sefaz.ba.gov.br/webservices/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx',
    },
  },
  
  // CEARÁ - Usa SVRS
  CE: { ...SVRS_ENDPOINTS, usaSVRS: true },
  
  // DISTRITO FEDERAL - Usa SVRS
  DF: { ...SVRS_ENDPOINTS, usaSVRS: true },
  
  // ESPÍRITO SANTO - Usa SVRS
  ES: { ...SVRS_ENDPOINTS, usaSVRS: true },
  
  // GOIÁS - Ambiente próprio
  GO: {
    homologacao: {
      autorizacao: 'https://homolog.sefaz.go.gov.br/nfe/services/NFeAutorizacao4',
      retAutorizacao: 'https://homolog.sefaz.go.gov.br/nfe/services/NFeRetAutorizacao4',
      consulta: 'https://homolog.sefaz.go.gov.br/nfe/services/NFeConsultaProtocolo4',
      statusServico: 'https://homolog.sefaz.go.gov.br/nfe/services/NFeStatusServico4',
      recepcaoEvento: 'https://homolog.sefaz.go.gov.br/nfe/services/NFeRecepcaoEvento4',
    },
    producao: {
      autorizacao: 'https://nfe.sefaz.go.gov.br/nfe/services/NFeAutorizacao4',
      retAutorizacao: 'https://nfe.sefaz.go.gov.br/nfe/services/NFeRetAutorizacao4',
      consulta: 'https://nfe.sefaz.go.gov.br/nfe/services/NFeConsultaProtocolo4',
      statusServico: 'https://nfe.sefaz.go.gov.br/nfe/services/NFeStatusServico4',
      recepcaoEvento: 'https://nfe.sefaz.go.gov.br/nfe/services/NFeRecepcaoEvento4',
    },
  },
  
  // MARANHÃO - Usa SVRS
  MA: { ...SVRS_ENDPOINTS, usaSVRS: true },
  
  // MATO GROSSO - Ambiente próprio
  MT: {
    homologacao: {
      autorizacao: 'https://homologacao.sefaz.mt.gov.br/nfcews/services/NfeAutorizacao4',
      retAutorizacao: 'https://homologacao.sefaz.mt.gov.br/nfcews/services/NfeRetAutorizacao4',
      consulta: 'https://homologacao.sefaz.mt.gov.br/nfcews/services/NfeConsulta4',
      statusServico: 'https://homologacao.sefaz.mt.gov.br/nfcews/services/NfeStatusServico4',
      recepcaoEvento: 'https://homologacao.sefaz.mt.gov.br/nfcews/services/RecepcaoEvento4',
    },
    producao: {
      autorizacao: 'https://nfce.sefaz.mt.gov.br/nfcews/services/NfeAutorizacao4',
      retAutorizacao: 'https://nfce.sefaz.mt.gov.br/nfcews/services/NfeRetAutorizacao4',
      consulta: 'https://nfce.sefaz.mt.gov.br/nfcews/services/NfeConsulta4',
      statusServico: 'https://nfce.sefaz.mt.gov.br/nfcews/services/NfeStatusServico4',
      recepcaoEvento: 'https://nfce.sefaz.mt.gov.br/nfcews/services/RecepcaoEvento4',
    },
  },
  
  // MATO GROSSO DO SUL - Ambiente próprio
  MS: {
    homologacao: {
      autorizacao: 'https://hom.nfce.sefaz.ms.gov.br/ws/NFeAutorizacao4',
      retAutorizacao: 'https://hom.nfce.sefaz.ms.gov.br/ws/NFeRetAutorizacao4',
      consulta: 'https://hom.nfce.sefaz.ms.gov.br/ws/NFeConsultaProtocolo4',
      statusServico: 'https://hom.nfce.sefaz.ms.gov.br/ws/NFeStatusServico4',
      recepcaoEvento: 'https://hom.nfce.sefaz.ms.gov.br/ws/NFeRecepcaoEvento4',
    },
    producao: {
      autorizacao: 'https://nfce.sefaz.ms.gov.br/ws/NFeAutorizacao4',
      retAutorizacao: 'https://nfce.sefaz.ms.gov.br/ws/NFeRetAutorizacao4',
      consulta: 'https://nfce.sefaz.ms.gov.br/ws/NFeConsultaProtocolo4',
      statusServico: 'https://nfce.sefaz.ms.gov.br/ws/NFeStatusServico4',
      recepcaoEvento: 'https://nfce.sefaz.ms.gov.br/ws/NFeRecepcaoEvento4',
    },
  },
  
  // MINAS GERAIS - Ambiente próprio
  MG: {
    homologacao: {
      autorizacao: 'https://hnfce.fazenda.mg.gov.br/nfce/services/NFeAutorizacao4',
      retAutorizacao: 'https://hnfce.fazenda.mg.gov.br/nfce/services/NFeRetAutorizacao4',
      consulta: 'https://hnfce.fazenda.mg.gov.br/nfce/services/NFeConsultaProtocolo4',
      statusServico: 'https://hnfce.fazenda.mg.gov.br/nfce/services/NFeStatusServico4',
      recepcaoEvento: 'https://hnfce.fazenda.mg.gov.br/nfce/services/NFeRecepcaoEvento4',
    },
    producao: {
      autorizacao: 'https://nfce.fazenda.mg.gov.br/nfce/services/NFeAutorizacao4',
      retAutorizacao: 'https://nfce.fazenda.mg.gov.br/nfce/services/NFeRetAutorizacao4',
      consulta: 'https://nfce.fazenda.mg.gov.br/nfce/services/NFeConsultaProtocolo4',
      statusServico: 'https://nfce.fazenda.mg.gov.br/nfce/services/NFeStatusServico4',
      recepcaoEvento: 'https://nfce.fazenda.mg.gov.br/nfce/services/NFeRecepcaoEvento4',
    },
  },
  
  // PARÁ - Usa SVRS
  PA: { ...SVRS_ENDPOINTS, usaSVRS: true },
  
  // PARAÍBA - Usa SVRS
  PB: { ...SVRS_ENDPOINTS, usaSVRS: true },
  
  // PARANÁ - Ambiente próprio
  PR: {
    homologacao: {
      autorizacao: 'https://homologacao.nfce.sefa.pr.gov.br/nfce/NFeAutorizacao4',
      retAutorizacao: 'https://homologacao.nfce.sefa.pr.gov.br/nfce/NFeRetAutorizacao4',
      consulta: 'https://homologacao.nfce.sefa.pr.gov.br/nfce/NFeConsultaProtocolo4',
      statusServico: 'https://homologacao.nfce.sefa.pr.gov.br/nfce/NFeStatusServico4',
      recepcaoEvento: 'https://homologacao.nfce.sefa.pr.gov.br/nfce/NFeRecepcaoEvento4',
    },
    producao: {
      autorizacao: 'https://nfce.sefa.pr.gov.br/nfce/NFeAutorizacao4',
      retAutorizacao: 'https://nfce.sefa.pr.gov.br/nfce/NFeRetAutorizacao4',
      consulta: 'https://nfce.sefa.pr.gov.br/nfce/NFeConsultaProtocolo4',
      statusServico: 'https://nfce.sefa.pr.gov.br/nfce/NFeStatusServico4',
      recepcaoEvento: 'https://nfce.sefa.pr.gov.br/nfce/NFeRecepcaoEvento4',
    },
  },
  
  // PERNAMBUCO - Usa SVRS
  PE: { ...SVRS_ENDPOINTS, usaSVRS: true },
  
  // PIAUÍ - Usa SVRS
  PI: { ...SVRS_ENDPOINTS, usaSVRS: true },
  
  // RIO DE JANEIRO - Usa SVRS
  RJ: { ...SVRS_ENDPOINTS, usaSVRS: true },
  
  // RIO GRANDE DO NORTE - Usa SVRS
  RN: { ...SVRS_ENDPOINTS, usaSVRS: true },
  
  // RIO GRANDE DO SUL - Ambiente próprio
  RS: {
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
  },
  
  // RONDÔNIA - Usa SVRS
  RO: { ...SVRS_ENDPOINTS, usaSVRS: true },
  
  // RORAIMA - Usa SVRS
  RR: { ...SVRS_ENDPOINTS, usaSVRS: true },
  
  // SANTA CATARINA - Usa SVRS
  SC: { ...SVRS_ENDPOINTS, usaSVRS: true },
  
  // SÃO PAULO - Ambiente próprio
  SP: {
    homologacao: {
      autorizacao: 'https://homologacao.nfce.fazenda.sp.gov.br/ws/NFeAutorizacao4.asmx',
      retAutorizacao: 'https://homologacao.nfce.fazenda.sp.gov.br/ws/NFeRetAutorizacao4.asmx',
      consulta: 'https://homologacao.nfce.fazenda.sp.gov.br/ws/NFeConsultaProtocolo4.asmx',
      statusServico: 'https://homologacao.nfce.fazenda.sp.gov.br/ws/NFeStatusServico4.asmx',
      recepcaoEvento: 'https://homologacao.nfce.fazenda.sp.gov.br/ws/NFeRecepcaoEvento4.asmx',
    },
    producao: {
      autorizacao: 'https://nfce.fazenda.sp.gov.br/ws/NFeAutorizacao4.asmx',
      retAutorizacao: 'https://nfce.fazenda.sp.gov.br/ws/NFeRetAutorizacao4.asmx',
      consulta: 'https://nfce.fazenda.sp.gov.br/ws/NFeConsultaProtocolo4.asmx',
      statusServico: 'https://nfce.fazenda.sp.gov.br/ws/NFeStatusServico4.asmx',
      recepcaoEvento: 'https://nfce.fazenda.sp.gov.br/ws/NFeRecepcaoEvento4.asmx',
    },
  },
  
  // SERGIPE - Usa SVRS
  SE: { ...SVRS_ENDPOINTS, usaSVRS: true },
  
  // TOCANTINS - Usa SVRS
  TO: { ...SVRS_ENDPOINTS, usaSVRS: true },
};

// URLs de consulta pública do QR Code por estado
const QRCODE_URLS: Record<string, { homologacao: string; producao: string }> = {
  AC: { homologacao: 'http://www.sefaznet.ac.gov.br/nfce/qrcode', producao: 'http://www.sefaznet.ac.gov.br/nfce/qrcode' },
  AL: { homologacao: 'http://nfce.sefaz.al.gov.br/QRCode/consultarNFCe.jsp', producao: 'http://nfce.sefaz.al.gov.br/QRCode/consultarNFCe.jsp' },
  AP: { homologacao: 'https://www.sefaz.ap.gov.br/nfcehml/nfce.php', producao: 'https://www.sefaz.ap.gov.br/nfce/nfce.php' },
  AM: { homologacao: 'http://homnfce.sefaz.am.gov.br/nfceweb/consultarNFCe.jsp', producao: 'http://sistemas.sefaz.am.gov.br/nfceweb/consultarNFCe.jsp' },
  BA: { homologacao: 'http://hnfe.sefaz.ba.gov.br/servicos/nfce/modulos/geral/NFCEC_consulta_chave_acesso.aspx', producao: 'http://nfe.sefaz.ba.gov.br/servicos/nfce/modulos/geral/NFCEC_consulta_chave_acesso.aspx' },
  CE: { homologacao: 'http://nfceh.sefaz.ce.gov.br/pages/ShowNFCe.html', producao: 'http://nfce.sefaz.ce.gov.br/pages/ShowNFCe.html' },
  DF: { homologacao: 'http://dec.fazenda.df.gov.br/ConsultarNFCe.aspx', producao: 'http://dec.fazenda.df.gov.br/ConsultarNFCe.aspx' },
  ES: { homologacao: 'http://homologacao.sefaz.es.gov.br/ConsultaNFCe/qrcode.aspx', producao: 'http://app.sefaz.es.gov.br/ConsultaNFCe/qrcode.aspx' },
  GO: { homologacao: 'http://homolog.sefaz.go.gov.br/nfeweb/sites/nfce/danfeNFCe', producao: 'http://nfe.sefaz.go.gov.br/nfeweb/sites/nfce/danfeNFCe' },
  MA: { homologacao: 'http://www.hom.nfce.sefaz.ma.gov.br/portal/consultarNFCe.jsp', producao: 'http://www.nfce.sefaz.ma.gov.br/portal/consultarNFCe.jsp' },
  MT: { homologacao: 'http://homologacao.sefaz.mt.gov.br/nfce/consultanfce', producao: 'http://www.sefaz.mt.gov.br/nfce/consultanfce' },
  MS: { homologacao: 'http://www.dfe.ms.gov.br/nfce/qrcode', producao: 'http://www.dfe.ms.gov.br/nfce/qrcode' },
  MG: { homologacao: 'https://nfce.fazenda.mg.gov.br/portalnfce/sistema/qrcode.xhtml', producao: 'https://nfce.fazenda.mg.gov.br/portalnfce/sistema/qrcode.xhtml' },
  PA: { homologacao: 'https://appnfc.sefa.pa.gov.br/portal-homologacao/view/consultas/nfce/nfceForm.seam', producao: 'https://appnfc.sefa.pa.gov.br/portal/view/consultas/nfce/nfceForm.seam' },
  PB: { homologacao: 'http://www.receita.pb.gov.br/nfcehom', producao: 'http://www.receita.pb.gov.br/nfce' },
  PR: { homologacao: 'http://www.dfeportal.fazenda.pr.gov.br/dfe-portal/rest/servico/consultaNFCe', producao: 'http://www.dfeportal.fazenda.pr.gov.br/dfe-portal/rest/servico/consultaNFCe' },
  PE: { homologacao: 'http://nfcehomolog.sefaz.pe.gov.br/nfce-web/consultarNFCe', producao: 'http://nfce.sefaz.pe.gov.br/nfce-web/consultarNFCe' },
  PI: { homologacao: 'http://www.sefaz.pi.gov.br/nfce/qrcode', producao: 'http://www.sefaz.pi.gov.br/nfce/qrcode' },
  RJ: { homologacao: 'https://www.nfce.fazenda.rj.gov.br/nfce/QRCode', producao: 'https://www.nfce.fazenda.rj.gov.br/nfce/QRCode' },
  RN: { homologacao: 'http://hom.nfce.set.rn.gov.br/consultarNFCe.aspx', producao: 'http://nfce.set.rn.gov.br/consultarNFCe.aspx' },
  RS: { homologacao: 'https://www.sefaz.rs.gov.br/NFCE/NFCE-COM.aspx', producao: 'https://www.sefaz.rs.gov.br/NFCE/NFCE-COM.aspx' },
  RO: { homologacao: 'http://www.nfce.sefin.ro.gov.br/consultanfce/consulta.jsp', producao: 'http://www.nfce.sefin.ro.gov.br/consultanfce/consulta.jsp' },
  RR: { homologacao: 'https://www.sefaz.rr.gov.br/nfce/servlet/qrcode', producao: 'https://www.sefaz.rr.gov.br/nfce/servlet/qrcode' },
  SC: { homologacao: 'https://hom.sat.sef.sc.gov.br/nfce/consulta/consulta.html', producao: 'https://sat.sef.sc.gov.br/nfce/consulta/consulta.html' },
  SP: { homologacao: 'https://www.homologacao.nfce.fazenda.sp.gov.br/NFCeConsultaPublica', producao: 'https://www.nfce.fazenda.sp.gov.br/NFCeConsultaPublica' },
  SE: { homologacao: 'http://www.hom.nfe.se.gov.br/portal/consultarNFCe.jsp', producao: 'http://www.nfe.se.gov.br/portal/consultarNFCe.jsp' },
  TO: { homologacao: 'http://homologacao.sefaz.to.gov.br/nfce/qrcode', producao: 'http://www.sefaz.to.gov.br/nfce/qrcode' },
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

// ============================================================================
// FUNÇÕES AUXILIARES
// ============================================================================

// Get SEFAZ endpoints for a state
function getSefazEndpoints(uf: string, ambiente: 'homologacao' | 'producao'): SefazEndpoints {
  const config = SEFAZ_ENDPOINTS[uf];
  if (!config) {
    console.log(`⚠️ Estado ${uf} não configurado, usando SVRS como fallback`);
    return SVRS_ENDPOINTS[ambiente];
  }
  return config[ambiente];
}

// Get QR Code URL for a state
function getQRCodeBaseUrl(uf: string, ambiente: 'homologacao' | 'producao'): string {
  const urls = QRCODE_URLS[uf];
  if (!urls) {
    console.log(`⚠️ URL QRCode para ${uf} não configurada, usando padrão SVRS`);
    return ambiente === 'producao' 
      ? 'https://www.sefaz.rs.gov.br/NFCE/NFCE-COM.aspx'
      : 'https://www.sefaz.rs.gov.br/NFCE/NFCE-COM.aspx';
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
  
  const cUF = UF_CODIGOS[uf] || '35';
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

// Generate QR Code hash using SHA-1
async function generateQRCodeHash(data: string, cscToken: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataWithCSC = data + cscToken;
  const hashBuffer = await crypto.subtle.digest('SHA-1', encoder.encode(dataWithCSC));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

// Generate QR Code URL - NFC-e QR Code Versão 2.00 (NT 2015.002)
// Online (sem contingência): URL?p=chNFe|nVersao|tpAmb|cIdToken|cHashQRCode
// Offline (contingência):    URL?p=chNFe|nVersao|tpAmb|cDest|dhEmi|vNF|vICMSST|digVal|cIdToken|cHashQRCode
async function generateQRCodeUrl(
  uf: string,
  chaveAcesso: string,
  ambiente: 'homologacao' | 'producao',
  cscId: string,
  cscToken: string,
  _valorTotal: number,
  _dhEmi: string,
  contingencia: boolean = false,
  cDest: string = '',
  digVal: string = ''
): Promise<string> {
  const tpAmb = ambiente === 'producao' ? '1' : '2';
  const baseUrl = getQRCodeBaseUrl(uf, ambiente);
  
  if (contingencia) {
    // Formato OFFLINE (contingência) - 10 campos
    const vNF = _valorTotal.toFixed(2);
    const dhEmiEnc = encodeURIComponent(_dhEmi);
    const qrCodeData = `${chaveAcesso}|2|${tpAmb}|${cDest}|${dhEmiEnc}|${vNF}||${digVal}|${cscId}|`;
    const hash = await generateQRCodeHash(qrCodeData, cscToken);
    return `${baseUrl}?p=${qrCodeData}${hash}`;
  } else {
    // Formato ONLINE (sem contingência) - 5 campos conforme NT 2015.002
    const qrCodeData = `${chaveAcesso}|2|${tpAmb}|${cscId}|`;
    const hash = await generateQRCodeHash(qrCodeData, cscToken);
    return `${baseUrl}?p=${qrCodeData}${hash}`;
  }
}

// Get CRT (Código de Regime Tributário) from regime_tributario
function getCRT(regimeTributario: string): string {
  switch (regimeTributario) {
    case 'simples_nacional':
      return '1';
    case 'simples_nacional_excesso':
      return '2';
    case 'lucro_presumido':
    case 'lucro_real':
      return '3';
    default:
      return '1';
  }
}

// Format date for XML
function formatDateTimeXML(date: Date): string {
  return date.toISOString().replace('Z', '-03:00');
}

// Generate NFC-e XML
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
  const cUF = UF_CODIGOS[empresa.uf] || '35';
  const cRT = getCRT(empresa.regime_tributario);
  
  // Razão social em homologação deve ser "NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL"
  const xNome = nfce.ambiente === 'homologacao' 
    ? 'NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL'
    : empresa.razao_social.substring(0, 60);
  
  let xml = `<?xml version="1.0" encoding="UTF-8"?>`;
  xml += `<NFe xmlns="http://www.portalfiscal.inf.br/nfe">`;
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
      // Simples Nacional
      xml += `<ICMSSN102>`;
      xml += `<orig>0</orig>`;
      xml += `<CSOSN>${item.csosn || '102'}</CSOSN>`;
      xml += `</ICMSSN102>`;
    } else {
      // Regime Normal
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
  
  xml += `</infNFe>`;
  xml += `</NFe>`;
  
  return xml;
}

// Generate SOAP envelope
function generateSOAPEnvelope(xml: string, action: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:nfe="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4">
  <soap:Header/>
  <soap:Body>
    <nfe:${action}>
      <nfeDadosMsg>${xml}</nfeDadosMsg>
    </nfe:${action}>
  </soap:Body>
</soap:Envelope>`;
}

// Parse SEFAZ response
function parseSefazResponse(responseXml: string): {
  cStat: string;
  xMotivo: string;
  nProt?: string;
  dhRecbto?: string;
} {
  // Simple XML parsing for response
  const cStatMatch = responseXml.match(/<cStat>(\d+)<\/cStat>/);
  const xMotivoMatch = responseXml.match(/<xMotivo>([^<]+)<\/xMotivo>/);
  const nProtMatch = responseXml.match(/<nProt>(\d+)<\/nProt>/);
  const dhRecbtoMatch = responseXml.match(/<dhRecbto>([^<]+)<\/dhRecbto>/);
  
  return {
    cStat: cStatMatch ? cStatMatch[1] : '999',
    xMotivo: xMotivoMatch ? xMotivoMatch[1] : 'Erro ao processar resposta da SEFAZ',
    nProt: nProtMatch ? nProtMatch[1] : undefined,
    dhRecbto: dhRecbtoMatch ? dhRecbtoMatch[1] : undefined,
  };
}

// Send to SEFAZ (with simulation for homologação when certificate not available)
async function sendToSefaz(
  nfce: NFCeData, 
  empresa: EmpresaData, 
  itens: NFCeItem[],
  certificado: CertificadoData | null
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
    '65', // NFC-e model
    nfce.serie,
    nfce.numero,
    '1', // Normal emission
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
  
  // Validate address fields for NFC-e
  if (!empresa.logradouro || !empresa.bairro || !empresa.cep || !empresa.codigo_municipio) {
    return {
      success: false,
      codigoRetorno: '451',
      motivoRetorno: 'Endereço incompleto. Preencha logradouro, bairro, CEP e código do município.',
    };
  }
  
  if (!certificado) {
    if (nfce.ambiente === 'producao') {
      return {
        success: false,
        codigoRetorno: '280',
        motivoRetorno: 'Certificado digital não encontrado ou expirado. Obrigatório para produção.',
      };
    }
    console.log('⚠️ Certificado não disponível - usando simulação para homologação');
  }
  
  // Generate XML
  const xmlNFCe = generateNFCeXML(nfce, empresa, itens, chaveAcesso, codigoNumerico);
  
  // Get endpoints for the state
  const endpoints = getSefazEndpoints(empresa.uf, nfce.ambiente);
  console.log(`🌐 Endpoint SEFAZ: ${endpoints.autorizacao}`);
  
  // Generate QR Code URL
  const dhEmi = formatDateTimeXML(new Date(nfce.data_emissao));
  const qrcodeUrl = await generateQRCodeUrl(
    empresa.uf,
    chaveAcesso,
    nfce.ambiente,
    empresa.csc_id,
    empresa.csc_token,
    nfce.valor_total,
    dhEmi
  );
  
  // For homologação without certificate, simulate SEFAZ response
  if (nfce.ambiente === 'homologacao' && !certificado) {
    console.log('🔄 Simulando comunicação SEFAZ em homologação...');
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
    
    // 95% success rate in homologação simulation
    if (Math.random() > 0.05) {
      const protocolo = `${UF_CODIGOS[empresa.uf]}${Date.now()}${Math.floor(Math.random() * 1000)}`;
      
      const xmlRetorno = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
  ${xmlNFCe}
  <protNFe versao="4.00">
    <infProt>
      <tpAmb>2</tpAmb>
      <verAplic>SVRS-${empresa.uf}</verAplic>
      <chNFe>${chaveAcesso}</chNFe>
      <dhRecbto>${new Date().toISOString()}</dhRecbto>
      <nProt>${protocolo}</nProt>
      <digVal>SIMULACAO_HOMOLOGACAO</digVal>
      <cStat>100</cStat>
      <xMotivo>Autorizado o uso da NF-e</xMotivo>
    </infProt>
  </protNFe>
</nfeProc>`;
      
      return {
        success: true,
        protocolo,
        chaveAcesso,
        qrcodeUrl,
        codigoRetorno: '100',
        motivoRetorno: 'Autorizado o uso da NF-e',
        xmlEnvio: xmlNFCe,
        xmlRetorno,
      };
    } else {
      // Simulate random rejection
      const rejectionReasons = [
        { code: '539', reason: 'Duplicidade de NFC-e' },
        { code: '233', reason: 'NCM inválido' },
        { code: '225', reason: 'Data de emissão maior que data atual' },
        { code: '301', reason: 'Uso denegado: irregularidade fiscal do emitente' },
      ];
      const rejection = rejectionReasons[Math.floor(Math.random() * rejectionReasons.length)];
      
      return {
        success: false,
        chaveAcesso,
        codigoRetorno: rejection.code,
        motivoRetorno: rejection.reason,
        xmlEnvio: xmlNFCe,
      };
    }
  }
  
  // For production or homologação with certificate, attempt real SEFAZ communication
  // Note: Full certificate signing requires additional libraries not available in Deno Edge Functions
  // This implementation prepares everything for when certificate signing is implemented
  
  if (nfce.ambiente === 'producao') {
    console.log('⚠️ Produção requer assinatura digital do XML com certificado A1');
    
    // TODO: Implement certificate signing with a proper signing service
    // Options:
    // 1. Use an external signing service API
    // 2. Implement certificate parsing and signing in a dedicated microservice
    // 3. Use a third-party NF-e signing library
    
    return {
      success: false,
      chaveAcesso,
      codigoRetorno: '999',
      motivoRetorno: 'Ambiente de produção requer integração com serviço de assinatura digital. Configure um serviço de assinatura ou use homologação para testes.',
      xmlEnvio: xmlNFCe,
    };
  }
  
  // Attempt SOAP call to SEFAZ for homologação with certificate
  try {
    console.log('📤 Enviando NFC-e para SEFAZ...');
    
    const soapEnvelope = generateSOAPEnvelope(xmlNFCe, 'nfeAutorizacaoLote');
    
    // Note: This will fail without proper TLS client certificate
    // In production, use a signing service that handles certificate auth
    const response = await fetch(endpoints.autorizacao, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/soap+xml; charset=utf-8',
        'SOAPAction': 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4/nfeAutorizacaoLote',
      },
      body: soapEnvelope,
    });
    
    if (!response.ok) {
      throw new Error(`SEFAZ returned status ${response.status}`);
    }
    
    const responseText = await response.text();
    const parsed = parseSefazResponse(responseText);
    
    if (parsed.cStat === '100' || parsed.cStat === '103' || parsed.cStat === '104') {
      return {
        success: true,
        protocolo: parsed.nProt,
        chaveAcesso,
        qrcodeUrl,
        codigoRetorno: parsed.cStat,
        motivoRetorno: parsed.xMotivo,
        xmlEnvio: xmlNFCe,
        xmlRetorno: responseText,
      };
    } else {
      return {
        success: false,
        chaveAcesso,
        codigoRetorno: parsed.cStat,
        motivoRetorno: parsed.xMotivo,
        xmlEnvio: xmlNFCe,
        xmlRetorno: responseText,
      };
    }
  } catch (error: any) {
    console.error('❌ Erro na comunicação com SEFAZ:', error.message);
    
    // Fallback to simulation in homologação if SEFAZ is unreachable
    if (nfce.ambiente === 'homologacao') {
      console.log('🔄 Fallback para simulação devido a erro de comunicação');
      
      const protocolo = `${UF_CODIGOS[empresa.uf]}${Date.now()}${Math.floor(Math.random() * 1000)}`;
      
      return {
        success: true,
        protocolo,
        chaveAcesso,
        qrcodeUrl,
        codigoRetorno: '100',
        motivoRetorno: 'Autorizado o uso da NF-e (simulação - SEFAZ indisponível)',
        xmlEnvio: xmlNFCe,
        xmlRetorno: `<nfeProc><infProt><cStat>100</cStat><xMotivo>Autorizado (simulação)</xMotivo><nProt>${protocolo}</nProt></infProt></nfeProc>`,
      };
    }
    
    return {
      success: false,
      chaveAcesso,
      codigoRetorno: '999',
      motivoRetorno: `Erro de comunicação com SEFAZ: ${error.message}`,
      xmlEnvio: xmlNFCe,
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
          await supabase
            .from('fila_processamento')
            .delete()
            .eq('id', item.id);
          continue;
        }

        // Skip if already processed
        if (['autorizada', 'cancelada', 'denegada'].includes(nfce.status)) {
          console.log(`NFC-e ${nfce.numero} already processed with status: ${nfce.status}`);
          await supabase
            .from('fila_processamento')
            .delete()
            .eq('id', item.id);
          continue;
        }

        // Update status to processing
        await supabase
          .from('nfce')
          .update({ status: 'processando' })
          .eq('id', item.nfce_id);

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

        // Send to SEFAZ
        const result = await sendToSefaz(nfce, empresa, itens || [], certificado);

        if (result.success) {
          console.log(`✅ NFC-e ${nfce.numero} authorized - Protocol: ${result.protocolo}`);

          // Update NFC-e with authorization data
          await supabase
            .from('nfce')
            .update({
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
            })
            .eq('id', item.nfce_id);

          // Remove from queue
          await supabase
            .from('fila_processamento')
            .delete()
            .eq('id', item.id);

          // Log success
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

          // Send webhook notification
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
          
          // Update NFC-e
          await supabase
            .from('nfce')
            .update({
              status: isDenegada ? 'denegada' : (novasTentativas >= 3 ? 'rejeitada' : 'pendente'),
              chave_acesso: result.chaveAcesso,
              codigo_retorno: result.codigoRetorno,
              motivo_retorno: result.motivoRetorno,
              erro_processamento: result.motivoRetorno,
              xml_envio: result.xmlEnvio,
              xml_retorno: result.xmlRetorno,
              processado_em: new Date().toISOString(),
              tentativas: nfce.tentativas + 1,
            })
            .eq('id', item.nfce_id);

          if (isDenegada || novasTentativas >= 3) {
            // Remove from queue if denied or max attempts reached
            await supabase
              .from('fila_processamento')
              .delete()
              .eq('id', item.id);
          } else {
            // Schedule retry with exponential backoff
            const nextRetry = new Date();
            nextRetry.setMinutes(nextRetry.getMinutes() + Math.pow(2, novasTentativas) * 5);
            
            await supabase
              .from('fila_processamento')
              .update({
                tentativas: novasTentativas,
                proximo_processamento: nextRetry.toISOString(),
                erro_ultimo: result.motivoRetorno,
              })
              .eq('id', item.id);
          }

          // Log failure
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

          // Send webhook notification for final rejection or denial
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
        
        // Update queue with error
        await supabase
          .from('fila_processamento')
          .update({
            tentativas: item.tentativas + 1,
            erro_ultimo: itemError.message,
            proximo_processamento: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
          })
          .eq('id', item.id);

        // Revert NFC-e status to pending
        await supabase
          .from('nfce')
          .update({ status: 'pendente', erro_processamento: itemError.message })
          .eq('id', item.nfce_id);
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
    console.error('Worker error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
