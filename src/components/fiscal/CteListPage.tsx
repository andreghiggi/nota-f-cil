import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search,
  MoreHorizontal,
  Download,
  XCircle,
  Inbox,
  PackageCheck,
  FileText,
  RefreshCw,
  Trash2,
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { PeriodFilter, usePeriodoFilter, applyPeriodo } from "@/components/fiscal/PeriodFilter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useEmpresas } from "@/hooks/useSupabaseData";
import { useEnvironment } from "@/contexts/EnvironmentContext";

const statusLabels: Record<string, string> = {
  pendente: "Pendente",
  processando: "Processando",
  autorizada: "Autorizada",
  rejeitada: "Rejeitada",
  cancelada: "Cancelada",
  denegada: "Denegada",
  inutilizada: "Inutilizada",
};

const statusStyles: Record<string, string> = {
  pendente: "status-processando",
  processando: "status-processando",
  autorizada: "status-autorizada",
  rejeitada: "status-rejeitada",
  cancelada: "status-cancelada",
  denegada: "status-rejeitada",
  inutilizada: "status-cancelada",
};

interface CteListPageProps {
  modelo: 57 | 67;
  title: string;
  subtitle: string;
}

export function CteListPage({ modelo, title, subtitle }: CteListPageProps) {
  const [statusFilter, setStatusFilter] = useState("todos");
  const [empresaFilter, setEmpresaFilter] = useState("todas");
  const [search, setSearch] = useState("");
  const periodo = usePeriodoFilter();
  const [cancelTarget, setCancelTarget] = useState<{ id: string; numero: string } | null>(null);
  const [justificativa, setJustificativa] = useState("");
  const [loading, setLoading] = useState(false);

  const queryClient = useQueryClient();
  const { ambiente } = useEnvironment();
  const { data: empresas = [] } = useEmpresas();

  const queryKey = ["cte", modelo, statusFilter, empresaFilter, ambiente, search, periodo.range];

  const { data: lista = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      let query = (supabase as any)
        .from("cte")
        .select("*")
        .eq("modelo", modelo)
        .order("created_at", { ascending: false })
        .limit(50);

      if (statusFilter !== "todos") query = query.eq("status", statusFilter);
      if (empresaFilter !== "todas") query = query.eq("empresa_id", empresaFilter);
      if (ambiente !== "todos") query = query.eq("ambiente", ambiente);
      query = applyPeriodo(query, periodo.range, "data_emissao");
      if (search.trim()) {
        query = query.or(
          `numero.ilike.%${search}%,chave_acesso.ilike.%${search}%,external_id.ilike.%${search}%`,
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      const empresaMap = new Map(empresas.map((e) => [e.id, e]));
      return (data || []).map((c: any) => ({ ...c, empresa: empresaMap.get(c.empresa_id) || null }));
    },
  });

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const formatMoney = (v: number | null) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v || 0));

  const truncateChave = (chave: string) =>
    `${chave.substring(0, 12)}...${chave.substring(chave.length - 8)}`;

  const handleDownloadXml = async (id: string, numero: string) => {
    const { data, error } = await (supabase as any)
      .from("cte")
      .select("xml_envio, xml_retorno")
      .eq("id", id)
      .single();
    if (error || (!data?.xml_envio && !data?.xml_retorno)) {
      toast.error("XML não disponível para este documento");
      return;
    }
    const xml = data.xml_envio || data.xml_retorno || "";
    const blob = new Blob([xml], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cte_${numero}.xml`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("XML baixado com sucesso");
  };

  const handleDacte = async (id: string, numero: string) => {
    toast.loading("Gerando DACTE...", { id: "dacte" });
    try {
      const { data, error } = await supabase.functions.invoke("fiscal-api", {
        body: { action: "dacte_cte", cte_id: id },
      });
      if (error) throw error;
      const pdf = (data as any)?.data?.pdf;
      if (!pdf) throw new Error((data as any)?.error || "PDF não retornado");
      const bytes = Uint8Array.from(atob(pdf), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      toast.success(`DACTE ${numero} gerado`, { id: "dacte" });
    } catch (e: any) {
      toast.error(`Erro ao gerar DACTE: ${e.message}`, { id: "dacte" });
    }
  };

  const handleReprocessar = async (id: string, numero: string) => {
    toast.loading("Reenviando à SEFAZ...", { id: "reproc" });
    try {
      const { data, error } = await supabase.functions.invoke("fiscal-api", {
        body: { action: "emit_cte", cte_id: id },
      });
      if (error) throw error;
      if ((data as any)?.success === false) throw new Error((data as any).error);
      toast.success(`Documento ${numero} reprocessado`, { id: "reproc" });
      queryClient.invalidateQueries({ queryKey: ["cte"] });
    } catch (e: any) {
      toast.error(`Erro ao reprocessar: ${e.message}`, { id: "reproc" });
    }
  };

  const handleExcluir = async (id: string, numero: string, status: string) => {
    if (!["pendente", "rejeitada", "denegada"].includes(status)) {
      toast.error("Só é possível excluir documentos não autorizados");
      return;
    }
    if (!confirm(`Excluir CT-e ${numero}?`)) return;
    const { error } = await (supabase as any).from("cte").delete().eq("id", id);
    if (error) {
      toast.error(`Erro ao excluir: ${error.message}`);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["cte"] });
    toast.success(`CT-e ${numero} excluído`);
  };

  const handleCancelar = async () => {
    if (!cancelTarget) return;
    if (justificativa.trim().length < 15) {
      toast.error("Justificativa deve ter pelo menos 15 caracteres");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("fiscal-api", {
        body: { action: "cancel_cte", cte_id: cancelTarget.id, justificativa },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`CT-e ${cancelTarget.numero} cancelado`);
      queryClient.invalidateQueries({ queryKey: ["cte"] });
      setCancelTarget(null);
      setJustificativa("");
    } catch (e: any) {
      toast.error(`Erro ao cancelar: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout title={title} subtitle={subtitle}>
      <div className="space-y-6 animate-fade-in">
        {/* Filtros */}
        <div className="card-elevated p-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium text-foreground mb-1.5 block">Buscar</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Número, chave de acesso, ID externo..."
                  className="pl-9 input-focus-ring"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <PeriodFilter
              preset={periodo.preset}
              setPreset={periodo.setPreset}
              inicio={periodo.inicio}
              setInicio={periodo.setInicio}
              fim={periodo.fim}
              setFim={periodo.setFim}
            />
            <div className="w-56">
              <label className="text-sm font-medium text-foreground mb-1.5 block">Empresa</label>
              <Select value={empresaFilter} onValueChange={setEmpresaFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as empresas</SelectItem>
                  {empresas.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.nome_fantasia || e.razao_social}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-48">
              <label className="text-sm font-medium text-foreground mb-1.5 block">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="processando">Processando</SelectItem>
                  <SelectItem value="autorizada">Autorizada</SelectItem>
                  <SelectItem value="rejeitada">Rejeitada</SelectItem>
                  <SelectItem value="cancelada">Cancelada</SelectItem>
                  <SelectItem value="inutilizada">Inutilizada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Tabela */}
        <div className="card-elevated">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Exibindo <span className="font-medium text-foreground">{lista.length}</span> documentos
            </p>
          </div>

          {isLoading ? (
            <div className="p-12 text-center text-muted-foreground">Carregando...</div>
          ) : lista.length === 0 ? (
            <div className="p-12 flex flex-col items-center gap-3 text-center">
              <Inbox className="h-12 w-12 text-muted-foreground/40" />
              <div>
                <p className="text-sm font-medium text-foreground">Nenhum documento encontrado</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Os conhecimentos aparecerão aqui conforme forem emitidos via API.
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">
                      Documento
                    </th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">
                      Chave / Protocolo
                    </th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">
                      Empresa
                    </th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">
                      Percurso
                    </th>
                    <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">
                      Valor
                    </th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">
                      Status
                    </th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">
                      Emissão
                    </th>
                    <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {lista.map((c: any) => (
                    <tr key={c.id} className="table-row-interactive">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <PackageCheck className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-foreground tabular-nums">
                              {c.numero}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Série {c.serie} · Modelo {c.modelo}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        {c.chave_acesso ? (
                          <p className="text-sm font-mono text-muted-foreground" title={c.chave_acesso}>
                            {truncateChave(c.chave_acesso)}
                          </p>
                        ) : (
                          <p className="text-sm text-muted-foreground">—</p>
                        )}
                        {c.protocolo && (
                          <p className="text-xs text-muted-foreground mt-0.5">Prot: {c.protocolo}</p>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-sm font-medium text-foreground">
                          {c.empresa?.nome_fantasia || c.empresa?.razao_social || "—"}
                        </p>
                        <p className="text-xs text-muted-foreground">{c.empresa?.cnpj || "—"}</p>
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-sm font-medium text-foreground">
                          {c.uf_ini} → {c.uf_fim}
                        </p>
                        <p className="text-xs text-muted-foreground truncate max-w-[160px]">
                          {c.tomador_nome || c.destinatario_nome || "—"}
                        </p>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <p className="text-sm font-medium text-foreground tabular-nums">
                          {formatMoney(c.valor_total)}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <span className={cn("status-badge", statusStyles[c.status] || "")}>
                          {statusLabels[c.status] || c.status}
                        </span>
                        {c.motivo_retorno && c.status === "rejeitada" && (
                          <p
                            className="text-xs text-destructive mt-1 max-w-[180px] truncate"
                            title={c.motivo_retorno}
                          >
                            {c.motivo_retorno}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-sm text-muted-foreground tabular-nums">
                          {formatDate(c.data_emissao)}
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
                            <DropdownMenuItem onSelect={() => handleDownloadXml(c.id, c.numero)}>
                              <Download className="h-4 w-4 mr-2" />
                              Baixar XML
                            </DropdownMenuItem>
                            {c.status === "autorizada" && (
                              <DropdownMenuItem onSelect={() => handleDacte(c.id, c.numero)}>
                                <FileText className="h-4 w-4 mr-2" />
                                Imprimir DACTE
                              </DropdownMenuItem>
                            )}
                            {["pendente", "rejeitada", "processando"].includes(c.status) && (
                              <DropdownMenuItem onSelect={() => handleReprocessar(c.id, c.numero)}>
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Reenviar à SEFAZ
                              </DropdownMenuItem>
                            )}
                            {c.status === "autorizada" && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onSelect={() =>
                                    setTimeout(
                                      () => setCancelTarget({ id: c.id, numero: c.numero }),
                                      0,
                                    )
                                  }
                                >
                                  <XCircle className="h-4 w-4 mr-2" />
                                  Cancelar
                                </DropdownMenuItem>
                              </>
                            )}
                            {["pendente", "rejeitada", "denegada"].includes(c.status) && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onSelect={() => handleExcluir(c.id, c.numero, c.status)}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Excluir
                                </DropdownMenuItem>
                              </>
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
      </div>

      <AlertDialog
        open={!!cancelTarget}
        onOpenChange={(open) => {
          if (!open) {
            setCancelTarget(null);
            setJustificativa("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar CT-e {cancelTarget?.numero}</AlertDialogTitle>
            <AlertDialogDescription>
              O cancelamento é definitivo e será registrado na SEFAZ.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="justificativa-cte">Justificativa (mínimo 15 caracteres)</Label>
            <Textarea
              id="justificativa-cte"
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              placeholder="Descreva o motivo do cancelamento"
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleCancelar();
              }}
              disabled={loading}
            >
              {loading ? "Cancelando..." : "Confirmar cancelamento"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
