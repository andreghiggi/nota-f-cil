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
  Truck,
  CheckCircle2,
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
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { useEmpresas } from "@/hooks/useSupabaseData";
import { useEnvironment } from "@/contexts/EnvironmentContext";

const statusLabels: Record<string, string> = {
  pendente: "Pendente",
  autorizada: "Autorizada",
  rejeitada: "Rejeitada",
  processando: "Processando",
  cancelada: "Cancelada",
  denegada: "Denegada",
  contingencia: "Contingência",
  encerrada: "Encerrada",
};

const statusStyles: Record<string, string> = {
  pendente: "status-processando",
  autorizada: "status-autorizada",
  rejeitada: "status-rejeitada",
  processando: "status-processando",
  cancelada: "status-cancelada",
  denegada: "status-rejeitada",
  contingencia: "status-processando",
  encerrada: "status-autorizada",
};

type MdfeWithEmpresa = Tables<"mdfe"> & {
  empresa?: Pick<Tables<"empresas">, "razao_social" | "nome_fantasia" | "cnpj"> | null;
};

export default function MDFe() {
  const [statusFilter, setStatusFilter] = useState("todos");
  const [empresaFilter, setEmpresaFilter] = useState("todas");
  const [search, setSearch] = useState("");
  const [actionMdfe, setActionMdfe] = useState<{ id: string; numero: string; action: "encerrar" | "cancelar" } | null>(null);
  const [justificativa, setJustificativa] = useState("");
  const [loading, setLoading] = useState(false);

  const queryClient = useQueryClient();
  const { ambiente } = useEnvironment();
  const { data: empresas = [] } = useEmpresas();

  const { data: mdfeList = [], isLoading } = useQuery({
    queryKey: ["mdfe", statusFilter, empresaFilter, ambiente, search],
    queryFn: async () => {
      let query = supabase
        .from("mdfe")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (statusFilter !== "todos") {
        query = query.eq("status", statusFilter as Tables<"mdfe">["status"]);
      }
      if (empresaFilter !== "todas") {
        query = query.eq("empresa_id", empresaFilter);
      }
      if (ambiente !== "todos") {
        query = query.eq("ambiente", ambiente);
      }
      if (search.trim()) {
        query = query.or(`numero.ilike.%${search}%,chave_acesso.ilike.%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      const empresaMap = new Map(empresas.map((e) => [e.id, e]));
      return (data || []).map((m) => ({
        ...m,
        empresa: empresaMap.get(m.empresa_id) || null,
      })) as MdfeWithEmpresa[];
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

  const truncateChave = (chave: string) =>
    `${chave.substring(0, 12)}...${chave.substring(chave.length - 8)}`;

  const handleDownloadXml = async (mdfeId: string, numero: string) => {
    const { data, error } = await supabase
      .from("mdfe")
      .select("xml_envio, xml_retorno")
      .eq("id", mdfeId)
      .single();
    if (error || (!data?.xml_envio && !data?.xml_retorno)) {
      toast.error("XML não disponível para este MDF-e");
      return;
    }
    const xml = data.xml_retorno || data.xml_envio || "";
    const blob = new Blob([xml], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mdfe_${numero}.xml`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("XML baixado com sucesso");
  };

  const handleExcluir = async (mdfeId: string, numero: string, status: string) => {
    if (!["pendente", "rejeitada", "denegada"].includes(status)) {
      toast.error("Só é possível excluir manifestos não autorizados");
      return;
    }
    if (!confirm(`Excluir MDF-e ${numero}? Se este for o último número emitido da série, a numeração será devolvida.`)) return;
    const { data, error } = await supabase.rpc("excluir_documento_nao_processado" as any, { p_tipo: "mdfe", p_id: mdfeId });
    if (error) { toast.error(`Erro ao excluir: ${error.message}`); return; }
    queryClient.invalidateQueries({ queryKey: ["mdfe"] });
    const devolvida = (data as any)?.numeracao_devolvida;
    toast.success(`MDF-e ${numero} excluído${devolvida ? " (numeração devolvida)" : ""}`);
  };

  const handleAction = async () => {
    if (!actionMdfe) return;
    if (actionMdfe.action === "cancelar" && justificativa.trim().length < 15) {
      toast.error("Justificativa deve ter pelo menos 15 caracteres");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("fiscal-api", {
        body: {
          action: actionMdfe.action === "encerrar" ? "encerrar_mdfe" : "cancel_mdfe",
          mdfe_id: actionMdfe.id,
          ...(actionMdfe.action === "cancelar" ? { justificativa } : {}),
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

      toast.success(
        actionMdfe.action === "encerrar"
          ? `MDF-e ${actionMdfe.numero} encerrado com sucesso`
          : `MDF-e ${actionMdfe.numero} cancelado com sucesso`,
      );
      queryClient.invalidateQueries({ queryKey: ["mdfe"] });
      setActionMdfe(null);
      setJustificativa("");
    } catch (e: any) {
      toast.error(`Erro ao ${actionMdfe.action}: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout
      title="MDF-e"
      subtitle="Manifesto Eletrônico de Documentos Fiscais (modelo 58 - rodoviário)"
    >
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
                  placeholder="Número, chave de acesso..."
                  className="pl-9 input-focus-ring"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="w-56">
              <label className="text-sm font-medium text-foreground mb-1.5 block">
                Empresa
              </label>
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
              <label className="text-sm font-medium text-foreground mb-1.5 block">
                Status
              </label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="autorizada">Autorizada</SelectItem>
                  <SelectItem value="rejeitada">Rejeitada</SelectItem>
                  <SelectItem value="processando">Processando</SelectItem>
                  <SelectItem value="encerrada">Encerrada</SelectItem>
                  <SelectItem value="cancelada">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="card-elevated">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Exibindo{" "}
              <span className="font-medium text-foreground">{mdfeList.length}</span>{" "}
              manifestos
            </p>
          </div>

          {isLoading ? (
            <div className="p-12 text-center text-muted-foreground">Carregando...</div>
          ) : mdfeList.length === 0 ? (
            <div className="p-12 flex flex-col items-center gap-3 text-center">
              <Inbox className="h-12 w-12 text-muted-foreground/40" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  Nenhum MDF-e encontrado
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Os manifestos aparecerão aqui conforme forem emitidos via API.
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">
                      MDF-e
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
                  {mdfeList.map((m) => (
                    <tr key={m.id} className="table-row-interactive">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Truck className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-foreground tabular-nums">
                              {m.numero}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Série {m.serie} · Modal {m.modal}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        {m.chave_acesso ? (
                          <p
                            className="text-sm font-mono text-muted-foreground"
                            title={m.chave_acesso}
                          >
                            {truncateChave(m.chave_acesso)}
                          </p>
                        ) : (
                          <p className="text-sm text-muted-foreground">—</p>
                        )}
                        {m.protocolo && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Prot: {m.protocolo}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {m.empresa?.nome_fantasia || m.empresa?.razao_social || "—"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {m.empresa?.cnpj || "—"}
                          </p>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-sm font-medium text-foreground">
                          {m.uf_ini} → {m.uf_fim}
                        </p>
                        {m.placa && (
                          <p className="text-xs text-muted-foreground">
                            Placa {m.placa}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div>
                          <span
                            className={cn(
                              "status-badge",
                              statusStyles[m.status] || "",
                            )}
                          >
                            {statusLabels[m.status] || m.status}
                          </span>
                          {m.motivo_retorno && (
                            <p
                              className="text-xs text-destructive mt-1 max-w-[180px] truncate"
                              title={m.motivo_retorno}
                            >
                              {m.motivo_retorno}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-sm text-muted-foreground tabular-nums">
                          {formatDate(m.data_emissao)}
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
                            <DropdownMenuItem
                              onSelect={() => handleDownloadXml(m.id, m.numero)}
                            >
                              <Download className="h-4 w-4 mr-2" />
                              Download XML
                            </DropdownMenuItem>
                            {m.status === "autorizada" && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onSelect={() =>
                                    setTimeout(
                                      () =>
                                        setActionMdfe({
                                          id: m.id,
                                          numero: m.numero,
                                          action: "encerrar",
                                        }),
                                      0,
                                    )
                                  }
                                >
                                  <CheckCircle2 className="h-4 w-4 mr-2" />
                                  Encerrar
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onSelect={() =>
                                    setTimeout(
                                      () =>
                                        setActionMdfe({
                                          id: m.id,
                                          numero: m.numero,
                                          action: "cancelar",
                                        }),
                                      0,
                                    )
                                  }
                                >
                                  <XCircle className="h-4 w-4 mr-2" />
                                  Cancelar
                                </DropdownMenuItem>
                              </>
                            )}
                            {["pendente", "rejeitada", "denegada"].includes(m.status) && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onSelect={() => handleExcluir(m.id, m.numero, m.status)}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Excluir (devolve numeração)
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

        <AlertDialog
          open={!!actionMdfe}
          onOpenChange={(open) => {
            if (!open) {
              setActionMdfe(null);
              setJustificativa("");
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {actionMdfe?.action === "encerrar"
                  ? `Encerrar MDF-e ${actionMdfe?.numero}`
                  : `Cancelar MDF-e ${actionMdfe?.numero}`}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {actionMdfe?.action === "encerrar"
                  ? "O encerramento informa à SEFAZ que o transporte foi finalizado. Esta ação não pode ser desfeita."
                  : "O cancelamento só é possível em até 24 horas após a autorização e antes de qualquer transporte iniciado."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            {actionMdfe?.action === "cancelar" && (
              <div className="space-y-2">
                <Label htmlFor="just">Justificativa (mínimo 15 caracteres)</Label>
                <Textarea
                  id="just"
                  value={justificativa}
                  onChange={(e) => setJustificativa(e.target.value)}
                  rows={3}
                  placeholder="Informe o motivo do cancelamento..."
                />
              </div>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  handleAction();
                }}
                disabled={loading}
                className={
                  actionMdfe?.action === "cancelar"
                    ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    : ""
                }
              >
                {loading ? "Processando..." : "Confirmar"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}
