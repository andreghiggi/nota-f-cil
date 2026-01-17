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
  ExternalLink
} from "lucide-react";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
    external_id: 'VENDA-12345', // ID da venda no seu ERP
    itens: [
      {
        codigo: 'PROD001',
        descricao: 'Produto Exemplo',
        ncm: '12345678',
        cfop: '5102',
        unidade: 'UN',
        quantidade: 2,
        valor_unitario: 49.90,
        csosn: '102', // Para Simples Nacional
        aliquota_icms: 0,
        cst_pis: '01',
        aliquota_pis: 1.65,
        cst_cofins: '01',
        aliquota_cofins: 7.60
      }
    ],
    valor_desconto: 5.00,
    observacoes: 'Venda ao consumidor final'
  })
});

const data = await response.json();
console.log(data);
// {
//   success: true,
//   data: {
//     id: "uuid-da-nfce",
//     numero: "000000001",
//     serie: "001",
//     status: "pendente",
//     ambiente: "homologacao",
//     valor_total: 94.80,
//     created_at: "2024-01-15T14:30:00Z"
//   }
// }`,

  consultar: `// Consultar status de NFC-e
const nfceId = 'uuid-da-nfce';
const response = await fetch(\`${API_BASE_URL}/\${nfceId}\`, {
  method: 'GET',
  headers: {
    'x-api-key': 'SEU_TOKEN_API'
  }
});

const data = await response.json();
console.log(data);
// {
//   success: true,
//   data: {
//     id: "uuid-da-nfce",
//     numero: "000000001",
//     serie: "001",
//     chave_acesso: "35240112345678000190650010000000011234567890",
//     status: "autorizada",
//     protocolo: "135240000123456",
//     data_autorizacao: "2024-01-15T14:30:05Z",
//     qrcode_url: "https://..."
//   }
// }`,

  listar: `// Listar NFC-e com filtros
const params = new URLSearchParams({
  status: 'autorizada',
  data_inicio: '2024-01-01',
  data_fim: '2024-01-31',
  limit: '50',
  offset: '0'
});

const response = await fetch(\`${API_BASE_URL}?\${params}\`, {
  method: 'GET',
  headers: {
    'x-api-key': 'SEU_TOKEN_API'
  }
});

const data = await response.json();
console.log(data);
// {
//   success: true,
//   data: [...],
//   pagination: { total: 150, limit: 50, offset: 0 }
// }`,

  cancelar: `// Cancelar NFC-e
const nfceId = 'uuid-da-nfce';
const response = await fetch(\`${API_BASE_URL}/\${nfceId}/cancelar\`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': 'SEU_TOKEN_API'
  },
  body: JSON.stringify({
    justificativa: 'Erro na digitação do valor do produto'
  })
});

const data = await response.json();
console.log(data);
// {
//   success: true,
//   data: {
//     id: "uuid-da-nfce",
//     evento_id: "uuid-do-evento",
//     status: "cancelada"
//   }
// }`,

  reprocessar: `// Reprocessar NFC-e rejeitada
const nfceId = 'uuid-da-nfce';
const response = await fetch(\`${API_BASE_URL}/\${nfceId}/reprocessar\`, {
  method: 'POST',
  headers: {
    'x-api-key': 'SEU_TOKEN_API'
  }
});

const data = await response.json();
// { success: true, data: { id: "...", status: "pendente" } }`,

  xml: `// Obter XML da NFC-e
const nfceId = 'uuid-da-nfce';
const response = await fetch(\`${API_BASE_URL}/\${nfceId}/xml\`, {
  method: 'GET',
  headers: {
    'x-api-key': 'SEU_TOKEN_API'
  }
});

const data = await response.json();
// {
//   success: true,
//   data: {
//     xml_envio: "<?xml version...",
//     xml_retorno: "<?xml version..."
//   }
// }`
};

export default function DocumentacaoAPI() {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const copyToClipboard = (text: string, section: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(section);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  return (
    <AppLayout title="Documentação da API" subtitle="Guia de integração para desenvolvedores de ERP">
      <div className="space-y-8 animate-fade-in max-w-5xl">
        {/* Introduction */}
        <div className="card-elevated p-6">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Code className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground mb-2">API REST de Emissão de NFC-e</h2>
              <p className="text-muted-foreground">
                Esta API permite que sistemas ERP e PDV externos emitam NFC-e através da nossa plataforma.
                O ERP envia apenas os dados comerciais da venda - toda a lógica fiscal, assinatura digital
                e comunicação com a SEFAZ é processada aqui.
              </p>
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
            <code className="flex-1 bg-muted px-4 py-3 rounded-lg text-sm font-mono text-foreground">
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
          <div className="mt-4 p-4 bg-warning/10 border border-warning/20 rounded-lg flex gap-3">
            <AlertCircle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">Importante</p>
              <p className="text-sm text-muted-foreground">
                Cada token tem permissões específicas (emitir, consultar, cancelar, reprocessar).
                Certifique-se de que o token utilizado tem as permissões necessárias para a operação.
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
            <TabsList className="flex flex-wrap gap-2 h-auto p-1">
              <TabsTrigger value="emitir">POST /nfce-api</TabsTrigger>
              <TabsTrigger value="consultar">GET /nfce-api/:id</TabsTrigger>
              <TabsTrigger value="listar">GET /nfce-api</TabsTrigger>
              <TabsTrigger value="cancelar">POST /:id/cancelar</TabsTrigger>
              <TabsTrigger value="reprocessar">POST /:id/reprocessar</TabsTrigger>
              <TabsTrigger value="xml">GET /:id/xml</TabsTrigger>
            </TabsList>

            <TabsContent value="emitir" className="space-y-4">
              <div>
                <h4 className="font-medium text-foreground mb-2">Emitir NFC-e</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Cria uma nova NFC-e e adiciona à fila de processamento. O ERP deve enviar os dados da venda
                  e a plataforma calculará os impostos e gerará o XML.
                </p>
                <div className="space-y-2 mb-4">
                  <span className="status-badge status-autorizada">Permissão: emitir</span>
                </div>
              </div>
              <div className="relative">
                <pre className="bg-sidebar text-sidebar-foreground p-4 rounded-lg overflow-x-auto text-sm">
                  <code>{codeExamples.emitir}</code>
                </pre>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="absolute top-2 right-2"
                  onClick={() => copyToClipboard(codeExamples.emitir, 'emitir')}
                >
                  {copiedSection === 'emitir' ? (
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="consultar" className="space-y-4">
              <div>
                <h4 className="font-medium text-foreground mb-2">Consultar NFC-e</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Retorna os dados completos de uma NFC-e, incluindo status, protocolo, chave de acesso e QR Code.
                </p>
                <div className="space-y-2 mb-4">
                  <span className="status-badge status-processando">Permissão: consultar</span>
                </div>
              </div>
              <div className="relative">
                <pre className="bg-sidebar text-sidebar-foreground p-4 rounded-lg overflow-x-auto text-sm">
                  <code>{codeExamples.consultar}</code>
                </pre>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="absolute top-2 right-2"
                  onClick={() => copyToClipboard(codeExamples.consultar, 'consultar')}
                >
                  {copiedSection === 'consultar' ? (
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="listar" className="space-y-4">
              <div>
                <h4 className="font-medium text-foreground mb-2">Listar NFC-e</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Lista todas as NFC-e com suporte a filtros por status, período e paginação.
                </p>
              </div>
              <div className="relative">
                <pre className="bg-sidebar text-sidebar-foreground p-4 rounded-lg overflow-x-auto text-sm">
                  <code>{codeExamples.listar}</code>
                </pre>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="absolute top-2 right-2"
                  onClick={() => copyToClipboard(codeExamples.listar, 'listar')}
                >
                  {copiedSection === 'listar' ? (
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="cancelar" className="space-y-4">
              <div>
                <h4 className="font-medium text-foreground mb-2">Cancelar NFC-e</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Cancela uma NFC-e autorizada. A justificativa deve ter no mínimo 15 caracteres.
                </p>
                <div className="space-y-2 mb-4">
                  <span className="status-badge status-rejeitada">Permissão: cancelar</span>
                </div>
              </div>
              <div className="relative">
                <pre className="bg-sidebar text-sidebar-foreground p-4 rounded-lg overflow-x-auto text-sm">
                  <code>{codeExamples.cancelar}</code>
                </pre>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="absolute top-2 right-2"
                  onClick={() => copyToClipboard(codeExamples.cancelar, 'cancelar')}
                >
                  {copiedSection === 'cancelar' ? (
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="reprocessar" className="space-y-4">
              <div>
                <h4 className="font-medium text-foreground mb-2">Reprocessar NFC-e</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Adiciona novamente uma NFC-e rejeitada ou pendente à fila de processamento.
                </p>
                <div className="space-y-2 mb-4">
                  <span className="status-badge status-cancelada">Permissão: reprocessar</span>
                </div>
              </div>
              <div className="relative">
                <pre className="bg-sidebar text-sidebar-foreground p-4 rounded-lg overflow-x-auto text-sm">
                  <code>{codeExamples.reprocessar}</code>
                </pre>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="absolute top-2 right-2"
                  onClick={() => copyToClipboard(codeExamples.reprocessar, 'reprocessar')}
                >
                  {copiedSection === 'reprocessar' ? (
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="xml" className="space-y-4">
              <div>
                <h4 className="font-medium text-foreground mb-2">Obter XML</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Retorna os XMLs de envio e retorno da NFC-e.
                </p>
              </div>
              <div className="relative">
                <pre className="bg-sidebar text-sidebar-foreground p-4 rounded-lg overflow-x-auto text-sm">
                  <code>{codeExamples.xml}</code>
                </pre>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="absolute top-2 right-2"
                  onClick={() => copyToClipboard(codeExamples.xml, 'xml')}
                >
                  {copiedSection === 'xml' ? (
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
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
                  <td className="py-2 text-sm text-muted-foreground">Token de API não fornecido</td>
                </tr>
                <tr>
                  <td className="py-2"><code className="text-sm">AUTH_INVALID</code></td>
                  <td className="py-2 text-sm">401</td>
                  <td className="py-2 text-sm text-muted-foreground">Token inválido ou expirado</td>
                </tr>
                <tr>
                  <td className="py-2"><code className="text-sm">PERMISSION_DENIED</code></td>
                  <td className="py-2 text-sm">403</td>
                  <td className="py-2 text-sm text-muted-foreground">Token não tem permissão para esta operação</td>
                </tr>
                <tr>
                  <td className="py-2"><code className="text-sm">NOT_FOUND</code></td>
                  <td className="py-2 text-sm">404</td>
                  <td className="py-2 text-sm text-muted-foreground">Recurso não encontrado</td>
                </tr>
                <tr>
                  <td className="py-2"><code className="text-sm">VALIDATION_ERROR</code></td>
                  <td className="py-2 text-sm">400</td>
                  <td className="py-2 text-sm text-muted-foreground">Dados inválidos na requisição</td>
                </tr>
                <tr>
                  <td className="py-2"><code className="text-sm">INVALID_STATUS</code></td>
                  <td className="py-2 text-sm">400</td>
                  <td className="py-2 text-sm text-muted-foreground">Operação não permitida para o status atual</td>
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

        {/* Status NFC-e */}
        <div className="card-elevated p-6">
          <h3 className="text-base font-semibold text-foreground mb-4">Status da NFC-e</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3 bg-muted rounded-lg">
              <span className="status-badge status-processando mb-2">pendente</span>
              <p className="text-xs text-muted-foreground mt-2">Aguardando processamento</p>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <span className="status-badge status-processando mb-2">processando</span>
              <p className="text-xs text-muted-foreground mt-2">Sendo enviada à SEFAZ</p>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <span className="status-badge status-autorizada mb-2">autorizada</span>
              <p className="text-xs text-muted-foreground mt-2">Autorizada pela SEFAZ</p>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <span className="status-badge status-rejeitada mb-2">rejeitada</span>
              <p className="text-xs text-muted-foreground mt-2">Rejeitada pela SEFAZ</p>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <span className="status-badge status-cancelada mb-2">cancelada</span>
              <p className="text-xs text-muted-foreground mt-2">Cancelada após autorização</p>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <span className="status-badge status-rejeitada mb-2">denegada</span>
              <p className="text-xs text-muted-foreground mt-2">Denegada pela SEFAZ</p>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <span className="status-badge status-processando mb-2">contingencia</span>
              <p className="text-xs text-muted-foreground mt-2">Emitida em contingência</p>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
