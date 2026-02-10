import { CheckCircle2, XCircle, AlertCircle, Clock, RefreshCw, Loader2, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLogsFiscais } from "@/hooks/useSupabaseData";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const iconMap: Record<string, typeof CheckCircle2> = {
  info: RefreshCw,
  erro: XCircle,
  warning: AlertCircle,
  sucesso: CheckCircle2,
};

const colorMap: Record<string, string> = {
  info: "text-info bg-info/10",
  erro: "text-destructive bg-destructive/10",
  warning: "text-warning bg-warning/10",
  sucesso: "text-success bg-success/10",
};

export function ActivityFeed() {
  const { data: logs, isLoading } = useLogsFiscais({ limit: 10 });

  return (
    <div className="card-elevated p-5">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-foreground">Atividade Recente</h3>
        <p className="text-sm text-muted-foreground">Eventos do sistema em tempo real</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : !logs || logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Inbox className="h-8 w-8 text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">Nenhuma atividade registrada</p>
          <p className="text-xs text-muted-foreground mt-1">
            As atividades aparecerão aqui quando NFC-e forem emitidas via API
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {logs.map((log) => {
            const Icon = iconMap[log.tipo] || RefreshCw;
            const color = colorMap[log.tipo] || colorMap.info;
            const timeAgo = formatDistanceToNow(new Date(log.created_at), {
              addSuffix: true,
              locale: ptBR,
            });
            
            return (
              <div key={log.id} className="flex gap-3 animate-fade-in">
                <div className={cn("h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0", color)}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{log.mensagem}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {log.categoria}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">{timeAgo}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
