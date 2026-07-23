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
  Filter,
  Calendar,
  QrCode,
  FileText,
  Inbox,
  Printer,
  Trash2
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
import { useQuery } from "@tanstack/react-query";
import { Tables } from "@/integrations/supabase/types";
import { DANFCeDialog } from "@/components/nfce/DANFCeDialog";
import { QRCodeDialog } from "@/components/nfce/QRCodeDialog";
import { CancelDialog } from "@/components/nfce/CancelDialog";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
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

type NfceWithEmpresa = Tables<"nfce"> & {
  empresas: Pick<Tables<"empresas">, "razao_social" | "cnpj"> | null;
};

export default function NFCe() {
  const [statusFilter, setStatusFilter] = useState("todos");
  const [empresaFilter, setEmpresaFilter] = useState("todas");
  const [search, setSearch] = useState("");
  const [danfceNfceId, setDanfceNfceId] = useState<string | null>(null);
  const [danfceOpen, setDanfceOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrData, setQrData] = useState<{ url: string | null; chave: string | null; numero: string }>({ url: null, chave: null, numero: "" });
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelNfce, setCancelNfce] = useState<{ id: string; numero: string }>({ id: "", numero: "" });
  const [cancelLoading, setCancelLoading] = useState(false);
  const queryClient = useQueryClient();
  const { ambiente } = useEnvironment();
  const { data: empresas = [] } = useEmpresas();

  const { data: nfceList = [], isLoading } = useQuery({
    queryKey: ["nfce", statusFilter, empresaFilter, ambiente, search],
    queryFn: async () => {
      let query = supabase
        .from("nfce")
        .select("*, empresas(razao_social, nome_fantasia, cnpj)")
        .order("created_at", { ascending: false })
        .limit(50);

      if (statusFilter !== "todos") {
        query = query.eq("status", statusFilter as Tables<"nfce">["status"]);
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
      return data as NfceWithEmpresa[];
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

  const handleDownloadXml = async (nfceId: string, numero: string) => {
    const { data, error } = await supabase
      .from("nfce")
      .select("xml_envio, xml_retorno, chave_acesso")
      .eq("id", nfceId)
      .single();
    if (error || (!data?.xml_retorno && !data?.xml_envio)) {
      toast.error("XML não disponível para esta NFC-e");
      return;
    }
    // Prefere o XML autorizado (nfeProc/procNFe). Se não houver, usa o assinado enviado.
    const xml = (data.xml_retorno && data.xml_retorno.trim())
      ? data.xml_retorno
      : (data.xml_envio || "");
    if (!xml.trim()) {
      toast.error("XML vazio para esta NFC-e");
      return;
    }
    const baseName = data.chave_acesso && data.chave_acesso.length >= 44
      ? data.chave_acesso
      : `nfce_${numero}`;
    const blob = new Blob([xml], { type: "application/xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${baseName}.xml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success("XML baixado com sucesso");
  };

  const handleReprocessar = async (nfceId: string, numero: string) => {
    const { error } = await supabase.from("nfce").update({ status: "pendente", tentativas: 0, erro_processamento: null, motivo_retorno: null, codigo_retorno: null }).eq("id", nfceId);
    if (error) { toast.error("Erro ao reprocessar"); return; }
    toast.info(`Reenviando NFC-e ${numero} à SEFAZ...`);
    const { data, error: invokeError } = await supabase.functions.invoke("fiscal-api", {
      body: { action: "emit_nfce", nfce_id: nfceId },
    });
    queryClient.invalidateQueries({ queryKey: ["nfce"] });
    if (invokeError || (data as any)?.error) {
      toast.error(`Falha no reprocessamento: ${invokeError?.message || (data as any)?.error}`);
      return;
    }
    const status = (data as any)?.data?.status || (data as any)?.status;
    if (status === "autorizada") toast.success(`NFC-e ${numero} autorizada`);
    else if (status === "rejeitada") toast.error(`NFC-e ${numero} rejeitada — veja o motivo na lista`);
    else toast.success(`NFC-e ${numero} processada (status: ${status || "pendente"})`);
  };

  const handleExcluir = async (nfceId: string, numero: string, status: string) => {
    if (!["pendente", "rejeitada", "denegada"].includes(status)) {
      toast.error("Só é possível excluir notas não autorizadas");
      return;
    }
    if (!confirm(`Excluir NFC-e ${numero}? Se este for o último número emitido da série, a numeração será devolvida.`)) return;
    const { data, error } = await supabase.rpc("excluir_documento_nao_processado" as any, { p_tipo: "nfce", p_id: nfceId });
    if (error) { toast.error(`Erro ao excluir: ${error.message}`); return; }
    queryClient.invalidateQueries({ queryKey: ["nfce"] });
    const devolvida = (data as any)?.numeracao_devolvida;
    toast.success(`NFC-e ${numero} excluída${devolvida ? " (numeração devolvida)" : ""}`);
  };

  const handleCancelar = async (justificativa: string) => {
    setCancelLoading(true);
    try {
      await supabase.from("nfce_eventos").insert({ nfce_id: cancelNfce.id, tipo_evento: "cancelamento", justificativa });
      await supabase.from("nfce").update({ status: "cancelada" }).eq("id", cancelNfce.id);
      queryClient.invalidateQueries({ queryKey: ["nfce"] });
      toast.success(`NFC-e ${cancelNfce.numero} cancelada com sucesso`);
      setCancelOpen(false);
    } catch {
      toast.error("Erro ao cancelar NFC-e");
    } finally {
      setCancelLoading(false);
    }
  };

  return (
    <AppLayout title="NFC-e" subtitle="Gerenciamento de Notas Fiscais de Consumidor Eletrônicas">
      <div className="space-y-6 animate-fade-in">
        {/* Filters */}
        <div className="card-elevated p-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium text-foreground mb-1.5 block">Buscar</label>
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

        {/* NFC-e table */}
        <div className="card-elevated">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Exibindo <span className="font-medium text-foreground">{nfceList.length}</span> notas fiscais
            </p>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
          </div>

          {isLoading ? (
            <div className="p-12 text-center text-muted-foreground">Carregando...</div>
          ) : nfceList.length === 0 ? (
            <div className="p-12 flex flex-col items-center gap-3 text-center">
              <Inbox className="h-12 w-12 text-muted-foreground/40" />
              <div>
                <p className="text-sm font-medium text-foreground">Nenhuma NFC-e encontrada</p>
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
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">NFC-e</th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">Chave de Acesso</th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">Empresa</th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">Valor</th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">Status</th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">Data/Hora</th>
                    <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {nfceList.map((nfce) => (
                    <tr key={nfce.id} className="table-row-interactive">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <FileText className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-foreground tabular-nums">{nfce.numero}</p>
                            <p className="text-xs text-muted-foreground">Série {nfce.serie}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        {nfce.chave_acesso ? (
                          <p className="text-sm font-mono text-muted-foreground" title={nfce.chave_acesso}>
                            {truncateChave(nfce.chave_acesso)}
                          </p>
                        ) : (
                          <p className="text-sm text-muted-foreground">—</p>
                        )}
                        {nfce.protocolo && (
                          <p className="text-xs text-muted-foreground mt-0.5">Prot: {nfce.protocolo}</p>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div>
                          <p className="text-sm font-medium text-foreground">{nfce.empresas?.razao_social || "—"}</p>
                          <p className="text-xs text-muted-foreground">{nfce.empresas?.cnpj || "—"}</p>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-sm font-semibold text-foreground tabular-nums">
                          {formatCurrency(nfce.valor_total)}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <div>
                          <span className={cn("status-badge", statusStyles[nfce.status] || "")}>
                            {statusLabels[nfce.status] || nfce.status}
                          </span>
                          {nfce.motivo_retorno && (
                            <p className="text-xs text-destructive mt-1 max-w-[150px] truncate" title={nfce.motivo_retorno}>
                              {nfce.motivo_retorno}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-sm text-muted-foreground tabular-nums">
                          {formatDate(nfce.data_emissao)}
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
                            <DropdownMenuItem onSelect={() => { setTimeout(() => { setDanfceNfceId(nfce.id); setDanfceOpen(true); }, 0); }}>
                              <Eye className="h-4 w-4 mr-2" />Visualizar Cupom
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => { setTimeout(() => { setDanfceNfceId(nfce.id); setDanfceOpen(true); }, 0); }}>
                              <Printer className="h-4 w-4 mr-2" />Imprimir DANFE
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => { setTimeout(() => { setQrData({ url: nfce.qrcode_url, chave: nfce.chave_acesso, numero: nfce.numero }); setQrOpen(true); }, 0); }}>
                              <QrCode className="h-4 w-4 mr-2" />QR Code
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => handleDownloadXml(nfce.id, nfce.numero)}>
                              <Download className="h-4 w-4 mr-2" />Download XML
                            </DropdownMenuItem>
                            {(nfce.status === "rejeitada" || nfce.status === "pendente") && (
                              <DropdownMenuItem onSelect={() => handleReprocessar(nfce.id, nfce.numero)}>
                                <RefreshCw className="h-4 w-4 mr-2" />Reprocessar
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            {nfce.status === "autorizada" && (
                              <DropdownMenuItem className="text-destructive" onSelect={() => { setTimeout(() => { setCancelNfce({ id: nfce.id, numero: nfce.numero }); setCancelOpen(true); }, 0); }}>
                                <XCircle className="h-4 w-4 mr-2" />Cancelar
                              </DropdownMenuItem>
                            )}
                            {["pendente", "rejeitada", "denegada"].includes(nfce.status) && (
                              <DropdownMenuItem className="text-destructive" onSelect={() => handleExcluir(nfce.id, nfce.numero, nfce.status)}>
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

        <DANFCeDialog
          open={danfceOpen}
          onOpenChange={setDanfceOpen}
          nfceId={danfceNfceId}
        />

        <QRCodeDialog
          open={qrOpen}
          onOpenChange={setQrOpen}
          qrcodeUrl={qrData.url}
          chaveAcesso={qrData.chave}
          numero={qrData.numero}
        />

        <CancelDialog
          open={cancelOpen}
          onOpenChange={setCancelOpen}
          numero={cancelNfce.numero}
          onConfirm={handleCancelar}
          loading={cancelLoading}
        />
      </div>
    </AppLayout>
  );
}
