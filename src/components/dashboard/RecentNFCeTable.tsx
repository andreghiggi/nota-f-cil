import { Eye, Download, XCircle, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface NFCe {
  id: string;
  numero: string;
  serie: string;
  empresa: string;
  cnpj: string;
  valor: number;
  status: "autorizada" | "rejeitada" | "processando" | "cancelada";
  dataEmissao: string;
}

const mockNFCe: NFCe[] = [
  {
    id: "1",
    numero: "000125",
    serie: "001",
    empresa: "Loja Centro Ltda",
    cnpj: "12.345.678/0001-90",
    valor: 259.90,
    status: "autorizada",
    dataEmissao: "2024-01-15 14:32:00",
  },
  {
    id: "2",
    numero: "000124",
    serie: "001",
    empresa: "Supermercado ABC",
    cnpj: "98.765.432/0001-10",
    valor: 1847.50,
    status: "autorizada",
    dataEmissao: "2024-01-15 14:28:00",
  },
  {
    id: "3",
    numero: "000123",
    serie: "001",
    empresa: "Farmácia Popular",
    cnpj: "11.222.333/0001-44",
    valor: 89.90,
    status: "rejeitada",
    dataEmissao: "2024-01-15 14:15:00",
  },
  {
    id: "4",
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
    numero: "000121",
    serie: "001",
    empresa: "Padaria do Zé",
    cnpj: "55.666.777/0001-88",
    valor: 35.50,
    status: "cancelada",
    dataEmissao: "2024-01-15 13:55:00",
  },
];

const statusLabels = {
  autorizada: "Autorizada",
  rejeitada: "Rejeitada",
  processando: "Processando",
  cancelada: "Cancelada",
};

export function RecentNFCeTable() {
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

  return (
    <div className="card-elevated">
      <div className="p-5 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-foreground">NFC-e Recentes</h3>
            <p className="text-sm text-muted-foreground">Últimas notas fiscais emitidas</p>
          </div>
          <Button variant="outline" size="sm">
            Ver todas
          </Button>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">
                NFC-e
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
            {mockNFCe.map((nfce) => (
              <tr key={nfce.id} className="table-row-interactive">
                <td className="px-5 py-4">
                  <div>
                    <p className="text-sm font-medium text-foreground tabular-nums">
                      {nfce.numero}
                    </p>
                    <p className="text-xs text-muted-foreground">Série {nfce.serie}</p>
                  </div>
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
                  <span className={cn("status-badge", `status-${nfce.status}`)}>
                    {statusLabels[nfce.status]}
                  </span>
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
                        <Download className="h-4 w-4 mr-2" />
                        Download XML
                      </DropdownMenuItem>
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
    </div>
  );
}
