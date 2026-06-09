import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, Ban, Inbox, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEmpresas } from "@/hooks/useSupabaseData";
import { toast } from "sonner";

interface Prefill {
  empresa_id?: string;
  serie?: string | number;
  numero?: string | number;
  justificativa?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  prefill?: Prefill | null;
  defaultTab?: "historico" | "nova";
}

export function InutilizacoesDialog({ open, onOpenChange, prefill, defaultTab }: Props) {
  const queryClient = useQueryClient();
  const { data: empresas = [] } = useEmpresas();

  const [empresaId, setEmpresaId] = useState<string>("");
  const [serie, setSerie] = useState<string>("1");
  const [numIni, setNumIni] = useState<string>("");
  const [numFin, setNumFin] = useState<string>("");
  const [justificativa, setJustificativa] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [tab, setTab] = useState<string>(defaultTab || "historico");

  // Apply prefill / default tab when opening
  useState(() => {});
  // eslint-disable-next-line react-hooks/rules-of-hooks
  React.useEffect(() => {
    if (!open) return;
    setTab(defaultTab || (prefill ? "nova" : "historico"));
    if (prefill) {
      if (prefill.empresa_id) setEmpresaId(prefill.empresa_id);
      if (prefill.serie !== undefined) setSerie(String(prefill.serie));
      if (prefill.numero !== undefined) {
        const n = String(prefill.numero).replace(/^0+/, "") || "0";
        setNumIni(n);
        setNumFin(n);
      }
      if (prefill.justificativa) setJustificativa(prefill.justificativa);
    }
  }, [open, prefill, defaultTab]);


  const { data: inutilizacoes = [], isLoading } = useQuery({
    queryKey: ["inutilizacoes-nfe"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("logs_fiscais")
        .select("id, empresa_id, mensagem, detalhes, created_at, tipo, empresas:empresa_id(nome_fantasia, razao_social)")
        .eq("categoria", "inutilizacao_nfe")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
  });

  const reset = () => {
    setNumIni("");
    setNumFin("");
    setJustificativa("");
  };

  const handleSubmit = async () => {
    if (!empresaId) return toast.error("Selecione a empresa");
    const ini = parseInt(numIni, 10);
    const fin = parseInt(numFin || numIni, 10);
    if (!ini || !fin || fin < ini) return toast.error("Numeração inválida");
    if (justificativa.trim().length < 15)
      return toast.error("Justificativa deve ter ao menos 15 caracteres");

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("fiscal-api", {
        body: {
          action: "inutilizar_nfe",
          empresa_id: empresaId,
          serie: parseInt(serie, 10) || 1,
          numero_inicial: ini,
          numero_final: fin,
          justificativa: justificativa.trim(),
        },
      });
      if (error || !data?.success) {
        const msg =
          (data as any)?.error ||
          (data as any)?.details?.error ||
          error?.message ||
          "Falha ao inutilizar";
        toast.error(typeof msg === "string" ? msg : JSON.stringify(msg));
      } else {
        toast.success(
          `Numeração ${ini}${fin !== ini ? `-${fin}` : ""} inutilizada (protocolo ${data.data?.protocolo || "-"})`
        );
        reset();
        queryClient.invalidateQueries({ queryKey: ["inutilizacoes-nfe"] });
        queryClient.invalidateQueries({ queryKey: ["nfe"] });
      }
    } catch (e: any) {
      toast.error(e?.message || "Erro inesperado");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ban className="h-5 w-5 text-destructive" />
            Inutilizações de NF-e
          </DialogTitle>
          <DialogDescription>
            Inutilize números de NF-e não utilizados (modelo 55) e consulte o histórico de inutilizações.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="mt-2">
          <TabsList>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
            <TabsTrigger value="nova">Nova inutilização</TabsTrigger>
          </TabsList>

          <TabsContent value="historico" className="mt-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : inutilizacoes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Inbox className="h-10 w-10 text-muted-foreground/40 mb-2" />
                <p className="text-sm font-medium">Nenhuma inutilização registrada</p>
                <p className="text-xs text-muted-foreground mt-1">
                  As inutilizações realizadas aparecerão aqui.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Data</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Empresa</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Série</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Numeração</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Protocolo</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {inutilizacoes.map((row: any) => {
                      const d = row.detalhes || {};
                      const ini = d.numero_inicial ?? d.nNFIni ?? "?";
                      const fin = d.numero_final ?? d.nNFFin ?? ini;
                      const faixa = ini === fin ? `${ini}` : `${ini} – ${fin}`;
                      const ok = row.tipo === "sucesso" || String(d.cStat) === "102";
                      return (
                        <tr key={row.id}>
                          <td className="px-3 py-2 tabular-nums">
                            {new Date(row.created_at).toLocaleString("pt-BR")}
                          </td>
                          <td className="px-3 py-2">
                            {row.empresas?.nome_fantasia || row.empresas?.razao_social || "—"}
                          </td>
                          <td className="px-3 py-2 tabular-nums">{d.serie ?? "—"}</td>
                          <td className="px-3 py-2 tabular-nums font-medium">{faixa}</td>
                          <td className="px-3 py-2 tabular-nums text-xs">{d.protocolo || "—"}</td>
                          <td className="px-3 py-2">
                            {ok ? (
                              <Badge variant="default" className="bg-success/15 text-success border border-success/30">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Inutilizada
                              </Badge>
                            ) : (
                              <Badge variant="destructive">Falha</Badge>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="nova" className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Empresa</Label>
                <Select value={empresaId} onValueChange={setEmpresaId}>
                  <SelectTrigger><SelectValue placeholder="Selecione a empresa" /></SelectTrigger>
                  <SelectContent>
                    {empresas.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.nome_fantasia || e.razao_social}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Série</Label>
                <Input value={serie} onChange={(e) => setSerie(e.target.value)} placeholder="1" />
              </div>
              <div />
              <div>
                <Label>Número inicial</Label>
                <Input
                  value={numIni}
                  onChange={(e) => setNumIni(e.target.value)}
                  placeholder="Ex: 16136"
                />
              </div>
              <div>
                <Label>Número final</Label>
                <Input
                  value={numFin}
                  onChange={(e) => setNumFin(e.target.value)}
                  placeholder="(opcional, igual ao inicial)"
                />
              </div>
              <div className="col-span-2">
                <Label>Justificativa (mín. 15 caracteres)</Label>
                <Textarea
                  value={justificativa}
                  onChange={(e) => setJustificativa(e.target.value)}
                  rows={3}
                  placeholder="Ex: Inutilização por salto de numeração após rejeição"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {justificativa.trim().length}/255 caracteres
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
                Fechar
              </Button>
              <Button onClick={handleSubmit} disabled={submitting} variant="destructive">
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Enviando à SEFAZ...
                  </>
                ) : (
                  <>
                    <Ban className="h-4 w-4 mr-2" />
                    Inutilizar numeração
                  </>
                )}
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
