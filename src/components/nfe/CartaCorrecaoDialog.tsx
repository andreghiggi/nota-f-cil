import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileEdit, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nfeId: string | null;
  nfeNumero?: string;
}

export function CartaCorrecaoDialog({ open, onOpenChange, nfeId, nfeNumero }: Props) {
  const [correcao, setCorrecao] = useState("");
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();

  const { data: eventos = [], isLoading: loadingEventos } = useQuery({
    queryKey: ["nfe-cce-eventos", nfeId],
    queryFn: async () => {
      if (!nfeId) return [];
      const { data, error } = await supabase
        .from("nfe_eventos")
        .select("*")
        .eq("nfe_id", nfeId)
        .eq("tipo_evento", "carta_correcao")
        .order("sequencia", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!nfeId,
  });

  useEffect(() => {
    if (open) setCorrecao("");
  }, [open]);

  const proxSequencia = (eventos.reduce((m, e: any) => Math.max(m, e.sequencia || 0), 0) || 0) + 1;
  const eventosRegistrados = eventos.filter((e: any) =>
    e.codigo_retorno === "135" || e.codigo_retorno === "136"
  );
  const limiteAtingido = eventosRegistrados.length >= 20;

  const handleSubmit = async () => {
    const correcaoTrim = correcao.trim();
    if (correcaoTrim.length < 15) {
      toast.error("A correção deve ter pelo menos 15 caracteres");
      return;
    }
    if (correcaoTrim.length > 1000) {
      toast.error("A correção não pode ter mais de 1000 caracteres");
      return;
    }
    if (!nfeId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("fiscal-api", {
        body: { action: "cce_nfe", nfe_id: nfeId, correcao: correcaoTrim },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(`CC-e #${data?.data?.sequencia || proxSequencia} registrada com sucesso`);
      setCorrecao("");
      queryClient.invalidateQueries({ queryKey: ["nfe-cce-eventos", nfeId] });
      queryClient.invalidateQueries({ queryKey: ["nfe"] });
    } catch (err: any) {
      toast.error(err?.message || "Erro ao registrar CC-e");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileEdit className="h-5 w-5 text-primary" />
            Carta de Correção Eletrônica
          </DialogTitle>
          <DialogDescription>
            NF-e {nfeNumero ? `#${nfeNumero}` : ""} — corrija informações que não alterem valores, quantidades, partes envolvidas ou dados que afetem o cálculo do imposto.
          </DialogDescription>
        </DialogHeader>

        {/* Histórico */}
        {!loadingEventos && eventos.length > 0 && (
          <div className="space-y-2 max-h-48 overflow-y-auto rounded-md border border-border p-3 bg-muted/30">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Histórico ({eventos.length})
            </p>
            {eventos.map((e: any) => {
              const ok = e.codigo_retorno === "135" || e.codigo_retorno === "136";
              return (
                <div key={e.id} className="flex items-start gap-2 text-sm">
                  {ok ? (
                    <CheckCircle2 className="h-4 w-4 text-success mt-0.5 shrink-0" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">Seq. {e.sequencia}</Badge>
                      {e.protocolo && (
                        <span className="text-xs text-muted-foreground tabular-nums">Prot: {e.protocolo}</span>
                      )}
                    </div>
                    <p className="text-foreground mt-0.5 break-words">{e.justificativa}</p>
                    {e.motivo_retorno && (
                      <p className="text-xs text-muted-foreground mt-0.5">{e.motivo_retorno}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="cce-correcao">
              Texto da correção
              <span className="ml-2 text-xs text-muted-foreground">
                (próxima sequência: {proxSequencia})
              </span>
            </Label>
            <span className={`text-xs tabular-nums ${correcao.length > 1000 ? "text-destructive" : "text-muted-foreground"}`}>
              {correcao.length}/1000
            </span>
          </div>
          <Textarea
            id="cce-correcao"
            placeholder="Descreva a correção a ser aplicada (mínimo 15 caracteres)..."
            value={correcao}
            onChange={(e) => setCorrecao(e.target.value)}
            rows={5}
            disabled={loading || limiteAtingido}
            maxLength={1000}
          />
          <p className="text-xs text-muted-foreground">
            Não é possível corrigir: valores, quantidades, datas de emissão/saída, dados do emitente/destinatário ou número/série da NF-e.
          </p>
        </div>

        {limiteAtingido && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
            <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            <span>Limite de 20 cartas de correção por NF-e foi atingido.</span>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Fechar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || limiteAtingido || correcao.trim().length < 15}
          >
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Enviar CC-e
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
