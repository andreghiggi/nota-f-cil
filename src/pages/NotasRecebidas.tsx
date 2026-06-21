import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  RefreshCw, MoreHorizontal, Download, Inbox, CheckCircle2,
  AlertCircle, XCircle, Eye, FileQuestion,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEmpresas } from "@/hooks/useSupabaseData";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  ciente: "Ciência",
  confirmada: "Confirmada",
  desconhecida: "Desconhecida",
  nao_realizada: "Não realizada",
};
const STATUS_STYLES: Record<string, string> = {
  pendente: "bg-amber-500/10 text-amber-600 border-amber-200",
  ciente: "bg-blue-500/10 text-blue-600 border-blue-200",
  confirmada: "bg-emerald-500/10 text-emerald-600 border-emerald-200",
  desconhecida: "bg-zinc-500/10 text-zinc-600 border-zinc-200",
  nao_realizada: "bg-rose-500/10 text-rose-600 border-rose-200",
};
const SIT_LABEL: Record<string, string> = {
  "1": "Autorizada",
  "2": "Cancelada",
  "3": "Denegada",
};

type DFe = {
  id: string;
  chave_acesso: string;
  nsu: number;
  tipo: string;
  cnpj_emitente?: string;
  nome_emitente?: string;
  numero_nfe?: string;
  serie?: string;
  data_emissao?: string;
  valor_total?: number;
  tp_nf?: number;
  situacao_nfe?: string;
  status_manifestacao: string;
  data_manifestacao?: string;
  created_at: string;
};

function fmtCnpj(v?: string) {
  if (!v) return "";
  const d = v.replace(/\D/g, "");
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  return v;
}
function fmtMoney(v?: number) {
  return (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtDate(v?: string) {
  if (!v) return "—";
  try { return new Date(v).toLocaleString("pt-BR"); } catch { return v; }
}

export default function NotasRecebidas() {
  const { data: empresas } = useEmpresas();
  const qc = useQueryClient();
  const [empresaId, setEmpresaId] = useState<string>("");
  const [filtro, setFiltro] = useState<string>("todos");
  const [syncing, setSyncing] = useState(false);
  const [manifestDlg, setManifestDlg] = useState<{ dfe: DFe; tipo: string } | null>(null);
  const [justificativa, setJustificativa] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const currentEmpresa = empresaId || (empresas?.[0]?.id ?? "");

  const { data: ctrl } = useQuery({
    queryKey: ["dfe-ctrl", currentEmpresa],
    enabled: !!currentEmpresa,
    queryFn: async () => {
      const { data } = await supabase
        .from("dfe_distribuicao_controle")
        .select("*").eq("empresa_id", currentEmpresa).maybeSingle();
      return data;
    },
  });

  const { data: lista, isLoading } = useQuery({
    queryKey: ["dfe-list", currentEmpresa, filtro],
    enabled: !!currentEmpresa,
    queryFn: async () => {
      let q = supabase.from("dfe_recebidas")
        .select("id, chave_acesso, nsu, tipo, cnpj_emitente, nome_emitente, numero_nfe, serie, data_emissao, valor_total, tp_nf, situacao_nfe, status_manifestacao, data_manifestacao, created_at")
        .eq("empresa_id", currentEmpresa)
        .order("data_emissao", { ascending: false, nullsFirst: false })
        .limit(200);
      if (filtro !== "todos") q = q.eq("status_manifestacao", filtro);
      const { data } = await q;
      return (data || []) as DFe[];
    },
  });

  const sync = async () => {
    if (!currentEmpresa) return;
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("dfe-api/sync", {
        body: { empresa_id: currentEmpresa },
      });
      if (error || !data?.success) {
        const msg = error?.message || data?.error || "Falha ao sincronizar";
        toast.error(msg);
      } else {
        const d = data.data;
        toast.success(`Sincronizado: ${d.docs_processados} novo(s) documento(s). NSU=${d.ultimo_nsu}/${d.max_nsu}`);
        qc.invalidateQueries({ queryKey: ["dfe-list"] });
        qc.invalidateQueries({ queryKey: ["dfe-ctrl"] });
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSyncing(false);
    }
  };

  const baixarXml = async (id: string, chave: string) => {
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dfe-api/${id}/xml?empresa_id=${currentEmpresa}`;
      const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        toast.error(e.error || `Erro ${r.status}`);
        return;
      }
      const blob = await r.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${chave}.xml`;
      document.body.appendChild(a); a.click(); a.remove();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const abrirManifestar = (dfe: DFe, tipo: string) => {
    setManifestDlg({ dfe, tipo });
    setJustificativa("");
  };

  const enviarManifestacao = async () => {
    if (!manifestDlg) return;
    const { dfe, tipo } = manifestDlg;
    const precisaJust = tipo === "desconhecimento" || tipo === "nao_realizada";
    if (precisaJust && justificativa.trim().length < 15) {
      toast.error("Justificativa deve ter no mínimo 15 caracteres");
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke(`dfe-api/${dfe.id}/manifestar`, {
        body: { empresa_id: currentEmpresa, tipo, justificativa: justificativa.trim() },
      });
      if (error || !data?.success) {
        toast.error(data?.error || error?.message || "Falha ao manifestar");
      } else {
        toast.success(`Manifestação ${tipo} enviada (cStat ${data.data.cStat})`);
        setManifestDlg(null);
        qc.invalidateQueries({ queryKey: ["dfe-list"] });
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const counts = (lista || []).reduce((acc: Record<string, number>, d) => {
    acc[d.status_manifestacao] = (acc[d.status_manifestacao] || 0) + 1;
    return acc;
  }, {});

  return (
    <AppLayout title="Notas Recebidas (DF-e)">
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Notas Recebidas (DF-e)</h1>
            <p className="text-sm text-muted-foreground">
              NF-e emitidas contra o CNPJ da empresa, baixadas direto da SEFAZ. Use a Manifestação do Destinatário para confirmar ou desconhecer a operação.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={currentEmpresa} onValueChange={setEmpresaId}>
              <SelectTrigger className="w-[280px]"><SelectValue placeholder="Selecione a empresa" /></SelectTrigger>
              <SelectContent>
                {empresas?.map((e: any) => (
                  <SelectItem key={e.id} value={e.id}>{e.razao_social}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={sync} disabled={!currentEmpresa || syncing}>
              <RefreshCw className={cn("h-4 w-4 mr-2", syncing && "animate-spin")} />
              Sincronizar agora
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {(["todos", "pendente", "ciente", "confirmada", "desconhecida"] as const).map((s) => (
            <Card key={s}
              onClick={() => setFiltro(s)}
              className={cn("cursor-pointer transition", filtro === s && "ring-2 ring-primary")}>
              <CardContent className="p-4">
                <div className="text-xs uppercase text-muted-foreground">{s === "todos" ? "Total" : STATUS_LABEL[s] || s}</div>
                <div className="text-2xl font-semibold mt-1">
                  {s === "todos" ? (lista?.length ?? 0) : (counts[s] ?? 0)}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Documentos recebidos</span>
              {ctrl && (
                <span className="text-xs font-normal text-muted-foreground">
                  Último NSU: <b>{ctrl.ultimo_nsu}</b> / Máx SEFAZ: <b>{ctrl.max_nsu}</b>
                  {ctrl.ultima_consulta && <> · última consulta {fmtDate(ctrl.ultima_consulta)}</>}
                </span>
              )}
            </CardTitle>
            <CardDescription>
              {ctrl?.ultimo_erro && <span className="text-rose-600">⚠ {ctrl.ultimo_erro}</span>}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Emitente</TableHead>
                  <TableHead>NF-e</TableHead>
                  <TableHead>Emissão</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Sit. NF-e</TableHead>
                  <TableHead>Manifestação</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Carregando…</TableCell></TableRow>
                )}
                {!isLoading && (lista?.length ?? 0) === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center py-12">
                    <Inbox className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                    <div className="text-muted-foreground">Nenhum documento. Clique em <b>Sincronizar agora</b> para buscar na SEFAZ.</div>
                  </TableCell></TableRow>
                )}
                {lista?.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>
                      <div className="font-medium truncate max-w-[280px]">{d.nome_emitente || "—"}</div>
                      <div className="text-xs text-muted-foreground">{fmtCnpj(d.cnpj_emitente)}</div>
                    </TableCell>
                    <TableCell>
                      {d.numero_nfe ? <><b>{d.numero_nfe}</b>/{d.serie ?? "—"}</> : <span className="text-muted-foreground text-xs">só resumo</span>}
                      <div className="text-[10px] text-muted-foreground font-mono truncate max-w-[220px]">{d.chave_acesso}</div>
                    </TableCell>
                    <TableCell className="text-xs">{fmtDate(d.data_emissao)}</TableCell>
                    <TableCell className="text-right">{fmtMoney(d.valor_total)}</TableCell>
                    <TableCell>
                      {d.situacao_nfe ? (
                        <Badge variant="outline">{SIT_LABEL[d.situacao_nfe] || d.situacao_nfe}</Badge>
                      ) : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_STYLES[d.status_manifestacao]}>
                        {STATUS_LABEL[d.status_manifestacao] || d.status_manifestacao}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => baixarXml(d.id, d.chave_acesso)}>
                            <Download className="h-4 w-4 mr-2" /> Baixar XML
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => abrirManifestar(d, "ciencia")}>
                            <Eye className="h-4 w-4 mr-2" /> Ciência da Operação
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => abrirManifestar(d, "confirmacao")}>
                            <CheckCircle2 className="h-4 w-4 mr-2" /> Confirmar Operação
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => abrirManifestar(d, "desconhecimento")}>
                            <FileQuestion className="h-4 w-4 mr-2" /> Desconhecer Operação
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => abrirManifestar(d, "nao_realizada")}>
                            <XCircle className="h-4 w-4 mr-2" /> Operação Não Realizada
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="bg-muted/30">
          <CardContent className="p-4 text-sm flex gap-3">
            <AlertCircle className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
            <div className="text-muted-foreground">
              <b>Como funciona:</b> a SEFAZ retorna resumos (<i>resNFe</i>) das NF-e emitidas contra seu CNPJ. Após manifestar <b>Ciência</b> ou <b>Confirmação</b>, o XML completo (<i>procNFe</i>) fica disponível para download nas próximas sincronizações. Justificativa é obrigatória para Desconhecimento ou Não Realizada (mín. 15 caracteres).
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!manifestDlg} onOpenChange={(o) => !o && setManifestDlg(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {manifestDlg?.tipo === "ciencia" && "Ciência da Operação"}
              {manifestDlg?.tipo === "confirmacao" && "Confirmação da Operação"}
              {manifestDlg?.tipo === "desconhecimento" && "Desconhecimento da Operação"}
              {manifestDlg?.tipo === "nao_realizada" && "Operação Não Realizada"}
            </DialogTitle>
            <DialogDescription>
              Chave: <span className="font-mono text-xs">{manifestDlg?.dfe.chave_acesso}</span>
            </DialogDescription>
          </DialogHeader>
          {(manifestDlg?.tipo === "desconhecimento" || manifestDlg?.tipo === "nao_realizada") && (
            <div className="space-y-2">
              <Label>Justificativa (mín. 15 caracteres)</Label>
              <Textarea value={justificativa} onChange={(e) => setJustificativa(e.target.value)}
                placeholder="Descreva o motivo…" rows={4} maxLength={255} />
              <div className="text-xs text-muted-foreground text-right">{justificativa.length}/255</div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setManifestDlg(null)}>Cancelar</Button>
            <Button onClick={enviarManifestacao} disabled={submitting}>
              {submitting ? "Enviando…" : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
