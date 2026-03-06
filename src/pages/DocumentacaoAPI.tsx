import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { 
  Code, 
  Copy, 
  CheckCircle2, 
  Terminal,
  FileJson,
  Key,
  AlertCircle,
  ExternalLink,
  Webhook,
  ArrowRight,
  Shield,
  Zap,
  RefreshCw,
  Clock,
  Database,
  FileText,
  Receipt
} from "lucide-react";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const NFCE_API_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/nfce-api`;
const NFE_API_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/nfe-api`;

// ==================== NFC-e Code Examples ====================
const nfceCodeExamples = {
  emitir: `// Emitir NFC-e
const response = await fetch('${NFCE_API_URL}', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': 'SEU_TOKEN_API'
  },
  body: JSON.stringify({
    external_id: 'VENDA-12345',
    itens: [
      {
        codigo: 'PROD001',
        descricao: 'Camiseta Básica Algodão',
        ncm: '61091000',
        cfop: '5102',
        unidade: 'UN',
        quantidade: 2,
        valor_unitario: 49.90,
        csosn: '102',
        aliquota_icms: 0,
        cst_pis: '01',
        aliquota_pis: 1.65,
        cst_cofins: '01',
        aliquota_cofins: 7.60
      }
    ],
    valor_desconto: 10.00,
    valor_frete: 0
  })
});

const data = await response.json();
// { "success": true, "data": { "id": "...", "numero": "000000001", "status": "pendente" } }`,

  consultar: `// Consultar NFC-e por ID
const nfceId = '550e8400-e29b-41d4-a716-446655440000';
const response = await fetch(\`${NFCE_API_URL}/\${nfceId}\`, {
  headers: { 'x-api-key': 'SEU_TOKEN_API' }
});
const data = await response.json();`,

  listar: `// Listar NFC-e com filtros
const params = new URLSearchParams({
  status: 'autorizada',
  data_inicio: '2024-01-01',
  data_fim: '2024-01-31',
  limit: '50',
  offset: '0'
});

const response = await fetch(\`${NFCE_API_URL}?\${params}\`, {
  headers: { 'x-api-key': 'SEU_TOKEN_API' }
});`,

  cancelar: `// Cancelar NFC-e autorizada
const nfceId = '550e8400-e29b-41d4-a716-446655440000';
const response = await fetch(\`${NFCE_API_URL}/\${nfceId}/cancelar\`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': 'SEU_TOKEN_API'
  },
  body: JSON.stringify({
    justificativa: 'Erro na digitação do valor do produto - venda será refeita'
  })
});`,

  reprocessar: `// Reprocessar NFC-e rejeitada
const nfceId = '550e8400-e29b-41d4-a716-446655440000';
const response = await fetch(\`${NFCE_API_URL}/\${nfceId}/reprocessar\`, {
  method: 'POST',
  headers: { 'x-api-key': 'SEU_TOKEN_API' }
});`,

  xml: `// Obter XMLs da NFC-e
const nfceId = '550e8400-e29b-41d4-a716-446655440000';
const response = await fetch(\`${NFCE_API_URL}/\${nfceId}/xml\`, {
  headers: { 'x-api-key': 'SEU_TOKEN_API' }
});
// { "success": true, "data": { "xml_envio": "...", "xml_retorno": "..." } }`,
};

// ==================== NF-e Code Examples ====================
const nfeCodeExamples = {
  emitir: `// Emitir NF-e (modelo 55)
const response = await fetch('${NFE_API_URL}', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': 'SEU_TOKEN_API'
  },
  body: JSON.stringify({
    external_id: 'PEDIDO-98765',
    natureza_operacao: 'VENDA',
    finalidade: '1',            // 1=Normal, 2=Complementar, 3=Ajuste, 4=Devolução
    modalidade_frete: '0',      // 0=Emitente, 1=Destinatário, 9=Sem frete
    destinatario: {
      cpf_cnpj: '12345678000190',
      nome: 'Empresa Destinatária Ltda',
      ie: '1234567890',
      email: 'fiscal@empresa.com.br',
      logradouro: 'Rua das Flores',
      numero: '100',
      complemento: 'Sala 201',
      bairro: 'Centro',
      municipio: 'Porto Alegre',
      codigo_municipio: '4314902',
      uf: 'RS',
      cep: '90000000',
      telefone: '5133334444'
    },
    itens: [
      {
        codigo: 'PROD001',
        descricao: 'Notebook Dell Inspiron 15',
        ncm: '84713012',
        cfop: '5102',
        unidade: 'UN',
        quantidade: 2,
        valor_unitario: 3500.00,
        cst_icms: '00',          // ou csosn: '102' para Simples Nacional
        aliquota_icms: 17,
        cst_ipi: '50',
        aliquota_ipi: 5,
        cst_pis: '01',
        aliquota_pis: 1.65,
        cst_cofins: '01',
        aliquota_cofins: 7.60
      },
      {
        codigo: 'PROD002',
        descricao: 'Mouse Logitech MX Master',
        ncm: '84716053',
        cfop: '5102',
        unidade: 'UN',
        quantidade: 2,
        valor_unitario: 450.00,
        cst_icms: '00',
        aliquota_icms: 17,
        cst_ipi: '50',
        aliquota_ipi: 5,
        cst_pis: '01',
        aliquota_pis: 1.65,
        cst_cofins: '01',
        aliquota_cofins: 7.60
      }
    ],
    valor_desconto: 100.00,
    valor_frete: 50.00,
    valor_seguro: 0,
    valor_outras_despesas: 0
  })
});

const data = await response.json();
console.log(data);
// Resposta:
// {
//   "success": true,
//   "data": {
//     "id": "550e8400-e29b-41d4-a716-446655440000",
//     "numero": "000000001",
//     "serie": "001",
//     "status": "autorizada",  // ou "pendente" se assíncrono
//     "ambiente": "homologacao",
//     "chave_acesso": "43260112345678000190550010000000011234567890",
//     "protocolo": "143260000123456",
//     "valor_total": 7850.00,
//     "created_at": "2026-01-15T14:30:00.000Z"
//   }
// }`,

  consultar: `// Consultar NF-e por ID
const nfeId = '550e8400-e29b-41d4-a716-446655440000';
const response = await fetch(\`${NFE_API_URL}/\${nfeId}\`, {
  method: 'GET',
  headers: {
    'x-api-key': 'SEU_TOKEN_API'
  }
});

const data = await response.json();
// Resposta:
// {
//   "success": true,
//   "data": {
//     "id": "550e8400-e29b-41d4-a716-446655440000",
//     "numero": "000000001",
//     "serie": "001",
//     "chave_acesso": "43260112345678000190550010000000011234567890",
//     "status": "autorizada",
//     "natureza_operacao": "VENDA",
//     "dest_nome": "Empresa Destinatária Ltda",
//     "dest_cpf_cnpj": "12345678000190",
//     "valor_total": 7850.00,
//     "protocolo": "143260000123456",
//     "data_autorizacao": "2026-01-15T14:30:05.000Z"
//   }
// }`,

  listar: `// Listar NF-e com filtros e paginação
const params = new URLSearchParams({
  status: 'autorizada',
  data_inicio: '2026-01-01',
  data_fim: '2026-01-31',
  limit: '50',
  offset: '0'
});

const response = await fetch(\`${NFE_API_URL}?\${params}\`, {
  method: 'GET',
  headers: {
    'x-api-key': 'SEU_TOKEN_API'
  }
});

const data = await response.json();
// Resposta:
// {
//   "success": true,
//   "data": [
//     {
//       "id": "...",
//       "numero": "000000001",
//       "serie": "001",
//       "chave_acesso": "43260112345678...",
//       "status": "autorizada",
//       "dest_nome": "Empresa Destinatária Ltda",
//       "natureza_operacao": "VENDA",
//       "valor_total": 7850.00,
//       "external_id": "PEDIDO-98765"
//     }
//   ],
//   "pagination": { "total": 150, "limit": 50, "offset": 0 }
// }`,

  cancelar: `// Cancelar NF-e autorizada
const nfeId = '550e8400-e29b-41d4-a716-446655440000';
const response = await fetch(\`${NFE_API_URL}/\${nfeId}/cancelar\`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': 'SEU_TOKEN_API'
  },
  body: JSON.stringify({
    justificativa: 'Erro na digitação dos dados do destinatário - nota será reemitida'
    // Mínimo 15 caracteres
  })
});

const data = await response.json();
// { "success": true, "data": { "id": "...", "evento_id": "...", "status": "cancelada" } }`,

  reprocessar: `// Reprocessar NF-e rejeitada ou pendente
const nfeId = '550e8400-e29b-41d4-a716-446655440000';
const response = await fetch(\`${NFE_API_URL}/\${nfeId}/reprocessar\`, {
  method: 'POST',
  headers: {
    'x-api-key': 'SEU_TOKEN_API'
  }
});

const data = await response.json();
// { "success": true, "data": { "id": "...", "status": "pendente" } }`,

  xml: `// Obter XMLs da NF-e (envio e retorno)
const nfeId = '550e8400-e29b-41d4-a716-446655440000';
const response = await fetch(\`${NFE_API_URL}/\${nfeId}/xml\`, {
  method: 'GET',
  headers: {
    'x-api-key': 'SEU_TOKEN_API'
  }
});

const data = await response.json();
// {
//   "success": true,
//   "data": {
//     "xml_envio": "<?xml version=\\"1.0\\"?><NFe>...</NFe>",
//     "xml_retorno": "<?xml version=\\"1.0\\"?><nfeProc>...</nfeProc>"
//   }
// }`,
};

const nfeIntegracaoCompleta = `// ========================================
// INTEGRAÇÃO COMPLETA NF-e - EXEMPLO ERP
// ========================================

class NFeClient {
  constructor(apiKey, baseUrl) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  async request(endpoint, options = {}) {
    const response = await fetch(\`\${this.baseUrl}\${endpoint}\`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        ...options.headers
      }
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'API Error');
    return data;
  }

  // Emitir NF-e
  async emitir(pedido) {
    return this.request('', {
      method: 'POST',
      body: JSON.stringify({
        external_id: pedido.id,
        natureza_operacao: pedido.natureza || 'VENDA',
        finalidade: pedido.finalidade || '1',
        modalidade_frete: pedido.frete_tipo || '9',
        destinatario: {
          cpf_cnpj: pedido.cliente.documento,
          nome: pedido.cliente.nome,
          ie: pedido.cliente.ie,
          email: pedido.cliente.email,
          logradouro: pedido.cliente.endereco.rua,
          numero: pedido.cliente.endereco.numero,
          bairro: pedido.cliente.endereco.bairro,
          municipio: pedido.cliente.endereco.cidade,
          codigo_municipio: pedido.cliente.endereco.ibge,
          uf: pedido.cliente.endereco.uf,
          cep: pedido.cliente.endereco.cep
        },
        itens: pedido.itens.map(item => ({
          codigo: item.sku,
          descricao: item.nome,
          ncm: item.ncm,
          cfop: item.cfop,
          unidade: item.unidade,
          quantidade: item.qtd,
          valor_unitario: item.preco,
          cst_icms: item.cstIcms,
          aliquota_icms: item.aliqIcms,
          cst_ipi: item.cstIpi,
          aliquota_ipi: item.aliqIpi,
          cst_pis: item.cstPis,
          aliquota_pis: item.aliqPis,
          cst_cofins: item.cstCofins,
          aliquota_cofins: item.aliqCofins
        })),
        valor_desconto: pedido.desconto,
        valor_frete: pedido.frete
      })
    });
  }

  async consultar(nfeId) { return this.request(\`/\${nfeId}\`); }
  async listar(filtros = {}) { return this.request(\`?\${new URLSearchParams(filtros)}\`); }
  async cancelar(nfeId, justificativa) {
    return this.request(\`/\${nfeId}/cancelar\`, {
      method: 'POST', body: JSON.stringify({ justificativa })
    });
  }
  async reprocessar(nfeId) { return this.request(\`/\${nfeId}/reprocessar\`, { method: 'POST' }); }
  async obterXml(nfeId) { return this.request(\`/\${nfeId}/xml\`); }
}

// Uso:
const client = new NFeClient('SEU_TOKEN', '${NFE_API_URL}');
const resultado = await client.emitir(pedido);
console.log('NF-e criada:', resultado.data.id);`;

const webhookValidation = `// Validar assinatura do webhook (Node.js/Express)
const crypto = require('crypto');

function validateWebhookSignature(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
  return signature === \`sha256=\${expectedSignature}\`;
}

app.post('/webhooks/fiscal', (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  if (!validateWebhookSignature(req.body, signature, 'SEU_SECRET')) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  const { evento, dados } = req.body;
  
  switch (evento) {
    case 'nfce.autorizada':
    case 'nfe.autorizada':
      console.log(\`Nota \${dados.numero} autorizada! Chave: \${dados.chave_acesso}\`);
      break;
    case 'nfce.rejeitada':
    case 'nfe.rejeitada':
      console.log(\`Nota \${dados.numero} rejeitada: \${dados.motivo_retorno}\`);
      break;
    case 'nfce.cancelada':
    case 'nfe.cancelada':
      console.log(\`Nota \${dados.numero} cancelada\`);
      break;
  }
  
  res.status(200).json({ received: true });
});`;

export default function DocumentacaoAPI() {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [docType, setDocType] = useState<string>("nfce");

  const copyToClipboard = (text: string, section: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(section);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const CopyButton = ({ text, section }: { text: string; section: string }) => (
    <Button 
      variant="ghost" 
      size="icon"
      className="absolute top-2 right-2"
      onClick={() => copyToClipboard(text, section)}
    >
      {copiedSection === section ? (
        <CheckCircle2 className="h-4 w-4 text-success" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
    </Button>
  );

  const currentExamples = docType === "nfe" ? nfeCodeExamples : nfceCodeExamples;
  const currentApiUrl = docType === "nfe" ? NFE_API_URL : NFCE_API_URL;
  const currentLabel = docType === "nfe" ? "NF-e" : "NFC-e";
  const currentApiPath = docType === "nfe" ? "nfe-api" : "nfce-api";

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Documentação da API</h1>
          <p className="text-sm text-muted-foreground">Guia completo de integração NFC-e e NF-e para desenvolvedores</p>
        </div>
        <Link to="/auth" className="text-sm text-primary hover:underline">Acessar painel →</Link>
      </div>
      <main className="p-6">
        <div className="space-y-8 animate-fade-in max-w-5xl mx-auto">
        
        {/* Hero Section */}
        <div className="card-elevated p-6 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <div className="flex items-start gap-4">
            <div className="h-14 w-14 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
              <Code className="h-7 w-7 text-primary" />
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-foreground mb-2">API REST de Emissão Fiscal</h2>
              <p className="text-muted-foreground mb-4">
                Integre seu ERP com nossa plataforma de emissão de <strong>NFC-e</strong> (modelo 65) e <strong>NF-e</strong> (modelo 55). 
                Envie apenas os dados comerciais — toda a lógica fiscal, assinatura digital e comunicação com a SEFAZ 
                é processada automaticamente.
              </p>
              <div className="flex flex-wrap gap-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Zap className="h-4 w-4 text-primary" />
                  <span>Processamento automático</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Webhook className="h-4 w-4 text-primary" />
                  <span>Webhooks em tempo real</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Shield className="h-4 w-4 text-primary" />
                  <span>API segura com tokens</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileText className="h-4 w-4 text-primary" />
                  <span>NFC-e + NF-e</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Document type selector */}
        <div className="card-elevated p-4">
          <Tabs value={docType} onValueChange={setDocType}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="nfce" className="flex items-center gap-2">
                <Receipt className="h-4 w-4" />
                NFC-e (Modelo 65) — Consumidor
              </TabsTrigger>
              <TabsTrigger value="nfe" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                NF-e (Modelo 55) — Empresarial
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Quick Start Guide */}
        <div className="card-elevated p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Início Rápido — {currentLabel}
          </h3>
          <div className="grid md:grid-cols-4 gap-4">
            <div className="flex flex-col items-center text-center p-4 bg-muted/50 rounded-lg">
              <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center mb-2 text-primary font-bold">1</div>
              <h4 className="font-medium text-sm">Cadastre sua Empresa</h4>
              <p className="text-xs text-muted-foreground mt-1">Configure CNPJ, certificado digital{docType === "nfce" ? " e CSC" : ""}</p>
            </div>
            <div className="flex flex-col items-center text-center p-4 bg-muted/50 rounded-lg">
              <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center mb-2 text-primary font-bold">2</div>
              <h4 className="font-medium text-sm">Gere um Token</h4>
              <p className="text-xs text-muted-foreground mt-1">Crie um token com as permissões necessárias</p>
            </div>
            <div className="flex flex-col items-center text-center p-4 bg-muted/50 rounded-lg">
              <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center mb-2 text-primary font-bold">3</div>
              <h4 className="font-medium text-sm">Configure Webhooks</h4>
              <p className="text-xs text-muted-foreground mt-1">Receba notificações em tempo real</p>
            </div>
            <div className="flex flex-col items-center text-center p-4 bg-muted/50 rounded-lg">
              <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center mb-2 text-primary font-bold">4</div>
              <h4 className="font-medium text-sm">Integre sua API</h4>
              <p className="text-xs text-muted-foreground mt-1">Envie {docType === "nfe" ? "pedidos" : "vendas"} e receba {currentLabel} autorizadas</p>
            </div>
          </div>
        </div>

        {/* Base URL */}
        <div className="card-elevated p-6">
          <h3 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
            <Terminal className="h-5 w-5 text-primary" />
            URL Base — {currentLabel}
          </h3>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-muted px-4 py-3 rounded-lg text-sm font-mono text-foreground overflow-x-auto">
              {currentApiUrl}
            </code>
            <Button 
              variant="outline" 
              size="icon"
              onClick={() => copyToClipboard(currentApiUrl, 'base-url')}
            >
              {copiedSection === 'base-url' ? (
                <CheckCircle2 className="h-4 w-4 text-success" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Authentication */}
        <div className="card-elevated p-6">
          <h3 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
            <Key className="h-5 w-5 text-primary" />
            Autenticação
          </h3>
          <p className="text-muted-foreground mb-4">
            Todas as requisições devem incluir um token de API válido. O mesmo token funciona para NFC-e e NF-e:
          </p>
          <div className="space-y-3">
            <div className="bg-muted p-3 rounded-lg">
              <code className="text-sm font-mono">
                <span className="text-muted-foreground">Header:</span> x-api-key: seu_token_aqui
              </code>
            </div>
            <div className="bg-muted p-3 rounded-lg">
              <code className="text-sm font-mono">
                <span className="text-muted-foreground">Header:</span> Authorization: Bearer seu_token_aqui
              </code>
            </div>
          </div>
          
          <div className="mt-6">
            <h4 className="text-sm font-semibold text-foreground mb-3">Permissões do Token</h4>
            <div className="grid md:grid-cols-2 gap-3">
              <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
                <span className="status-badge status-autorizada text-xs">emitir</span>
                <p className="text-xs text-muted-foreground">Permite criar novas {currentLabel}</p>
              </div>
              <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
                <span className="status-badge status-processando text-xs">consultar</span>
                <p className="text-xs text-muted-foreground">Permite consultar status e listar {currentLabel}</p>
              </div>
              <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
                <span className="status-badge status-rejeitada text-xs">cancelar</span>
                <p className="text-xs text-muted-foreground">Permite cancelar {currentLabel} autorizadas</p>
              </div>
              <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
                <span className="status-badge status-cancelada text-xs">reprocessar</span>
                <p className="text-xs text-muted-foreground">Permite reprocessar {currentLabel} rejeitadas</p>
              </div>
            </div>
          </div>

          <div className="mt-4 p-4 bg-warning/10 border border-warning/20 rounded-lg flex gap-3">
            <AlertCircle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">Importante</p>
              <p className="text-sm text-muted-foreground">
                Mantenha seu token em segurança. Nunca exponha em código front-end ou repositórios públicos.
              </p>
            </div>
          </div>
        </div>

        {/* Endpoints */}
        <div className="card-elevated p-6">
          <h3 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
            <FileJson className="h-5 w-5 text-primary" />
            Endpoints — {currentLabel}
          </h3>
          
          <Tabs defaultValue="emitir" className="space-y-4">
            <TabsList className="flex flex-wrap gap-2 h-auto p-1 bg-muted/50">
              <TabsTrigger value="emitir" className="text-xs sm:text-sm">POST /{currentApiPath}</TabsTrigger>
              <TabsTrigger value="consultar" className="text-xs sm:text-sm">GET /:id</TabsTrigger>
              <TabsTrigger value="listar" className="text-xs sm:text-sm">GET /</TabsTrigger>
              <TabsTrigger value="cancelar" className="text-xs sm:text-sm">POST /:id/cancelar</TabsTrigger>
              <TabsTrigger value="reprocessar" className="text-xs sm:text-sm">POST /:id/reprocessar</TabsTrigger>
              <TabsTrigger value="xml" className="text-xs sm:text-sm">GET /:id/xml</TabsTrigger>
            </TabsList>

            <TabsContent value="emitir" className="space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h4 className="font-medium text-foreground">Emitir {currentLabel}</h4>
                  <span className="status-badge status-autorizada text-xs">emitir</span>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Cria uma nova {currentLabel} e processa automaticamente. A plataforma calculará os impostos, 
                  gerará o XML, assinará digitalmente e enviará à SEFAZ.
                  {docType === "nfe" && " Para NF-e, é obrigatório informar os dados do destinatário."}
                </p>
                
                {docType === "nfe" && (
                  <Accordion type="single" collapsible className="mb-4">
                    <AccordionItem value="destinatario">
                      <AccordionTrigger className="text-sm">Campos do Destinatário</AccordionTrigger>
                      <AccordionContent>
                        <div className="grid gap-2 text-sm">
                          <div className="grid grid-cols-3 gap-2 p-2 bg-muted/50 rounded font-medium">
                            <span>Campo</span><span>Tipo</span><span>Descrição</span>
                          </div>
                          {[
                            ["cpf_cnpj", "string*", "CPF ou CNPJ do destinatário"],
                            ["nome", "string*", "Razão social ou nome"],
                            ["ie", "string", "Inscrição estadual"],
                            ["email", "string", "E-mail para envio do XML"],
                            ["logradouro", "string*", "Logradouro"],
                            ["numero", "string*", "Número"],
                            ["bairro", "string*", "Bairro"],
                            ["municipio", "string*", "Nome do município"],
                            ["codigo_municipio", "string*", "Código IBGE (7 dígitos)"],
                            ["uf", "string*", "UF (2 letras)"],
                            ["cep", "string*", "CEP (8 dígitos)"],
                          ].map(([campo, tipo, desc]) => (
                            <div key={campo} className="grid grid-cols-3 gap-2 p-2 border-b">
                              <code className="text-xs">{campo}</code>
                              <span className="text-xs text-muted-foreground">{tipo}</span>
                              <span className="text-xs text-muted-foreground">{desc}</span>
                            </div>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                )}

                <Accordion type="single" collapsible className="mb-4">
                  <AccordionItem value="campos">
                    <AccordionTrigger className="text-sm">Campos do Item</AccordionTrigger>
                    <AccordionContent>
                      <div className="grid gap-2 text-sm">
                        <div className="grid grid-cols-3 gap-2 p-2 bg-muted/50 rounded font-medium">
                          <span>Campo</span><span>Tipo</span><span>Descrição</span>
                        </div>
                        {[
                          ["codigo", "string*", "Código do produto no ERP"],
                          ["descricao", "string*", "Descrição do produto"],
                          ["ncm", "string", "Código NCM (8 dígitos)"],
                          ["cfop", "string*", "CFOP (ex: 5102)"],
                          ["unidade", "string*", "UN, KG, LT, etc."],
                          ["quantidade", "number*", "Quantidade vendida"],
                          ["valor_unitario", "number*", "Valor unitário"],
                          ...(docType === "nfe" ? [
                            ["cst_icms", "string", "CST ICMS (Regime Normal)"],
                            ["cst_ipi", "string", "CST IPI"],
                            ["aliquota_ipi", "number", "Alíquota IPI (%)"],
                          ] : [
                            ["csosn", "string", "CSOSN (Simples Nacional)"],
                            ["cst_icms", "string", "CST ICMS (Regime Normal)"],
                          ]),
                          ["aliquota_icms", "number", "Alíquota ICMS (%)"],
                          ["cst_pis", "string", "CST PIS"],
                          ["aliquota_pis", "number", "Alíquota PIS (%)"],
                          ["cst_cofins", "string", "CST COFINS"],
                          ["aliquota_cofins", "number", "Alíquota COFINS (%)"],
                        ].map(([campo, tipo, desc]) => (
                          <div key={campo as string} className="grid grid-cols-3 gap-2 p-2 border-b">
                            <code className="text-xs">{campo}</code>
                            <span className="text-xs text-muted-foreground">{tipo}</span>
                            <span className="text-xs text-muted-foreground">{desc}</span>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
              <div className="relative">
                <pre className="bg-sidebar text-sidebar-foreground p-4 rounded-lg overflow-x-auto text-sm max-h-[500px]">
                  <code>{currentExamples.emitir}</code>
                </pre>
                <CopyButton text={currentExamples.emitir} section={`${docType}-emitir`} />
              </div>
            </TabsContent>

            <TabsContent value="consultar" className="space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h4 className="font-medium text-foreground">Consultar {currentLabel}</h4>
                  <span className="status-badge status-processando text-xs">consultar</span>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Retorna os dados completos de uma {currentLabel}, incluindo status, protocolo e chave de acesso.
                  {docType === "nfe" && " Inclui também dados do destinatário e natureza da operação."}
                </p>
              </div>
              <div className="relative">
                <pre className="bg-sidebar text-sidebar-foreground p-4 rounded-lg overflow-x-auto text-sm max-h-[500px]">
                  <code>{currentExamples.consultar}</code>
                </pre>
                <CopyButton text={currentExamples.consultar} section={`${docType}-consultar`} />
              </div>
            </TabsContent>

            <TabsContent value="listar" className="space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h4 className="font-medium text-foreground">Listar {currentLabel}</h4>
                  <span className="status-badge status-processando text-xs">consultar</span>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Lista todas as {currentLabel} com filtros por status, período e paginação. Máximo 100 registros por página.
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
                  <div className="p-2 bg-muted/50 rounded text-xs">
                    <span className="font-medium">status</span>
                    <p className="text-muted-foreground">pendente, autorizada, etc.</p>
                  </div>
                  <div className="p-2 bg-muted/50 rounded text-xs">
                    <span className="font-medium">data_inicio</span>
                    <p className="text-muted-foreground">YYYY-MM-DD</p>
                  </div>
                  <div className="p-2 bg-muted/50 rounded text-xs">
                    <span className="font-medium">data_fim</span>
                    <p className="text-muted-foreground">YYYY-MM-DD</p>
                  </div>
                  <div className="p-2 bg-muted/50 rounded text-xs">
                    <span className="font-medium">limit/offset</span>
                    <p className="text-muted-foreground">Paginação</p>
                  </div>
                </div>
              </div>
              <div className="relative">
                <pre className="bg-sidebar text-sidebar-foreground p-4 rounded-lg overflow-x-auto text-sm max-h-[500px]">
                  <code>{currentExamples.listar}</code>
                </pre>
                <CopyButton text={currentExamples.listar} section={`${docType}-listar`} />
              </div>
            </TabsContent>

            <TabsContent value="cancelar" className="space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h4 className="font-medium text-foreground">Cancelar {currentLabel}</h4>
                  <span className="status-badge status-rejeitada text-xs">cancelar</span>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Cancela uma {currentLabel} autorizada. A justificativa deve ter no mínimo 15 caracteres.
                </p>
                <div className="p-3 bg-warning/10 border border-warning/20 rounded-lg text-sm mb-4">
                  <p className="text-muted-foreground">
                    <strong>Atenção:</strong> O cancelamento deve respeitar o prazo da SEFAZ 
                    ({docType === "nfe" ? "até 24h após autorização" : "geralmente 24h após autorização"}).
                  </p>
                </div>
              </div>
              <div className="relative">
                <pre className="bg-sidebar text-sidebar-foreground p-4 rounded-lg overflow-x-auto text-sm">
                  <code>{currentExamples.cancelar}</code>
                </pre>
                <CopyButton text={currentExamples.cancelar} section={`${docType}-cancelar`} />
              </div>
            </TabsContent>

            <TabsContent value="reprocessar" className="space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h4 className="font-medium text-foreground">Reprocessar {currentLabel}</h4>
                  <span className="status-badge status-cancelada text-xs">reprocessar</span>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Adiciona novamente uma {currentLabel} rejeitada ou pendente à fila de processamento.
                </p>
              </div>
              <div className="relative">
                <pre className="bg-sidebar text-sidebar-foreground p-4 rounded-lg overflow-x-auto text-sm">
                  <code>{currentExamples.reprocessar}</code>
                </pre>
                <CopyButton text={currentExamples.reprocessar} section={`${docType}-reprocessar`} />
              </div>
            </TabsContent>

            <TabsContent value="xml" className="space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h4 className="font-medium text-foreground">Obter XML</h4>
                  <span className="status-badge status-processando text-xs">consultar</span>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Retorna os XMLs de envio e retorno da {currentLabel}.
                </p>
              </div>
              <div className="relative">
                <pre className="bg-sidebar text-sidebar-foreground p-4 rounded-lg overflow-x-auto text-sm">
                  <code>{currentExamples.xml}</code>
                </pre>
                <CopyButton text={currentExamples.xml} section={`${docType}-xml`} />
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* NF-e specific: Differences table */}
        {docType === "nfe" && (
          <div className="card-elevated p-6">
            <h3 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Diferenças NF-e vs NFC-e
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-sm font-medium text-muted-foreground py-2">Característica</th>
                    <th className="text-left text-sm font-medium text-muted-foreground py-2">NF-e (Mod. 55)</th>
                    <th className="text-left text-sm font-medium text-muted-foreground py-2">NFC-e (Mod. 65)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-sm">
                  <tr>
                    <td className="py-2 font-medium">Destinatário</td>
                    <td className="py-2 text-muted-foreground">Obrigatório (empresa ou pessoa)</td>
                    <td className="py-2 text-muted-foreground">Opcional (consumidor final)</td>
                  </tr>
                  <tr>
                    <td className="py-2 font-medium">IPI</td>
                    <td className="py-2 text-muted-foreground">Sim (campo obrigatório)</td>
                    <td className="py-2 text-muted-foreground">Não se aplica</td>
                  </tr>
                  <tr>
                    <td className="py-2 font-medium">Frete</td>
                    <td className="py-2 text-muted-foreground">Modalidade obrigatória (0-9)</td>
                    <td className="py-2 text-muted-foreground">Sem frete (padrão 9)</td>
                  </tr>
                  <tr>
                    <td className="py-2 font-medium">Finalidade</td>
                    <td className="py-2 text-muted-foreground">Normal, Complementar, Ajuste, Devolução</td>
                    <td className="py-2 text-muted-foreground">Apenas Normal</td>
                  </tr>
                  <tr>
                    <td className="py-2 font-medium">CSC/QRCode</td>
                    <td className="py-2 text-muted-foreground">Não necessário</td>
                    <td className="py-2 text-muted-foreground">Obrigatório</td>
                  </tr>
                  <tr>
                    <td className="py-2 font-medium">Impressão</td>
                    <td className="py-2 text-muted-foreground">DANFE A4</td>
                    <td className="py-2 text-muted-foreground">DANFCE (cupom)</td>
                  </tr>
                  <tr>
                    <td className="py-2 font-medium">Endpoint</td>
                    <td className="py-2"><code className="text-xs">/nfe-api</code></td>
                    <td className="py-2"><code className="text-xs">/nfce-api</code></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Webhooks Section */}
        <div className="card-elevated p-6">
          <h3 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
            <Webhook className="h-5 w-5 text-primary" />
            Webhooks
          </h3>
          <p className="text-muted-foreground mb-6">
            Configure webhooks para receber notificações em tempo real. 
            Os mesmos eventos estão disponíveis para NFC-e e NF-e.
          </p>

          <div className="grid md:grid-cols-2 gap-4 mb-6">
            {[
              { evento: `${docType}.autorizada`, desc: `Disparado quando a ${currentLabel} é autorizada pela SEFAZ.`, icon: CheckCircle2, color: "green" },
              { evento: `${docType}.rejeitada`, desc: `Disparado quando a SEFAZ rejeita a ${currentLabel}.`, icon: AlertCircle, color: "red" },
              { evento: `${docType}.cancelada`, desc: `Disparado quando a ${currentLabel} é cancelada.`, icon: RefreshCw, color: "gray" },
              { evento: `${docType}.denegada`, desc: `Disparado quando a ${currentLabel} é denegada.`, icon: Shield, color: "orange" },
            ].map(({ evento, desc, icon: Icon, color }) => (
              <div key={evento} className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`h-8 w-8 rounded-full bg-${color}-100 dark:bg-${color}-900/30 flex items-center justify-center`}>
                    <Icon className={`h-4 w-4 text-${color}-600 dark:text-${color}-400`} />
                  </div>
                  <code className="text-sm font-semibold">{evento}</code>
                </div>
                <p className="text-sm text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-6">
            <h4 className="text-sm font-semibold text-foreground mb-3">Validação de Assinatura</h4>
            <p className="text-sm text-muted-foreground mb-4">
              Todos os webhooks incluem assinatura HMAC-SHA256 no header <code>X-Webhook-Signature</code>.
            </p>
            <div className="relative">
              <pre className="bg-sidebar text-sidebar-foreground p-4 rounded-lg overflow-x-auto text-sm max-h-[400px]">
                <code>{webhookValidation}</code>
              </pre>
              <CopyButton text={webhookValidation} section="webhook-validation" />
            </div>
          </div>

          <div className="mt-4 p-4 bg-primary/5 border border-primary/20 rounded-lg flex gap-3">
            <Clock className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">Retry Automático</p>
              <p className="text-sm text-muted-foreground">
                Se seu endpoint retornar erro (status ≥ 400), tentaremos novamente até 3 vezes com backoff exponencial.
              </p>
            </div>
          </div>
        </div>

        {/* Integration Example (NF-e only) */}
        {docType === "nfe" && (
          <div className="card-elevated p-6">
            <h3 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              Exemplo de Integração Completa — NF-e
            </h3>
            <p className="text-muted-foreground mb-4">
              Classe JavaScript/TypeScript pronta para uso que encapsula toda a comunicação com a API de NF-e.
            </p>
            <div className="relative">
              <pre className="bg-sidebar text-sidebar-foreground p-4 rounded-lg overflow-x-auto text-sm max-h-[500px]">
                <code>{nfeIntegracaoCompleta}</code>
              </pre>
              <CopyButton text={nfeIntegracaoCompleta} section="nfe-integracao" />
            </div>
          </div>
        )}

        {/* Error Codes */}
        <div className="card-elevated p-6">
          <h3 className="text-base font-semibold text-foreground mb-4">Códigos de Erro</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-sm font-medium text-muted-foreground py-2">Código</th>
                  <th className="text-left text-sm font-medium text-muted-foreground py-2">HTTP</th>
                  <th className="text-left text-sm font-medium text-muted-foreground py-2">Descrição</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[
                  ["AUTH_REQUIRED", "401", "Token de API não fornecido"],
                  ["AUTH_INVALID", "401", "Token inválido, expirado ou revogado"],
                  ["PERMISSION_DENIED", "403", "Token não possui permissão para esta operação"],
                  ["NOT_FOUND", "404", `${currentLabel} não encontrada ou não pertence à empresa`],
                  ["VALIDATION_ERROR", "400", "Dados inválidos na requisição"],
                  ["INVALID_STATUS", "400", `Operação não permitida para o status atual da ${currentLabel}`],
                  ["INTERNAL_ERROR", "500", "Erro interno do servidor"],
                ].map(([code, http, desc]) => (
                  <tr key={code}>
                    <td className="py-2"><code className="text-sm">{code}</code></td>
                    <td className="py-2 text-sm">{http}</td>
                    <td className="py-2 text-sm text-muted-foreground">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Status Flow */}
        <div className="card-elevated p-6">
          <h3 className="text-base font-semibold text-foreground mb-4">Fluxo de Status da {currentLabel}</h3>
          <div className="flex flex-wrap items-center justify-center gap-2 p-4 bg-muted/50 rounded-lg">
            <span className="status-badge status-pendente">pendente</span>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <span className="status-badge status-processando">processando</span>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <div className="flex flex-col items-center gap-1">
              <span className="status-badge status-autorizada">autorizada</span>
              <span className="text-xs text-muted-foreground">ou</span>
              <span className="status-badge status-rejeitada">rejeitada</span>
              <span className="text-xs text-muted-foreground">ou</span>
              <span className="status-badge status-denegada">denegada</span>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <span className="status-badge status-cancelada">cancelada</span>
          </div>
        </div>

        {/* Support */}
        <div className="card-elevated p-6">
          <h3 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
            <ExternalLink className="h-5 w-5 text-primary" />
            Suporte
          </h3>
          <p className="text-muted-foreground mb-4">
            Precisa de ajuda com a integração? Consulte os logs de API na plataforma.
          </p>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="p-4 border rounded-lg text-center">
              <h4 className="font-medium text-sm mb-1">Logs</h4>
              <p className="text-xs text-muted-foreground">Visualize todas as requisições e erros</p>
            </div>
            <div className="p-4 border rounded-lg text-center">
              <h4 className="font-medium text-sm mb-1">Webhooks</h4>
              <p className="text-xs text-muted-foreground">Histórico de entregas e reenvio manual</p>
            </div>
            <div className="p-4 border rounded-lg text-center">
              <h4 className="font-medium text-sm mb-1">Ambiente</h4>
              <p className="text-xs text-muted-foreground">Use homologação para testes</p>
            </div>
          </div>
        </div>
        </div>
      </main>
    </div>
  );
}
