import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Search,
  MoreHorizontal,
  Download,
  XCircle,
  Inbox,
  FileSignature,
  RefreshCw,
  FileText,
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
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { PeriodFilter, usePeriodoFilter, applyPeriodo } from "@/components/fiscal/PeriodFilter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Tables } from "@/integrations/supabase/types";
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
};

const statusStyles: Record<string, string> = {
  pendente: "status-processando",
  processando: "status-processando",
  autorizada: "status-autorizada",
  rejeitada: "status-rejeitada",
  cancelada: "status-cancelada",
  denegada: "status-rejeitada",
};

type NfseRow = Tables<"nfse">;

export default function NFSe() {
  const [statusFilter, setStatusFilter] = useState("todos");
  const [empresaFilter, setEmpresaFilter] = useState("todas");
  const [search, setSearch] = useState("");
  const periodo = usePeriodoFilter();
  const [cancelTarget, setCancelTarget] = useState<NfseRow | null>(null);
  const [justificativa, setJustificativa] = useState("");
  const [loading, setLoading] = useState(false);

  const queryClient = useQueryClient();
  const { ambiente } = useEnvironment();
  const { data: empresas = [] } = useEmpresas();

  const { data: lista = [], isLoading } = useQuery({
    queryKey: ["nfse", statusFilter, empresaFilter, ambiente, search, periodo.range],
    queryFn: async () => {
      let query = supabase
        .from("nfse")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (statusFilter !== "todos") query = query.eq("status", statusFilter as NfseRow["status"]);
      if (empresaFilter !== "todas") query = query.eq("empresa_id", empresaFilter);
      if (ambiente !== "todos") query = query.eq("ambiente", ambiente);
      query = applyPeriodo(query, periodo.range, "data_emissao");

      if (search.trim()) {
        query = query.or(
          `tomador_nome.ilike.%${search}%,tomador_documento.ilike.%${search}%,chave_acesso.ilike.%${search}%,external_id.ilike.%${search}%`,
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as NfseRow[];
    },
  });

  const empresaNome = (id: string) => {
    const e = empresas.find((x) => x.id === id);
    return e?.nome_fantasia || e?.razao_social || "—";
  };

  const formatDate = (v: string) =>
    new Date(v).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const formatMoney = (v: number | null) =>
    (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const invokeFiscal = async (action: string, nfse: NfseRow, extra: Record<string, unknown> = {}) => {
    const { data, error } = await supabase.functions.invoke("fiscal-api", {
      body: { action, nfse_id: nfse.id, ...extra },
    });
    if (error) throw new Error(error.message);
    if (!data?.success) throw new Error(data?.error || "Falha na operação");
    return data.data;
  };

  const handleConsultar = async (nfse: NfseRow) => {
    setLoading(true);
    try {
      await invokeFiscal("consult_nfse", nfse);
      toast.success("Consulta realizada na SEFIN Nacional");
      queryClient.invalidateQueries({ queryKey: ["nfse"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handlePdf = async (nfse: NfseRow) => {
    setLoading(true);
    try {
      const res = await invokeFiscal("danfse_nfse", nfse);
      const bin = Uint8Array.from(atob(res.pdf_base64), (c) => c.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bin], { type: "application/pdf" }));
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) {
      toast.error("DANFSe: " + (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleXml = async (nfse: NfseRow) => {
    setLoading(true);
    try {
      const res = await invokeFiscal("xml_nfse", nfse);
      const url = URL.createObjectURL(new Blob([res.xml], { type: "application/xml" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `${nfse.chave_acesso || `dps-${nfse.numero_dps}`}.xml`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error("XML: " + (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelar = async () => {
    if (!cancelTarget) return;
    if (justificativa.trim().length < 15) {
      toast.error("A justificativa precisa ter ao menos 15 caracteres");
      return;
    }
    setLoading(true);
    try {
      await invokeFiscal("cancel_nfse", cancelTarget, { justificativa: justificativa.trim() });
      toast.success("NFS-e cancelada com sucesso");
      setCancelTarget(null);
      setJustificativa("");
      queryClient.invalidateQueries({ queryKey: ["nfse"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout title="NFS-e" subtitle="Nota Fiscal de Serviço Eletrônica — Padrão Nacional (SEFIN/ADN)">
      <div className="space-y-4 animate-fade-in">
        <div className="card-elevated p-4 flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por tomador, documento ou chave..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <PeriodFilter preset={periodo.preset} setPreset={periodo.setPreset} inicio={periodo.inicio} setInicio={periodo.setInicio} fim={periodo.fim} setFim={periodo.setFim} />
          <Select value={empresaFilter} onValueChange={setEmpresaFilter}>
            <SelectTrigger className="w-full md:w-60"><SelectValue placeholder="Empresa" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as empresas</SelectItem>
              {empresas.map((e) => (
                <SelectItem key={e.id} value={e.id}>{e.nome_fantasia || e.razao_social}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-44"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              {Object.entries(statusLabels).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="card-elevated overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="text-left font-medium px-4 py-3">DPS / NFS-e</th>
                  <th className="text-left font-medium px-4 py-3">Empresa</th>
                  <th className="text-left font-medium px-4 py-3">Tomador</th>
                  <th className="text-left font-medium px-4 py-3">Emissão</th>
                  <th className="text-right font-medium px-4 py-3">Valor</th>
                  <th className="text-left font-medium px-4 py-3">Status</th>
                  <th className="w-12" />
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">Carregando...</td></tr>
                )}
                {!isLoading && lista.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center">
                      <Inbox className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-muted-foreground">Nenhuma NFS-e encontrada</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        As NFS-e emitidas pelo ERP via API aparecem aqui.
                      </p>
                    </td>
                  </tr>
                )}
                {lista.map((n) => (
                  <tr key={n.id} className="border-t border-border hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="font-medium">
                        {n.numero_nfse ? `NFS-e ${n.numero_nfse}` : `DPS ${n.numero_dps}`}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Série {n.serie}{n.chave_acesso ? ` · ${n.chave_acesso.substring(0, 14)}...` : ""}
                      </div>
                    </td>
                    <td className="px-4 py-3">{empresaNome(n.empresa_id)}</td>
                    <td className="px-4 py-3">
                      <div>{n.tomador_nome || "—"}</div>
                      <div className="text-xs text-muted-foreground">{n.tomador_documento}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatDate(n.data_emissao)}</td>
                    <td className="px-4 py-3 text-right font-medium">{formatMoney(n.valor_servicos)}</td>
                    <td className="px-4 py-3">
                      <span className={cn("status-badge", statusStyles[n.status])}>
                        {statusLabels[n.status] || n.status}
                      </span>
                      {n.motivo_retorno && n.status === "rejeitada" && (
                        <div className="text-xs text-destructive mt-1 max-w-xs truncate" title={n.motivo_retorno}>
                          {n.motivo_retorno}
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" disabled={loading}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-popover z-50">
                          <DropdownMenuItem onClick={() => handlePdf(n)}>
                            <FileText className="h-4 w-4 mr-2" /> DANFSe (PDF)
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleXml(n)}>
                            <Download className="h-4 w-4 mr-2" /> Baixar XML
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleConsultar(n)}>
                            <RefreshCw className="h-4 w-4 mr-2" /> Consultar SEFIN
                          </DropdownMenuItem>
                          {n.status === "autorizada" && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => { setCancelTarget(n); setJustificativa(""); }}
                              >
                                <XCircle className="h-4 w-4 mr-2" /> Cancelar NFS-e
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
        </div>

        <p className="text-xs text-muted-foreground flex items-center gap-2">
          <FileSignature className="h-3.5 w-3.5" />
          A emissão de NFS-e é feita pelo ERP via <code>POST /nfse-api</code>. Habilite a NFS-e e informe a
          Inscrição Municipal no cadastro da empresa.
        </p>
      </div>

      <AlertDialog open={!!cancelTarget} onOpenChange={(o) => !o && setCancelTarget(null)}>
        <AlertDialogContent className="bg-background">
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar NFS-e</AlertDialogTitle>
            <AlertDialogDescription>
              O cancelamento é enviado ao Ambiente de Dados Nacional e não pode ser desfeito.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label>Justificativa (mín. 15 caracteres)</Label>
            <Textarea
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              placeholder="Descreva o motivo do cancelamento"
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); handleCancelar(); }} disabled={loading}>
              Confirmar cancelamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
