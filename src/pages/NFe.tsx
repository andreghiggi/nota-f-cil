import { useState } from "react";
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
  FileText,
  Inbox,
  Printer,
  FileEdit,
  Trash2,
  Ban,
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
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DANFeDialog } from "@/components/nfe/DANFeDialog";
import { CancelNFeDialog } from "@/components/nfe/CancelNFeDialog";
import { CartaCorrecaoDialog } from "@/components/nfe/CartaCorrecaoDialog";
import { InutilizacoesDialog } from "@/components/nfe/InutilizacoesDialog";
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
};

const statusStyles: Record<string, string> = {
  pendente: "status-processando",
  autorizada: "status-autorizada",
  rejeitada: "status-rejeitada",
  processando: "status-processando",
  cancelada: "status-cancelada",
  denegada: "status-rejeitada",
  contingencia: "status-processando",
};

export default function NFe() {
  const [statusFilter, setStatusFilter] = useState("todos");
  const [empresaFilter, setEmpresaFilter] = useState("todas");
  const [search, setSearch] = useState("");
  const [danfeNfeId, setDanfeNfeId] = useState<string | null>(null);
  const [danfeOpen, setDanfeOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelNfe, setCancelNfe] = useState<{ id: string; numero: string }>({ id: "", numero: "" });
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cceOpen, setCceOpen] = useState(false);
  const [cceNfe, setCceNfe] = useState<{ id: string; numero: string }>({ id: "", numero: "" });
  const [inutOpen, setInutOpen] = useState(false);
  const queryClient = useQueryClient();
  const { ambiente } = useEnvironment();
  const { data: empresas = [] } = useEmpresas();

  const { data: nfeList = [], isLoading } = useQuery({
    queryKey: ["nfe", statusFilter, empresaFilter, ambiente, search],
    queryFn: async () => {
      let query = supabase
        .from("nfe")
        .select("*, empresas(razao_social, nome_fantasia, cnpj)")
        .order("created_at", { ascending: false })
        .limit(50);

      if (statusFilter !== "todos") {
        query = query.eq("status", statusFilter as any);
      }

      if (empresaFilter !== "todas") {
        query = query.eq("empresa_id", empresaFilter);
      }

      if (ambiente !== "todos") {
        query = query.eq("ambiente", ambiente);
      }

      if (search.trim()) {
        query = query.or(`numero.ilike.%${search}%,chave_acesso.ilike.%${search}%,dest_nome.ilike.%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as any[];
    },
  });

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleString("pt-BR", {
      day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
    });

  const truncateChave = (chave: string) =>
    `${chave.substring(0, 12)}...${chave.substring(chave.length - 8)}`;

  const handleDownloadXml = async (nfeId: string, numero: string) => {
    const { data, error } = await supabase.from("nfe").select("xml_envio, xml_retorno").eq("id", nfeId).single();
    const xml = data?.xml_retorno || data?.xml_envio;
    if (error || !xml) {
      toast.error("XML não disponível para esta NF-e");
      return;
    }
    const blob = new Blob([xml], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nfe_${numero}.xml`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("XML baixado com sucesso");
  };

  const handleReprocessar = async (nfeId: string, numero: string) => {
    const { error } = await supabase.from("nfe").update({ status: "pendente" as any, tentativas: 0, erro_processamento: null, motivo_retorno: null, codigo_retorno: null }).eq("id", nfeId);
    if (error) { toast.error("Erro ao reprocessar"); return; }
    toast.info(`Reenviando NF-e ${numero} à SEFAZ...`);
    const { data, error: invokeError } = await supabase.functions.invoke("fiscal-api", {
      body: { action: "emit_nfe", nfe_id: nfeId },
    });
    queryClient.invalidateQueries({ queryKey: ["nfe"] });
    if (invokeError || (data as any)?.error) {
      toast.error(`Falha no reprocessamento: ${invokeError?.message || (data as any)?.error}`);
      return;
    }
    const status = (data as any)?.data?.status || (data as any)?.status;
    if (status === "autorizada") toast.success(`NF-e ${numero} autorizada`);
    else if (status === "rejeitada") toast.error(`NF-e ${numero} rejeitada — veja o motivo na lista`);
    else toast.success(`NF-e ${numero} processada (status: ${status || "pendente"})`);
  };

  const handleExcluir = async (nfeId: string, numero: string, status: string) => {
    if (!["pendente", "rejeitada", "denegada"].includes(status)) {
      toast.error("Só é possível excluir notas não autorizadas");
      return;
    }
    if (!confirm(`Excluir NF-e ${numero}? Se este for o último número emitido da série, a numeração será devolvida.`)) return;
    const { data, error } = await supabase.rpc("excluir_documento_nao_processado" as any, { p_tipo: "nfe", p_id: nfeId });
    if (error) { toast.error(`Erro ao excluir: ${error.message}`); return; }
    queryClient.invalidateQueries({ queryKey: ["nfe"] });
    const devolvida = (data as any)?.numeracao_devolvida;
    toast.success(`NF-e ${numero} excluída${devolvida ? " (numeração devolvida)" : ""}`);
  };

  const handleCancelar = async (justificativa: string) => {
    setCancelLoading(true);
    try {
      await supabase.from("nfe_eventos").insert({ nfe_id: cancelNfe.id, tipo_evento: "cancelamento", justificativa } as any);
      await supabase.from("nfe").update({ status: "cancelada" as any }).eq("id", cancelNfe.id);
      queryClient.invalidateQueries({ queryKey: ["nfe"] });
      toast.success(`NF-e ${cancelNfe.numero} cancelada com sucesso`);
      setCancelOpen(false);
    } catch {
      toast.error("Erro ao cancelar NF-e");
    } finally {
      setCancelLoading(false);
    }
  };

  return (
    <AppLayout title="NF-e" subtitle="Gerenciamento de Notas Fiscais Eletrônicas">
      <div className="space-y-6 animate-fade-in">
        {/* Filters */}
        <div className="card-elevated p-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium text-foreground mb-1.5 block">Buscar</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Número, chave de acesso, destinatário..."
                  className="pl-9 input-focus-ring"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="w-56">
              <label className="text-sm font-medium text-foreground mb-1.5 block">Empresa</label>
              <Select value={empresaFilter} onValueChange={setEmpresaFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
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
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="autorizada">Autorizada</SelectItem>
                  <SelectItem value="rejeitada">Rejeitada</SelectItem>
                  <SelectItem value="processando">Processando</SelectItem>
                  <SelectItem value="cancelada">Cancelada</SelectItem>
                  <SelectItem value="denegada">Denegada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* NF-e table */}
        <div className="card-elevated">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Exibindo <span className="font-medium text-foreground">{nfeList.length}</span> notas fiscais
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setInutOpen(true)}>
                <Ban className="h-4 w-4 mr-2" />
                Inutilizações
              </Button>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Exportar
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="p-12 text-center text-muted-foreground">Carregando...</div>
          ) : nfeList.length === 0 ? (
            <div className="p-12 flex flex-col items-center gap-3 text-center">
              <Inbox className="h-12 w-12 text-muted-foreground/40" />
              <div>
                <p className="text-sm font-medium text-foreground">Nenhuma NF-e encontrada</p>
                <p className="text-sm text-muted-foreground mt-1">
                  As notas aparecerão aqui conforme forem recebidas via API.
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                     <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">NF-e</th>
                     <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">Chave de Acesso</th>
                     <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">Destinatário</th>
                     <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">Empresa</th>
                     <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">Valor</th>
                     <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">Ambiente</th>
                     <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">Status</th>
                     <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">Data/Hora</th>
                     <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {nfeList.map((nfe: any) => (
                    <tr key={nfe.id} className="table-row-interactive">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <FileText className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-foreground tabular-nums">{nfe.numero}</p>
                            <p className="text-xs text-muted-foreground">Série {nfe.serie}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        {nfe.chave_acesso ? (
                          <p className="text-sm font-mono text-muted-foreground" title={nfe.chave_acesso}>
                            {truncateChave(nfe.chave_acesso)}
                          </p>
                        ) : (
                          <p className="text-sm text-muted-foreground">—</p>
                        )}
                        {nfe.protocolo && (
                          <p className="text-xs text-muted-foreground mt-0.5">Prot: {nfe.protocolo}</p>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div>
                          <p className="text-sm font-medium text-foreground">{nfe.dest_nome || "—"}</p>
                          <p className="text-xs text-muted-foreground">{nfe.dest_cpf_cnpj || "—"}</p>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div>
                          <p className="text-sm font-medium text-foreground">{nfe.empresas?.razao_social || "—"}</p>
                          <p className="text-xs text-muted-foreground">{nfe.empresas?.cnpj || "—"}</p>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-sm font-semibold text-foreground tabular-nums">
                          {formatCurrency(nfe.valor_total)}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <span className={cn(
                          "inline-flex items-center gap-1.5 text-sm",
                          nfe.ambiente === "producao" ? "text-success" : "text-warning"
                        )}>
                          <span className={cn(
                            "h-2 w-2 rounded-full",
                            nfe.ambiente === "producao" ? "bg-success" : "bg-warning"
                          )} />
                          {nfe.ambiente === "producao" ? "Produção" : "Homologação"}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div>
                          <span className={cn("status-badge", statusStyles[nfe.status] || "")}>
                            {statusLabels[nfe.status] || nfe.status}
                          </span>
                          {nfe.motivo_retorno && (
                            <p className="text-xs text-destructive mt-1 max-w-[150px] truncate" title={nfe.motivo_retorno}>
                              {nfe.motivo_retorno}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-sm text-muted-foreground tabular-nums">
                          {formatDate(nfe.data_emissao)}
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
                            <DropdownMenuItem onSelect={() => { setTimeout(() => { setDanfeNfeId(nfe.id); setDanfeOpen(true); }, 0); }}>
                              <Eye className="h-4 w-4 mr-2" />Visualizar DANFE
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => { setTimeout(() => { setDanfeNfeId(nfe.id); setDanfeOpen(true); }, 0); }}>
                              <Printer className="h-4 w-4 mr-2" />Imprimir DANFE
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => handleDownloadXml(nfe.id, nfe.numero)}>
                              <Download className="h-4 w-4 mr-2" />Download XML
                            </DropdownMenuItem>
                            {(nfe.status === "rejeitada" || nfe.status === "pendente") && (
                              <DropdownMenuItem onSelect={() => handleReprocessar(nfe.id, nfe.numero)}>
                                <RefreshCw className="h-4 w-4 mr-2" />Reprocessar
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            {nfe.status === "autorizada" && (
                              <>
                                <DropdownMenuItem onSelect={() => { setTimeout(() => { setCceNfe({ id: nfe.id, numero: nfe.numero }); setCceOpen(true); }, 0); }}>
                                  <FileEdit className="h-4 w-4 mr-2" />Carta de Correção
                                </DropdownMenuItem>
                                <DropdownMenuItem className="text-destructive" onSelect={() => { setTimeout(() => { setCancelNfe({ id: nfe.id, numero: nfe.numero }); setCancelOpen(true); }, 0); }}>
                                  <XCircle className="h-4 w-4 mr-2" />Cancelar
                                </DropdownMenuItem>
                              </>
                            )}
                            {["pendente", "rejeitada", "denegada"].includes(nfe.status) && (
                              <DropdownMenuItem className="text-destructive" onSelect={() => handleExcluir(nfe.id, nfe.numero, nfe.status)}>
                                <Trash2 className="h-4 w-4 mr-2" />Excluir (devolve numeração)
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

        <DANFeDialog
          open={danfeOpen}
          onOpenChange={setDanfeOpen}
          nfeId={danfeNfeId}
        />

        <CancelNFeDialog
          open={cancelOpen}
          onOpenChange={setCancelOpen}
          numero={cancelNfe.numero}
          onConfirm={handleCancelar}
          loading={cancelLoading}
        />

        <CartaCorrecaoDialog
          open={cceOpen}
          onOpenChange={setCceOpen}
          nfeId={cceNfe.id || null}
          nfeNumero={cceNfe.numero}
        />
      </div>
    </AppLayout>
  );
}
