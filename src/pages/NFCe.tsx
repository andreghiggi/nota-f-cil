import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Search, 
  MoreHorizontal, 
  Eye, 
  Download, 
  XCircle, 
  RefreshCw,
  Filter,
  Calendar,
  QrCode,
  FileText
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface NFCe {
  id: string;
  chave: string;
  numero: string;
  serie: string;
  empresa: string;
  cnpj: string;
  valor: number;
  status: "autorizada" | "rejeitada" | "processando" | "cancelada" | "denegada";
  dataEmissao: string;
  protocolo?: string;
  motivoRejeicao?: string;
}

const nfceList: NFCe[] = [
  {
    id: "1",
    chave: "35240112345678000190650010001250001234567890",
    numero: "000125",
    serie: "001",
    empresa: "Loja Centro Ltda",
    cnpj: "12.345.678/0001-90",
    valor: 259.90,
    status: "autorizada",
    dataEmissao: "2024-01-15 14:32:00",
    protocolo: "135240000123456",
  },
  {
    id: "2",
    chave: "35240198765432000110650010001240001234567891",
    numero: "000124",
    serie: "001",
    empresa: "Supermercado ABC",
    cnpj: "98.765.432/0001-10",
    valor: 1847.50,
    status: "autorizada",
    dataEmissao: "2024-01-15 14:28:00",
    protocolo: "135240000123455",
  },
  {
    id: "3",
    chave: "35240111222333000144650010001230001234567892",
    numero: "000123",
    serie: "001",
    empresa: "Farmácia Popular",
    cnpj: "11.222.333/0001-44",
    valor: 89.90,
    status: "rejeitada",
    dataEmissao: "2024-01-15 14:15:00",
    motivoRejeicao: "CFOP inválido para operação",
  },
  {
    id: "4",
    chave: "35240112345678000190650010001220001234567893",
    numero: "000122",
    serie: "001",
    empresa: "Loja Centro Ltda",
    cnpj: "12.345.678/0001-90",
    valor: 450.00,
    status: "processando",
    dataEmissao: "2024-01-15 14:10:00",
  },
  {
    id: "5",
    chave: "35240155666777000188650010001210001234567894",
    numero: "000121",
    serie: "001",
    empresa: "Padaria do Zé",
    cnpj: "55.666.777/0001-88",
    valor: 35.50,
    status: "cancelada",
    dataEmissao: "2024-01-15 13:55:00",
    protocolo: "135240000123450",
  },
  {
    id: "6",
    chave: "35240133444555000166650010000150001234567895",
    numero: "000015",
    serie: "001",
    empresa: "Tech Store",
    cnpj: "33.444.555/0001-66",
    valor: 3299.00,
    status: "denegada",
    dataEmissao: "2024-01-15 12:30:00",
    motivoRejeicao: "IE do destinatário não cadastrada",
  },
];

const statusLabels = {
  autorizada: "Autorizada",
  rejeitada: "Rejeitada",
  processando: "Processando",
  cancelada: "Cancelada",
  denegada: "Denegada",
};

const statusStyles = {
  autorizada: "status-autorizada",
  rejeitada: "status-rejeitada",
  processando: "status-processando",
  cancelada: "status-cancelada",
  denegada: "status-rejeitada",
};

export default function NFCe() {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const truncateChave = (chave: string) => {
    return `${chave.substring(0, 12)}...${chave.substring(chave.length - 8)}`;
  };

  return (
    <AppLayout title="NFC-e" subtitle="Gerenciamento de Notas Fiscais de Consumidor Eletrônicas">
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
                  placeholder="Número, chave, empresa..."
                  className="pl-9 input-focus-ring"
                />
              </div>
            </div>
            <div className="w-48">
              <label className="text-sm font-medium text-foreground mb-1.5 block">
                Status
              </label>
              <Select defaultValue="todos">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="autorizada">Autorizada</SelectItem>
                  <SelectItem value="rejeitada">Rejeitada</SelectItem>
                  <SelectItem value="processando">Processando</SelectItem>
                  <SelectItem value="cancelada">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-48">
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
            <div className="w-48">
              <label className="text-sm font-medium text-foreground mb-1.5 block">
                Período
              </label>
              <Button variant="outline" className="w-full justify-start">
                <Calendar className="h-4 w-4 mr-2" />
                Últimos 7 dias
              </Button>
            </div>
            <Button variant="outline">
              <Filter className="h-4 w-4 mr-2" />
              Mais filtros
            </Button>
          </div>
        </div>

        {/* NFC-e table */}
        <div className="card-elevated">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Exibindo <span className="font-medium text-foreground">6</span> de{" "}
              <span className="font-medium text-foreground">1.360</span> notas fiscais
            </p>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">
                    NFC-e
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">
                    Chave de Acesso
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">
                    Empresa
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">
                    Valor
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">
                    Status
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">
                    Data/Hora
                  </th>
                  <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {nfceList.map((nfce) => (
                  <tr key={nfce.id} className="table-row-interactive">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <FileText className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground tabular-nums">
                            {nfce.numero}
                          </p>
                          <p className="text-xs text-muted-foreground">Série {nfce.serie}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm font-mono text-muted-foreground" title={nfce.chave}>
                        {truncateChave(nfce.chave)}
                      </p>
                      {nfce.protocolo && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Prot: {nfce.protocolo}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div>
                        <p className="text-sm font-medium text-foreground">{nfce.empresa}</p>
                        <p className="text-xs text-muted-foreground">{nfce.cnpj}</p>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm font-semibold text-foreground tabular-nums">
                        {formatCurrency(nfce.valor)}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <div>
                        <span className={cn("status-badge", statusStyles[nfce.status])}>
                          {statusLabels[nfce.status]}
                        </span>
                        {nfce.motivoRejeicao && (
                          <p className="text-xs text-destructive mt-1 max-w-[150px] truncate" title={nfce.motivoRejeicao}>
                            {nfce.motivoRejeicao}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm text-muted-foreground tabular-nums">
                        {formatDate(nfce.dataEmissao)}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Eye className="h-4 w-4 mr-2" />
                            Visualizar
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <QrCode className="h-4 w-4 mr-2" />
                            QR Code
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Download className="h-4 w-4 mr-2" />
                            Download XML
                          </DropdownMenuItem>
                          {nfce.status === "rejeitada" && (
                            <DropdownMenuItem>
                              <RefreshCw className="h-4 w-4 mr-2" />
                              Reprocessar
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          {nfce.status === "autorizada" && (
                            <DropdownMenuItem className="text-destructive">
                              <XCircle className="h-4 w-4 mr-2" />
                              Cancelar
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="p-4 border-t border-border flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Página 1 de 227
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled>
                Anterior
              </Button>
              <Button variant="outline" size="sm">
                Próxima
              </Button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
