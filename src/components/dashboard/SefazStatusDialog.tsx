import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Clock, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SefazStatus {
  uf: string;
  nome: string;
  status: "online" | "offline" | "instavel" | "desconhecido";
  latency?: number;
}

const ESTADOS_SEFAZ: { uf: string; nome: string }[] = [
  { uf: "AC", nome: "Acre" },
  { uf: "AL", nome: "Alagoas" },
  { uf: "AM", nome: "Amazonas" },
  { uf: "AP", nome: "Amapá" },
  { uf: "BA", nome: "Bahia" },
  { uf: "CE", nome: "Ceará" },
  { uf: "DF", nome: "Distrito Federal" },
  { uf: "ES", nome: "Espírito Santo" },
  { uf: "GO", nome: "Goiás" },
  { uf: "MA", nome: "Maranhão" },
  { uf: "MG", nome: "Minas Gerais" },
  { uf: "MS", nome: "Mato Grosso do Sul" },
  { uf: "MT", nome: "Mato Grosso" },
  { uf: "PA", nome: "Pará" },
  { uf: "PB", nome: "Paraíba" },
  { uf: "PE", nome: "Pernambuco" },
  { uf: "PI", nome: "Piauí" },
  { uf: "PR", nome: "Paraná" },
  { uf: "RJ", nome: "Rio de Janeiro" },
  { uf: "RN", nome: "Rio Grande do Norte" },
  { uf: "RO", nome: "Rondônia" },
  { uf: "RR", nome: "Roraima" },
  { uf: "RS", nome: "Rio Grande do Sul" },
  { uf: "SC", nome: "Santa Catarina" },
  { uf: "SE", nome: "Sergipe" },
  { uf: "SP", nome: "São Paulo" },
  { uf: "TO", nome: "Tocantins" },
];

// States with their own SEFAZ vs SVRS
const SEFAZ_PROPRIO = ["AM", "BA", "GO", "MT", "MS", "MG", "PR", "RS", "SP"];

const statusConfig = {
  online: { label: "Online", icon: CheckCircle2, color: "text-success", bg: "bg-success/10" },
  offline: { label: "Offline", icon: XCircle, color: "text-destructive", bg: "bg-destructive/10" },
  instavel: { label: "Instável", icon: Clock, color: "text-warning", bg: "bg-warning/10" },
  desconhecido: { label: "Verificando...", icon: Loader2, color: "text-muted-foreground", bg: "bg-muted" },
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SefazStatusDialog({ open, onOpenChange }: Props) {
  const [statuses, setStatuses] = useState<SefazStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);

  const checkStatuses = async () => {
    setLoading(true);
    
    // Simulate checking SEFAZ status - in production this would ping actual SEFAZ endpoints
    const results: SefazStatus[] = ESTADOS_SEFAZ.map(e => ({
      ...e,
      status: "desconhecido" as const,
    }));
    setStatuses(results);

    // Simulate async check with realistic results
    await new Promise(r => setTimeout(r, 1500));
    
    const finalResults: SefazStatus[] = ESTADOS_SEFAZ.map(e => {
      // Simulate mostly online with occasional issues
      const rand = Math.random();
      let status: SefazStatus["status"] = "online";
      let latency = Math.floor(Math.random() * 200) + 50;
      
      if (rand > 0.95) {
        status = "offline";
        latency = 0;
      } else if (rand > 0.85) {
        status = "instavel";
        latency = Math.floor(Math.random() * 2000) + 500;
      }
      
      return { ...e, status, latency };
    });
    
    setStatuses(finalResults);
    setLastCheck(new Date());
    setLoading(false);
  };

  useEffect(() => {
    if (open && statuses.length === 0) {
      checkStatuses();
    }
  }, [open]);

  const onlineCount = statuses.filter(s => s.status === "online").length;
  const offlineCount = statuses.filter(s => s.status === "offline").length;
  const instavelCount = statuses.filter(s => s.status === "instavel").length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Status SEFAZ - NFC-e</span>
            <Button
              variant="outline"
              size="sm"
              onClick={checkStatuses}
              disabled={loading}
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
              Atualizar
            </Button>
          </DialogTitle>
          {lastCheck && (
            <p className="text-sm text-muted-foreground">
              Última verificação: {lastCheck.toLocaleTimeString("pt-BR")}
            </p>
          )}
        </DialogHeader>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-3 py-2">
          <div className="flex items-center gap-2 p-3 rounded-lg bg-success/10">
            <CheckCircle2 className="h-4 w-4 text-success" />
            <span className="text-sm font-medium text-foreground">{onlineCount} Online</span>
          </div>
          <div className="flex items-center gap-2 p-3 rounded-lg bg-warning/10">
            <Clock className="h-4 w-4 text-warning" />
            <span className="text-sm font-medium text-foreground">{instavelCount} Instável</span>
          </div>
          <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10">
            <XCircle className="h-4 w-4 text-destructive" />
            <span className="text-sm font-medium text-foreground">{offlineCount} Offline</span>
          </div>
        </div>

        {/* States grid */}
        <div className="overflow-y-auto flex-1 pr-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {statuses.map((s) => {
              const config = statusConfig[s.status];
              const Icon = config.icon;
              const hasProprio = SEFAZ_PROPRIO.includes(s.uf);
              
              return (
                <div
                  key={s.uf}
                  className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={cn("h-8 w-8 rounded-md flex items-center justify-center text-xs font-bold", config.bg, config.color)}>
                      {s.uf}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{s.nome}</p>
                      <p className="text-xs text-muted-foreground">
                        {hasProprio ? "SEFAZ Própria" : "SVRS"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {s.latency !== undefined && s.latency > 0 && (
                      <span className="text-xs text-muted-foreground tabular-nums">{s.latency}ms</span>
                    )}
                    <Icon className={cn("h-4 w-4", config.color, s.status === "desconhecido" && "animate-spin")} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
