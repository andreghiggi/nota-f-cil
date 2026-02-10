import { Eye, Download, XCircle, MoreHorizontal, Loader2, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useNFCeList } from "@/hooks/useSupabaseData";
import { useNavigate } from "react-router-dom";

const statusLabels: Record<string, string> = {
  autorizada: "Autorizada",
  rejeitada: "Rejeitada",
  processando: "Processando",
  cancelada: "Cancelada",
  pendente: "Pendente",
  denegada: "Denegada",
  contingencia: "Contingência",
};

export function RecentNFCeTable() {
  const { data: nfceList, isLoading } = useNFCeList({ limit: 10 });
  const navigate = useNavigate();

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
          <Button variant="outline" size="sm" onClick={() => navigate("/nfce")}>
            Ver todas
          </Button>
        </div>
      </div>
      
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : !nfceList || nfceList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Inbox className="h-10 w-10 text-muted-foreground/50 mb-3" />
          <p className="text-sm font-medium text-foreground">Nenhuma NFC-e emitida</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
            As NFC-e aparecerão aqui quando forem enviadas via API. 
            Crie um token API e configure seu ERP para começar.
          </p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate("/tokens")}>
            Criar Token API
          </Button>
        </div>
      ) : (
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
              {nfceList.map((nfce: any) => (
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
                      <p className="text-sm font-medium text-foreground">
                        {nfce.empresas?.nome_fantasia || "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">{nfce.empresas?.cnpj}</p>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <p className="text-sm font-semibold text-foreground tabular-nums">
                      {formatCurrency(nfce.valor_total)}
                    </p>
                  </td>
                  <td className="px-5 py-4">
                    <span className={cn("status-badge", `status-${nfce.status}`)}>
                      {statusLabels[nfce.status] || nfce.status}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <p className="text-sm text-muted-foreground tabular-nums">
                      {formatDate(nfce.created_at)}
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
      )}
    </div>
  );
}
