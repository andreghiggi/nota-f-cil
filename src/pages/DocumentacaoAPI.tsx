import { AppLayout } from "@/components/layout/AppLayout";
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
  Database
} from "lucide-react";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const API_BASE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/nfce-api`;

const codeExamples = {
  emitir: `// Emitir NFC-e
const response = await fetch('${API_BASE_URL}', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': 'SEU_TOKEN_API'
  },
  body: JSON.stringify({
    external_id: 'VENDA-12345', // ID único da venda no seu ERP
    itens: [
      {
        codigo: 'PROD001',
        descricao: 'Camiseta Básica Algodão',
        ncm: '61091000',
        cfop: '5102',
        unidade: 'UN',
        quantidade: 2,
        valor_unitario: 49.90,
        csosn: '102',       // Para Simples Nacional
        aliquota_icms: 0,
        cst_pis: '01',
        aliquota_pis: 1.65,
        cst_cofins: '01',
        aliquota_cofins: 7.60
      },
      {
        codigo: 'PROD002',
        descricao: 'Calça Jeans Masculina',
        ncm: '62034200',
        cfop: '5102',
        unidade: 'UN',
        quantidade: 1,
        valor_unitario: 129.90,
        csosn: '102',
        aliquota_icms: 0,
        cst_pis: '01',
        aliquota_pis: 1.65,
        cst_cofins: '01',
        aliquota_cofins: 7.60
      }
    ],
    valor_desconto: 10.00,
    valor_frete: 0,
    observacoes: 'Venda ao consumidor final - Loja Centro'
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
//     "status": "pendente",
//     "ambiente": "homologacao",
//     "valor_total": 219.70,
//     "created_at": "2024-01-15T14:30:00.000Z"
//   }
// }`,

  consultar: `// Consultar status de NFC-e por ID
const nfceId = '550e8400-e29b-41d4-a716-446655440000';
const response = await fetch(\`${API_BASE_URL}/\${nfceId}\`, {
  method: 'GET',
  headers: {
    'x-api-key': 'SEU_TOKEN_API'
  }
});

const data = await response.json();
console.log(data);
// Resposta quando autorizada:
// {
//   "success": true,
//   "data": {
//     "id": "550e8400-e29b-41d4-a716-446655440000",
//     "numero": "000000001",
//     "serie": "001",
//     "chave_acesso": "35240112345678000190650010000000011234567890",
//     "status": "autorizada",
//     "ambiente": "homologacao",
//     "data_emissao": "2024-01-15",
//     "valor_total": 219.70,
//     "protocolo": "135240000123456",
//     "codigo_retorno": "100",
//     "motivo_retorno": "Autorizado o uso da NF-e",
//     "data_autorizacao": "2024-01-15T14:30:05.000Z",
//     "qrcode_url": "https://nfce.sefaz.uf.gov.br/...",
//     "external_id": "VENDA-12345",
//     "created_at": "2024-01-15T14:30:00.000Z",
//     "updated_at": "2024-01-15T14:30:05.000Z"
//   }
// }`,

  listar: `// Listar NFC-e com filtros e paginação
const params = new URLSearchParams({
  status: 'autorizada',      // Filtro por status (opcional)
  data_inicio: '2024-01-01', // Data inicial (opcional)
  data_fim: '2024-01-31',    // Data final (opcional)
  limit: '50',               // Máximo 100 (padrão: 50)
  offset: '0'                // Para paginação
});

const response = await fetch(\`${API_BASE_URL}?\${params}\`, {
  method: 'GET',
  headers: {
    'x-api-key': 'SEU_TOKEN_API'
  }
});

const data = await response.json();
console.log(data);
// Resposta:
// {
//   "success": true,
//   "data": [
//     {
//       "id": "550e8400-e29b-41d4-a716-446655440000",
//       "numero": "000000001",
//       "serie": "001",
//       "chave_acesso": "35240112345678000190...",
//       "status": "autorizada",
//       "ambiente": "homologacao",
//       "data_emissao": "2024-01-15",
//       "valor_total": 219.70,
//       "protocolo": "135240000123456",
//       "external_id": "VENDA-12345",
//       "created_at": "2024-01-15T14:30:00.000Z"
//     },
//     // ... mais registros
//   ],
//   "pagination": {
//     "total": 150,
//     "limit": 50,
//     "offset": 0
//   }
// }`,

  cancelar: `// Cancelar NFC-e autorizada
const nfceId = '550e8400-e29b-41d4-a716-446655440000';
const response = await fetch(\`${API_BASE_URL}/\${nfceId}/cancelar\`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': 'SEU_TOKEN_API'
  },
  body: JSON.stringify({
    justificativa: 'Erro na digitação do valor do produto - venda será refeita'
    // Mínimo 15 caracteres
  })
});

const data = await response.json();
console.log(data);
// Resposta:
// {
//   "success": true,
//   "data": {
//     "id": "550e8400-e29b-41d4-a716-446655440000",
//     "evento_id": "660e8400-e29b-41d4-a716-446655440001",
//     "status": "cancelada"
//   }
// }`,

  reprocessar: `// Reprocessar NFC-e rejeitada ou pendente
const nfceId = '550e8400-e29b-41d4-a716-446655440000';
const response = await fetch(\`${API_BASE_URL}/\${nfceId}/reprocessar\`, {
  method: 'POST',
  headers: {
    'x-api-key': 'SEU_TOKEN_API'
  }
});

const data = await response.json();
console.log(data);
// Resposta:
// {
//   "success": true,
//   "data": {
//     "id": "550e8400-e29b-41d4-a716-446655440000",
//     "status": "pendente"
//   }
// }`,

  xml: `// Obter XMLs da NFC-e (envio e retorno)
const nfceId = '550e8400-e29b-41d4-a716-446655440000';
const response = await fetch(\`${API_BASE_URL}/\${nfceId}/xml\`, {
  method: 'GET',
  headers: {
    'x-api-key': 'SEU_TOKEN_API'
  }
});

const data = await response.json();
console.log(data);
// Resposta:
// {
//   "success": true,
//   "data": {
//     "xml_envio": "<?xml version=\\"1.0\\"?><NFe>...</NFe>",
//     "xml_retorno": "<?xml version=\\"1.0\\"?><nfeProc>...</nfeProc>"
//   }
// }`,

  webhookValidation: `// Validar assinatura do webhook (Node.js/Express)
const crypto = require('crypto');

function validateWebhookSignature(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
  
  return signature === \`sha256=\${expectedSignature}\`;
}

// Endpoint do seu ERP para receber webhooks
app.post('/webhooks/nfce', (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  const payload = req.body;
  
  // Valide a assinatura para garantir autenticidade
  if (!validateWebhookSignature(payload, signature, 'SEU_SECRET_DO_WEBHOOK')) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  const { evento, dados, timestamp } = payload;
  
  switch (evento) {
    case 'nfce.autorizada':
      console.log(\`NFC-e \${dados.numero} autorizada!\`);
      console.log(\`Chave: \${dados.chave_acesso}\`);
      console.log(\`Protocolo: \${dados.protocolo}\`);
      // Atualizar status no seu ERP
      break;
      
    case 'nfce.rejeitada':
      console.log(\`NFC-e \${dados.numero} rejeitada: \${dados.motivo_retorno}\`);
      // Notificar usuário para correção
      break;
      
    case 'nfce.cancelada':
      console.log(\`NFC-e \${dados.numero} cancelada\`);
      // Estornar venda no ERP
      break;
      
    case 'nfce.denegada':
      console.log(\`NFC-e \${dados.numero} denegada: \${dados.motivo_retorno}\`);
      // Tratar situação especial
      break;
  }
  
  // Sempre retorne 200 para confirmar recebimento
  res.status(200).json({ received: true });
});`,

  integracaoCompleta: `// ========================================
// INTEGRAÇÃO COMPLETA - EXEMPLO ERP
// ========================================

class NFCeClient {
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
    
    if (!response.ok) {
      throw new Error(data.error || 'API Error');
    }
    
    return data;
  }

  // Emitir NFC-e
  async emitir(venda) {
    return this.request('', {
      method: 'POST',
      body: JSON.stringify({
        external_id: venda.id,
        itens: venda.itens.map(item => ({
          codigo: item.sku,
          descricao: item.nome,
          ncm: item.ncm,
          cfop: item.cfop,
          unidade: item.unidade,
          quantidade: item.qtd,
          valor_unitario: item.preco,
          csosn: item.csosn,
          aliquota_icms: item.aliqIcms,
          cst_pis: item.cstPis,
          aliquota_pis: item.aliqPis,
          cst_cofins: item.cstCofins,
          aliquota_cofins: item.aliqCofins
        })),
        valor_desconto: venda.desconto,
        valor_frete: venda.frete,
        observacoes: venda.obs
      })
    });
  }

  // Consultar por ID
  async consultar(nfceId) {
    return this.request(\`/\${nfceId}\`);
  }

  // Listar com filtros
  async listar(filtros = {}) {
    const params = new URLSearchParams(filtros);
    return this.request(\`?\${params}\`);
  }

  // Cancelar
  async cancelar(nfceId, justificativa) {
    return this.request(\`/\${nfceId}/cancelar\`, {
      method: 'POST',
      body: JSON.stringify({ justificativa })
    });
  }

  // Reprocessar
  async reprocessar(nfceId) {
    return this.request(\`/\${nfceId}/reprocessar\`, { method: 'POST' });
  }

  // Obter XML
  async obterXml(nfceId) {
    return this.request(\`/\${nfceId}/xml\`);
  }
}

// Uso:
const client = new NFCeClient('SEU_TOKEN', '${API_BASE_URL}');

// 1. Emitir NFC-e quando finalizar venda
const venda = {
  id: 'VENDA-12345',
  itens: [{ sku: 'P001', nome: 'Produto', ncm: '12345678', cfop: '5102', 
            unidade: 'UN', qtd: 1, preco: 99.90, csosn: '102' }],
  desconto: 0,
  frete: 0,
  obs: ''
};

const resultado = await client.emitir(venda);
console.log('NFC-e criada:', resultado.data.id);

// 2. Aguardar webhook de autorização ou consultar periodicamente
// Recomendado: usar webhooks para notificação em tempo real`
};

const webhookPayloads = {
  autorizada: `{
  "evento": "nfce.autorizada",
  "timestamp": "2024-01-15T14:30:05.000Z",
  "dados": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "numero": "000000001",
    "serie": "001",
    "chave_acesso": "35240112345678000190650010000000011234567890",
    "protocolo": "135240000123456",
    "data_autorizacao": "2024-01-15T14:30:05.000Z",
    "valor_total": 219.70,
    "qrcode_url": "https://nfce.sefaz.uf.gov.br/...",
    "external_id": "VENDA-12345"
  }
}`,
  rejeitada: `{
  "evento": "nfce.rejeitada",
  "timestamp": "2024-01-15T14:30:05.000Z",
  "dados": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "numero": "000000001",
    "serie": "001",
    "codigo_retorno": "539",
    "motivo_retorno": "Duplicidade de NF-e, com diferença na chave de acesso",
    "valor_total": 219.70,
    "external_id": "VENDA-12345"
  }
}`,
  cancelada: `{
  "evento": "nfce.cancelada",
  "timestamp": "2024-01-15T15:00:00.000Z",
  "dados": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "numero": "000000001",
    "serie": "001",
    "chave_acesso": "35240112345678000190650010000000011234567890",
    "protocolo_cancelamento": "135240000123457",
    "valor_total": 219.70,
    "external_id": "VENDA-12345"
  }
}`,
  denegada: `{
  "evento": "nfce.denegada",
  "timestamp": "2024-01-15T14:30:05.000Z",
  "dados": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "numero": "000000001",
    "serie": "001",
    "codigo_retorno": "302",
    "motivo_retorno": "Irregularidade fiscal do emitente",
    "valor_total": 219.70,
    "external_id": "VENDA-12345"
  }
}`
};

export default function DocumentacaoAPI() {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

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

  return (
    <AppLayout title="Documentação da API" subtitle="Guia completo de integração para desenvolvedores de ERP">
      <div className="space-y-8 animate-fade-in max-w-5xl">
        {/* Hero Section */}
        <div className="card-elevated p-6 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <div className="flex items-start gap-4">
            <div className="h-14 w-14 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
              <Code className="h-7 w-7 text-primary" />
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-foreground mb-2">API REST de Emissão de NFC-e</h2>
              <p className="text-muted-foreground mb-4">
                Integre seu ERP ou PDV com nossa plataforma de emissão de NFC-e. Envie apenas os dados comerciais 
                da venda — toda a lógica fiscal, cálculo de impostos, assinatura digital e comunicação com a SEFAZ 
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
              </div>
            </div>
          </div>
        </div>

        {/* Quick Start Guide */}
        <div className="card-elevated p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Início Rápido
          </h3>
          <div className="grid md:grid-cols-4 gap-4">
            <div className="flex flex-col items-center text-center p-4 bg-muted/50 rounded-lg">
              <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center mb-2 text-primary font-bold">1</div>
              <h4 className="font-medium text-sm">Cadastre sua Empresa</h4>
              <p className="text-xs text-muted-foreground mt-1">Configure CNPJ, certificado digital e CSC</p>
            </div>
            <div className="flex flex-col items-center text-center p-4 bg-muted/50 rounded-lg">
              <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center mb-2 text-primary font-bold">2</div>
              <h4 className="font-medium text-sm">Gere um Token</h4>
              <p className="text-xs text-muted-foreground mt-1">Crie um token com as permissões necessárias</p>
            </div>
            <div className="flex flex-col items-center text-center p-4 bg-muted/50 rounded-lg">
              <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center mb-2 text-primary font-bold">3</div>
              <h4 className="font-medium text-sm">Configure Webhooks</h4>
              <p className="text-xs text-muted-foreground mt-1">Receba notificações de status em tempo real</p>
            </div>
            <div className="flex flex-col items-center text-center p-4 bg-muted/50 rounded-lg">
              <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center mb-2 text-primary font-bold">4</div>
              <h4 className="font-medium text-sm">Integre sua API</h4>
              <p className="text-xs text-muted-foreground mt-1">Envie vendas e receba NFC-e autorizadas</p>
            </div>
          </div>
        </div>

        {/* Base URL */}
        <div className="card-elevated p-6">
          <h3 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
            <Terminal className="h-5 w-5 text-primary" />
            URL Base
          </h3>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-muted px-4 py-3 rounded-lg text-sm font-mono text-foreground overflow-x-auto">
              {API_BASE_URL}
            </code>
            <Button 
              variant="outline" 
              size="icon"
              onClick={() => copyToClipboard(API_BASE_URL, 'base-url')}
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
            Todas as requisições devem incluir um token de API válido. O token pode ser enviado de duas formas:
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
                <p className="text-xs text-muted-foreground">Permite criar novas NFC-e</p>
              </div>
              <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
                <span className="status-badge status-processando text-xs">consultar</span>
                <p className="text-xs text-muted-foreground">Permite consultar status e listar NFC-e</p>
              </div>
              <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
                <span className="status-badge status-rejeitada text-xs">cancelar</span>
                <p className="text-xs text-muted-foreground">Permite cancelar NFC-e autorizadas</p>
              </div>
              <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
                <span className="status-badge status-cancelada text-xs">reprocessar</span>
                <p className="text-xs text-muted-foreground">Permite reprocessar NFC-e rejeitadas</p>
              </div>
            </div>
          </div>

          <div className="mt-4 p-4 bg-warning/10 border border-warning/20 rounded-lg flex gap-3">
            <AlertCircle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">Importante</p>
              <p className="text-sm text-muted-foreground">
                Mantenha seu token em segurança. Nunca exponha em código front-end ou repositórios públicos.
                Tokens podem ser revogados a qualquer momento na página de Tokens.
              </p>
            </div>
          </div>
        </div>

        {/* Endpoints */}
        <div className="card-elevated p-6">
          <h3 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
            <FileJson className="h-5 w-5 text-primary" />
            Endpoints
          </h3>
          
          <Tabs defaultValue="emitir" className="space-y-4">
            <TabsList className="flex flex-wrap gap-2 h-auto p-1 bg-muted/50">
              <TabsTrigger value="emitir" className="text-xs sm:text-sm">POST /nfce-api</TabsTrigger>
              <TabsTrigger value="consultar" className="text-xs sm:text-sm">GET /:id</TabsTrigger>
              <TabsTrigger value="listar" className="text-xs sm:text-sm">GET /</TabsTrigger>
              <TabsTrigger value="cancelar" className="text-xs sm:text-sm">POST /:id/cancelar</TabsTrigger>
              <TabsTrigger value="reprocessar" className="text-xs sm:text-sm">POST /:id/reprocessar</TabsTrigger>
              <TabsTrigger value="xml" className="text-xs sm:text-sm">GET /:id/xml</TabsTrigger>
            </TabsList>

            <TabsContent value="emitir" className="space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h4 className="font-medium text-foreground">Emitir NFC-e</h4>
                  <span className="status-badge status-autorizada text-xs">emitir</span>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Cria uma nova NFC-e e adiciona à fila de processamento. A plataforma calculará automaticamente 
                  os impostos, gerará o XML, assinará digitalmente e enviará à SEFAZ.
                </p>
                
                <Accordion type="single" collapsible className="mb-4">
                  <AccordionItem value="campos">
                    <AccordionTrigger className="text-sm">Campos do Item</AccordionTrigger>
                    <AccordionContent>
                      <div className="grid gap-2 text-sm">
                        <div className="grid grid-cols-3 gap-2 p-2 bg-muted/50 rounded font-medium">
                          <span>Campo</span>
                          <span>Tipo</span>
                          <span>Descrição</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 p-2 border-b">
                          <code className="text-xs">codigo</code>
                          <span className="text-xs text-muted-foreground">string*</span>
                          <span className="text-xs text-muted-foreground">Código do produto no ERP</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 p-2 border-b">
                          <code className="text-xs">descricao</code>
                          <span className="text-xs text-muted-foreground">string*</span>
                          <span className="text-xs text-muted-foreground">Descrição do produto</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 p-2 border-b">
                          <code className="text-xs">ncm</code>
                          <span className="text-xs text-muted-foreground">string</span>
                          <span className="text-xs text-muted-foreground">Código NCM (8 dígitos)</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 p-2 border-b">
                          <code className="text-xs">cfop</code>
                          <span className="text-xs text-muted-foreground">string*</span>
                          <span className="text-xs text-muted-foreground">CFOP (ex: 5102)</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 p-2 border-b">
                          <code className="text-xs">unidade</code>
                          <span className="text-xs text-muted-foreground">string*</span>
                          <span className="text-xs text-muted-foreground">UN, KG, LT, etc.</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 p-2 border-b">
                          <code className="text-xs">quantidade</code>
                          <span className="text-xs text-muted-foreground">number*</span>
                          <span className="text-xs text-muted-foreground">Quantidade vendida</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 p-2 border-b">
                          <code className="text-xs">valor_unitario</code>
                          <span className="text-xs text-muted-foreground">number*</span>
                          <span className="text-xs text-muted-foreground">Valor unitário</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 p-2 border-b">
                          <code className="text-xs">csosn</code>
                          <span className="text-xs text-muted-foreground">string</span>
                          <span className="text-xs text-muted-foreground">CSOSN (Simples Nacional)</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 p-2 border-b">
                          <code className="text-xs">cst_icms</code>
                          <span className="text-xs text-muted-foreground">string</span>
                          <span className="text-xs text-muted-foreground">CST ICMS (Regime Normal)</span>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
              <div className="relative">
                <pre className="bg-sidebar text-sidebar-foreground p-4 rounded-lg overflow-x-auto text-sm max-h-[500px]">
                  <code>{codeExamples.emitir}</code>
                </pre>
                <CopyButton text={codeExamples.emitir} section="emitir" />
              </div>
            </TabsContent>

            <TabsContent value="consultar" className="space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h4 className="font-medium text-foreground">Consultar NFC-e</h4>
                  <span className="status-badge status-processando text-xs">consultar</span>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Retorna os dados completos de uma NFC-e, incluindo status atual, protocolo de autorização, 
                  chave de acesso e URL do QR Code.
                </p>
              </div>
              <div className="relative">
                <pre className="bg-sidebar text-sidebar-foreground p-4 rounded-lg overflow-x-auto text-sm max-h-[500px]">
                  <code>{codeExamples.consultar}</code>
                </pre>
                <CopyButton text={codeExamples.consultar} section="consultar" />
              </div>
            </TabsContent>

            <TabsContent value="listar" className="space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h4 className="font-medium text-foreground">Listar NFC-e</h4>
                  <span className="status-badge status-processando text-xs">consultar</span>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Lista todas as NFC-e com suporte a filtros por status, período e paginação.
                  Máximo de 100 registros por página.
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
                  <code>{codeExamples.listar}</code>
                </pre>
                <CopyButton text={codeExamples.listar} section="listar" />
              </div>
            </TabsContent>

            <TabsContent value="cancelar" className="space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h4 className="font-medium text-foreground">Cancelar NFC-e</h4>
                  <span className="status-badge status-rejeitada text-xs">cancelar</span>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Cancela uma NFC-e autorizada. A justificativa deve ter no mínimo 15 caracteres.
                  O cancelamento é transmitido à SEFAZ e um evento de cancelamento é registrado.
                </p>
                <div className="p-3 bg-warning/10 border border-warning/20 rounded-lg text-sm mb-4">
                  <p className="text-muted-foreground">
                    <strong>Atenção:</strong> O cancelamento de NFC-e deve respeitar o prazo estabelecido pela SEFAZ 
                    (geralmente 24 horas após a autorização). Após esse prazo, utilize a inutilização de numeração.
                  </p>
                </div>
              </div>
              <div className="relative">
                <pre className="bg-sidebar text-sidebar-foreground p-4 rounded-lg overflow-x-auto text-sm">
                  <code>{codeExamples.cancelar}</code>
                </pre>
                <CopyButton text={codeExamples.cancelar} section="cancelar" />
              </div>
            </TabsContent>

            <TabsContent value="reprocessar" className="space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h4 className="font-medium text-foreground">Reprocessar NFC-e</h4>
                  <span className="status-badge status-cancelada text-xs">reprocessar</span>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Adiciona novamente uma NFC-e rejeitada ou pendente à fila de processamento.
                  Útil após corrigir dados no ERP ou quando houver problemas temporários com a SEFAZ.
                </p>
              </div>
              <div className="relative">
                <pre className="bg-sidebar text-sidebar-foreground p-4 rounded-lg overflow-x-auto text-sm">
                  <code>{codeExamples.reprocessar}</code>
                </pre>
                <CopyButton text={codeExamples.reprocessar} section="reprocessar" />
              </div>
            </TabsContent>

            <TabsContent value="xml" className="space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h4 className="font-medium text-foreground">Obter XML</h4>
                  <span className="status-badge status-processando text-xs">consultar</span>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Retorna os XMLs de envio e retorno da NFC-e. O XML de retorno contém a NFC-e autorizada 
                  com o protocolo de autorização, pronto para armazenamento fiscal.
                </p>
              </div>
              <div className="relative">
                <pre className="bg-sidebar text-sidebar-foreground p-4 rounded-lg overflow-x-auto text-sm">
                  <code>{codeExamples.xml}</code>
                </pre>
                <CopyButton text={codeExamples.xml} section="xml" />
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Webhooks Section */}
        <div className="card-elevated p-6">
          <h3 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
            <Webhook className="h-5 w-5 text-primary" />
            Webhooks
          </h3>
          <p className="text-muted-foreground mb-6">
            Configure webhooks para receber notificações em tempo real quando o status de uma NFC-e mudar.
            Isso elimina a necessidade de polling e permite que seu ERP reaja imediatamente às autorizações e rejeições.
          </p>

          <div className="grid md:grid-cols-2 gap-4 mb-6">
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                </div>
                <code className="text-sm font-semibold">nfce.autorizada</code>
              </div>
              <p className="text-sm text-muted-foreground">
                Disparado quando a NFC-e é autorizada pela SEFAZ. Contém chave de acesso, protocolo e QR Code.
              </p>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-8 w-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                </div>
                <code className="text-sm font-semibold">nfce.rejeitada</code>
              </div>
              <p className="text-sm text-muted-foreground">
                Disparado quando a SEFAZ rejeita a NFC-e. Contém código e motivo da rejeição.
              </p>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-8 w-8 rounded-full bg-gray-100 dark:bg-gray-900/30 flex items-center justify-center">
                  <RefreshCw className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                </div>
                <code className="text-sm font-semibold">nfce.cancelada</code>
              </div>
              <p className="text-sm text-muted-foreground">
                Disparado quando uma NFC-e é cancelada. Contém protocolo do cancelamento.
              </p>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-8 w-8 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                  <Shield className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                </div>
                <code className="text-sm font-semibold">nfce.denegada</code>
              </div>
              <p className="text-sm text-muted-foreground">
                Disparado quando a NFC-e é denegada (irregularidade fiscal). Requer atenção especial.
              </p>
            </div>
          </div>

          <h4 className="text-sm font-semibold text-foreground mb-3">Payloads dos Webhooks</h4>
          <Tabs defaultValue="autorizada" className="space-y-4">
            <TabsList className="flex flex-wrap gap-2 h-auto p-1 bg-muted/50">
              <TabsTrigger value="autorizada" className="text-xs">Autorizada</TabsTrigger>
              <TabsTrigger value="rejeitada" className="text-xs">Rejeitada</TabsTrigger>
              <TabsTrigger value="cancelada" className="text-xs">Cancelada</TabsTrigger>
              <TabsTrigger value="denegada" className="text-xs">Denegada</TabsTrigger>
            </TabsList>

            {Object.entries(webhookPayloads).map(([key, payload]) => (
              <TabsContent key={key} value={key}>
                <div className="relative">
                  <pre className="bg-sidebar text-sidebar-foreground p-4 rounded-lg overflow-x-auto text-sm">
                    <code>{payload}</code>
                  </pre>
                  <CopyButton text={payload} section={`webhook-${key}`} />
                </div>
              </TabsContent>
            ))}
          </Tabs>

          <div className="mt-6">
            <h4 className="text-sm font-semibold text-foreground mb-3">Validação de Assinatura</h4>
            <p className="text-sm text-muted-foreground mb-4">
              Todos os webhooks incluem uma assinatura HMAC-SHA256 no header <code>X-Webhook-Signature</code>.
              Valide sempre a assinatura para garantir que a requisição é autêntica.
            </p>
            <div className="relative">
              <pre className="bg-sidebar text-sidebar-foreground p-4 rounded-lg overflow-x-auto text-sm max-h-[400px]">
                <code>{codeExamples.webhookValidation}</code>
              </pre>
              <CopyButton text={codeExamples.webhookValidation} section="webhook-validation" />
            </div>
          </div>

          <div className="mt-4 p-4 bg-primary/5 border border-primary/20 rounded-lg flex gap-3">
            <Clock className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">Retry Automático</p>
              <p className="text-sm text-muted-foreground">
                Se seu endpoint retornar erro (status ≥ 400) ou timeout, tentaremos novamente em até 3 vezes 
                com backoff exponencial. Webhooks com falhas consecutivas são automaticamente desativados.
              </p>
            </div>
          </div>
        </div>

        {/* Integration Example */}
        <div className="card-elevated p-6">
          <h3 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            Exemplo de Integração Completa
          </h3>
          <p className="text-muted-foreground mb-4">
            Classe JavaScript/TypeScript pronta para uso que encapsula toda a comunicação com a API.
            Pode ser adaptada para qualquer linguagem ou framework.
          </p>
          <div className="relative">
            <pre className="bg-sidebar text-sidebar-foreground p-4 rounded-lg overflow-x-auto text-sm max-h-[500px]">
              <code>{codeExamples.integracaoCompleta}</code>
            </pre>
            <CopyButton text={codeExamples.integracaoCompleta} section="integracao" />
          </div>
        </div>

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
                <tr>
                  <td className="py-2"><code className="text-sm">AUTH_REQUIRED</code></td>
                  <td className="py-2 text-sm">401</td>
                  <td className="py-2 text-sm text-muted-foreground">Token de API não fornecido no header</td>
                </tr>
                <tr>
                  <td className="py-2"><code className="text-sm">AUTH_INVALID</code></td>
                  <td className="py-2 text-sm">401</td>
                  <td className="py-2 text-sm text-muted-foreground">Token inválido, expirado ou revogado</td>
                </tr>
                <tr>
                  <td className="py-2"><code className="text-sm">PERMISSION_DENIED</code></td>
                  <td className="py-2 text-sm">403</td>
                  <td className="py-2 text-sm text-muted-foreground">Token não possui permissão para esta operação</td>
                </tr>
                <tr>
                  <td className="py-2"><code className="text-sm">NOT_FOUND</code></td>
                  <td className="py-2 text-sm">404</td>
                  <td className="py-2 text-sm text-muted-foreground">NFC-e não encontrada ou não pertence à empresa</td>
                </tr>
                <tr>
                  <td className="py-2"><code className="text-sm">VALIDATION_ERROR</code></td>
                  <td className="py-2 text-sm">400</td>
                  <td className="py-2 text-sm text-muted-foreground">Dados inválidos na requisição</td>
                </tr>
                <tr>
                  <td className="py-2"><code className="text-sm">INVALID_STATUS</code></td>
                  <td className="py-2 text-sm">400</td>
                  <td className="py-2 text-sm text-muted-foreground">Operação não permitida para o status atual da NFC-e</td>
                </tr>
                <tr>
                  <td className="py-2"><code className="text-sm">INTERNAL_ERROR</code></td>
                  <td className="py-2 text-sm">500</td>
                  <td className="py-2 text-sm text-muted-foreground">Erro interno do servidor</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Status Flow */}
        <div className="card-elevated p-6">
          <h3 className="text-base font-semibold text-foreground mb-4">Fluxo de Status da NFC-e</h3>
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
          <div className="mt-4 grid md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="font-medium">pendente → processando</span>
              <p className="text-muted-foreground text-xs">Worker busca da fila e inicia processamento</p>
            </div>
            <div>
              <span className="font-medium">processando → autorizada</span>
              <p className="text-muted-foreground text-xs">SEFAZ retorna código 100</p>
            </div>
            <div>
              <span className="font-medium">autorizada → cancelada</span>
              <p className="text-muted-foreground text-xs">Cancelamento solicitado via API</p>
            </div>
          </div>
        </div>

        {/* Support */}
        <div className="card-elevated p-6">
          <h3 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
            <ExternalLink className="h-5 w-5 text-primary" />
            Suporte
          </h3>
          <p className="text-muted-foreground mb-4">
            Precisa de ajuda com a integração? Consulte os logs de API na plataforma ou entre em contato 
            com nosso suporte técnico.
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
    </AppLayout>
  );
}
