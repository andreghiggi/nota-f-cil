import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Search, 
  Filter,
  Download,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  Clock
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface LogEntry {
  id: string;
  timestamp: string;
  tipo: "info" | "success" | "warning" | "error";
  categoria: "nfce" | "certificado" | "api" | "sistema";
  mensagem: string;
  detalhes?: string;
  empresa?: string;
  usuario?: string;
}

const logs: LogEntry[] = [
  {
    id: "1",
    timestamp: "2024-01-15 14:32:15",
    tipo: "success",
    categoria: "nfce",
    mensagem: "NFC-e 000125 autorizada com sucesso",
    detalhes: "Protocolo: 135240000123456 | Chave: 35240112345678000190650010001250001234567890",
    empresa: "Loja Centro Ltda",
  },
  {
    id: "2",
    timestamp: "2024-01-15 14:32:14",
    tipo: "info",
    categoria: "nfce",
    mensagem: "Transmitindo NFC-e 000125 para SEFAZ-SP",
    empresa: "Loja Centro Ltda",
  },
  {
    id: "3",
    timestamp: "2024-01-15 14:32:12",
    tipo: "info",
    categoria: "nfce",
    mensagem: "XML da NFC-e 000125 assinado digitalmente",
    empresa: "Loja Centro Ltda",
  },
  {
    id: "4",
    timestamp: "2024-01-15 14:28:30",
    tipo: "success",
    categoria: "nfce",
    mensagem: "NFC-e 000124 autorizada com sucesso",
    detalhes: "Protocolo: 135240000123455",
    empresa: "Supermercado ABC",
  },
  {
    id: "5",
    timestamp: "2024-01-15 14:15:22",
    tipo: "error",
    categoria: "nfce",
    mensagem: "NFC-e 000123 rejeitada pela SEFAZ",
    detalhes: "Código: 539 - CFOP inválido para operação",
    empresa: "Farmácia Popular",
  },
  {
    id: "6",
    timestamp: "2024-01-15 14:10:05",
    tipo: "warning",
    categoria: "certificado",
    mensagem: "Certificado digital expira em 30 dias",
    detalhes: "Empresa: Supermercado ABC | Vencimento: 28/02/2024",
    empresa: "Supermercado ABC",
  },
  {
    id: "7",
    timestamp: "2024-01-15 13:55:10",
    tipo: "info",
    categoria: "api",
    mensagem: "Nova requisição de emissão recebida",
    detalhes: "Token: nfce_live_sk_1a2b*** | IP: 189.10.XX.XX",
    empresa: "Loja Centro Ltda",
    usuario: "ERP Principal",
  },
  {
    id: "8",
    timestamp: "2024-01-15 12:00:00",
    tipo: "info",
    categoria: "sistema",
    mensagem: "Verificação de status da SEFAZ-SP concluída",
    detalhes: "Status: Online | Tempo de resposta: 245ms",
  },
  {
    id: "9",
    timestamp: "2024-01-15 11:30:00",
    tipo: "warning",
    categoria: "sistema",
    mensagem: "Alta latência detectada na SEFAZ-RJ",
    detalhes: "Tempo de resposta: 3.2s (limite: 2s)",
  },
  {
    id: "10",
    timestamp: "2024-01-15 10:00:00",
    tipo: "success",
    categoria: "certificado",
    mensagem: "Novo certificado A1 importado com sucesso",
    detalhes: "Válido até: 15/06/2025",
    empresa: "Padaria do Zé",
    usuario: "admin@empresa.com.br",
  },
];

const tipoConfig = {
  info: {
    icon: Info,
    color: "text-info",
    bgColor: "bg-info/10",
  },
  success: {
    icon: CheckCircle2,
    color: "text-success",
    bgColor: "bg-success/10",
  },
  warning: {
    icon: AlertTriangle,
    color: "text-warning",
    bgColor: "bg-warning/10",
  },
  error: {
    icon: XCircle,
    color: "text-destructive",
    bgColor: "bg-destructive/10",
  },
};

const categoriaLabels = {
  nfce: "NFC-e",
  certificado: "Certificado",
  api: "API",
  sistema: "Sistema",
};

export default function Logs() {
  return (
    <AppLayout title="Logs" subtitle="Histórico de eventos e atividades do sistema">
      <div className="space-y-6 animate-fade-in">
        {/* Filters */}
        <div className="card-elevated p-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium text-foreground mb-1.5 block">
                Buscar
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar em logs..."
                  className="pl-9 input-focus-ring"
                />
              </div>
            </div>
            <div className="w-40">
              <label className="text-sm font-medium text-foreground mb-1.5 block">
                Tipo
              </label>
              <Select defaultValue="todos">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="success">Sucesso</SelectItem>
                  <SelectItem value="warning">Alerta</SelectItem>
                  <SelectItem value="error">Erro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-40">
              <label className="text-sm font-medium text-foreground mb-1.5 block">
                Categoria
              </label>
              <Select defaultValue="todas">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  <SelectItem value="nfce">NFC-e</SelectItem>
                  <SelectItem value="certificado">Certificado</SelectItem>
                  <SelectItem value="api">API</SelectItem>
                  <SelectItem value="sistema">Sistema</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-40">
              <label className="text-sm font-medium text-foreground mb-1.5 block">
                Empresa
              </label>
              <Select defaultValue="todas">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  <SelectItem value="1">Loja Centro</SelectItem>
                  <SelectItem value="2">Supermercado ABC</SelectItem>
                  <SelectItem value="3">Farmácia Popular</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
          </div>
        </div>

        {/* Logs list */}
        <div className="card-elevated">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Exibindo logs de <span className="font-medium text-foreground">hoje</span>
              </span>
            </div>
            <span className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">1.247</span> eventos
            </span>
          </div>

          <div className="divide-y divide-border">
            {logs.map((log) => {
              const config = tipoConfig[log.tipo];
              const Icon = config.icon;

              return (
                <div key={log.id} className="p-4 hover:bg-muted/30 transition-colors">
                  <div className="flex gap-3">
                    <div className={cn("h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0", config.bgColor)}>
                      <Icon className={cn("h-4 w-4", config.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4 mb-1">
                        <p className="text-sm font-medium text-foreground">
                          {log.mensagem}
                        </p>
                        <span className="text-xs text-muted-foreground whitespace-nowrap tabular-nums">
                          {log.timestamp}
                        </span>
                      </div>
                      {log.detalhes && (
                        <p className="text-sm text-muted-foreground mb-2">
                          {log.detalhes}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2">
                        <span className="px-2 py-0.5 bg-secondary text-secondary-foreground text-xs font-medium rounded">
                          {categoriaLabels[log.categoria]}
                        </span>
                        {log.empresa && (
                          <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs font-medium rounded">
                            {log.empresa}
                          </span>
                        )}
                        {log.usuario && (
                          <span className="text-xs text-muted-foreground">
                            por {log.usuario}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Load more */}
          <div className="p-4 border-t border-border text-center">
            <Button variant="outline">
              Carregar mais logs
            </Button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
