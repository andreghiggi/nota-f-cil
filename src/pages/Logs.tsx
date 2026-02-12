import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Search, 
  Download,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  Clock,
  Inbox
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Tables } from "@/integrations/supabase/types";

const tipoConfig: Record<string, { icon: typeof Info; color: string; bgColor: string }> = {
  info: { icon: Info, color: "text-info", bgColor: "bg-info/10" },
  sucesso: { icon: CheckCircle2, color: "text-success", bgColor: "bg-success/10" },
  warning: { icon: AlertTriangle, color: "text-warning", bgColor: "bg-warning/10" },
  erro: { icon: XCircle, color: "text-destructive", bgColor: "bg-destructive/10" },
};

const categoriaLabels: Record<string, string> = {
  nfce: "NFC-e",
  certificado: "Certificado",
  api: "API",
  sistema: "Sistema",
};

export default function Logs() {
  const [tipoFilter, setTipoFilter] = useState("todos");
  const [categoriaFilter, setCategoriaFilter] = useState("todas");
  const [search, setSearch] = useState("");

  const { data: logs = [], isLoading, refetch } = useQuery({
    queryKey: ["logs-fiscais", tipoFilter, categoriaFilter, search],
    queryFn: async () => {
      let query = supabase
        .from("logs_fiscais")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (tipoFilter !== "todos") {
        query = query.eq("tipo", tipoFilter);
      }
      if (categoriaFilter !== "todas") {
        query = query.eq("categoria", categoriaFilter);
      }
      if (search.trim()) {
        query = query.ilike("mensagem", `%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Tables<"logs_fiscais">[];
    },
  });

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleString("pt-BR", {
      day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit",
    });

  return (
    <AppLayout title="Logs" subtitle="Histórico de eventos e atividades do sistema">
      <div className="space-y-6 animate-fade-in">
        {/* Filters */}
        <div className="card-elevated p-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium text-foreground mb-1.5 block">Buscar</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar em logs..."
                  className="pl-9 input-focus-ring"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="w-40">
              <label className="text-sm font-medium text-foreground mb-1.5 block">Tipo</label>
              <Select value={tipoFilter} onValueChange={setTipoFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="sucesso">Sucesso</SelectItem>
                  <SelectItem value="warning">Alerta</SelectItem>
                  <SelectItem value="erro">Erro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-40">
              <label className="text-sm font-medium text-foreground mb-1.5 block">Categoria</label>
              <Select value={categoriaFilter} onValueChange={setCategoriaFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  <SelectItem value="nfce">NFC-e</SelectItem>
                  <SelectItem value="certificado">Certificado</SelectItem>
                  <SelectItem value="api">API</SelectItem>
                  <SelectItem value="sistema">Sistema</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={() => refetch()}>
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
              <span className="text-sm text-muted-foreground">Logs do sistema</span>
            </div>
            <span className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{logs.length}</span> eventos
            </span>
          </div>

          {isLoading ? (
            <div className="p-12 text-center text-muted-foreground">Carregando...</div>
          ) : logs.length === 0 ? (
            <div className="p-12 flex flex-col items-center gap-3 text-center">
              <Inbox className="h-12 w-12 text-muted-foreground/40" />
              <div>
                <p className="text-sm font-medium text-foreground">Nenhum log encontrado</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Os logs aparecerão aqui conforme as operações forem realizadas via API.
                </p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {logs.map((log) => {
                const config = tipoConfig[log.tipo] || tipoConfig.info;
                const Icon = config.icon;

                return (
                  <div key={log.id} className="p-4 hover:bg-muted/30 transition-colors">
                    <div className="flex gap-3">
                      <div className={cn("h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0", config.bgColor)}>
                        <Icon className={cn("h-4 w-4", config.color)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4 mb-1">
                          <p className="text-sm font-medium text-foreground">{log.mensagem}</p>
                          <span className="text-xs text-muted-foreground whitespace-nowrap tabular-nums">
                            {formatDate(log.created_at)}
                          </span>
                        </div>
                        {log.detalhes && (
                          <p className="text-sm text-muted-foreground mb-2">
                            {typeof log.detalhes === "object" ? JSON.stringify(log.detalhes) : String(log.detalhes)}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-2">
                          <span className="px-2 py-0.5 bg-secondary text-secondary-foreground text-xs font-medium rounded">
                            {categoriaLabels[log.categoria] || log.categoria}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
