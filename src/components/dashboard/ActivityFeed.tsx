import { CheckCircle2, XCircle, AlertCircle, Clock, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface Activity {
  id: string;
  type: "success" | "error" | "warning" | "info" | "pending";
  title: string;
  description: string;
  time: string;
}

const activities: Activity[] = [
  {
    id: "1",
    type: "success",
    title: "NFC-e 000125 autorizada",
    description: "Loja Centro Ltda - R$ 259,90",
    time: "2 min atrás",
  },
  {
    id: "2",
    type: "success",
    title: "NFC-e 000124 autorizada",
    description: "Supermercado ABC - R$ 1.847,50",
    time: "6 min atrás",
  },
  {
    id: "3",
    type: "error",
    title: "NFC-e 000123 rejeitada",
    description: "Farmácia Popular - CFOP inválido",
    time: "19 min atrás",
  },
  {
    id: "4",
    type: "pending",
    title: "NFC-e 000122 em processamento",
    description: "Loja Centro Ltda - Aguardando SEFAZ",
    time: "24 min atrás",
  },
  {
    id: "5",
    type: "warning",
    title: "Certificado expira em 30 dias",
    description: "Padaria do Zé - Ação necessária",
    time: "1 hora atrás",
  },
  {
    id: "6",
    type: "info",
    title: "Reprocessamento solicitado",
    description: "NFC-e 000120 enviada novamente",
    time: "2 horas atrás",
  },
];

const iconMap = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertCircle,
  info: RefreshCw,
  pending: Clock,
};

const colorMap = {
  success: "text-success bg-success/10",
  error: "text-destructive bg-destructive/10",
  warning: "text-warning bg-warning/10",
  info: "text-info bg-info/10",
  pending: "text-muted-foreground bg-muted",
};

export function ActivityFeed() {
  return (
    <div className="card-elevated p-5">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-foreground">Atividade Recente</h3>
        <p className="text-sm text-muted-foreground">Eventos do sistema em tempo real</p>
      </div>

      <div className="space-y-4">
        {activities.map((activity) => {
          const Icon = iconMap[activity.type];
          return (
            <div key={activity.id} className="flex gap-3 animate-fade-in">
              <div className={cn("h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0", colorMap[activity.type])}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{activity.title}</p>
                <p className="text-xs text-muted-foreground truncate">{activity.description}</p>
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">{activity.time}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
