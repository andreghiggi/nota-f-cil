import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Printer, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

interface DANFeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nfeId: string | null;
  autoPrint?: boolean;
  onAutoPrintHandled?: () => void;
}

function base64ToBlob(b64: string, type = "application/pdf"): Blob {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

export function DANFeDialog({ open, onOpenChange, nfeId, autoPrint = false, onAutoPrintHandled }: DANFeDialogProps) {
  const autoPrintedFor = useRef<string | null>(null);
  const [printingNow, setPrintingNow] = useState(false);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["nfe-danfe-pdf", nfeId],
    enabled: !!nfeId && open,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("fiscal-api", {
        body: { action: "danfe_nfe", nfe_id: nfeId },
      });
      if (error) throw new Error(error.message || "Falha ao gerar DANFE");
      if (!data?.pdf_base64) throw new Error(data?.error || "PDF indisponível");
      return data as { pdf_base64: string; filename: string; numero?: string; chave?: string };
    },
  });

  const pdfUrl = useMemo(() => {
    if (!data?.pdf_base64) return null;
    return URL.createObjectURL(base64ToBlob(data.pdf_base64));
  }, [data?.pdf_base64]);

  useEffect(() => () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); }, [pdfUrl]);

  const handleDownload = () => {
    if (!pdfUrl || !data) return;
    const a = document.createElement("a");
    a.href = pdfUrl;
    a.download = data.filename || `DANFE-${data.numero || "nfe"}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handlePrint = () => {
    if (!pdfUrl) return;
    setPrintingNow(true);
    const w = window.open(pdfUrl, "_blank");
    if (!w) {
      toast.error("Bloqueado pelo navegador. Permita pop-ups para imprimir.");
      setPrintingNow(false);
      return;
    }
    const tryPrint = () => { try { w.focus(); w.print(); } catch { /* ignore */ } };
    w.addEventListener("load", tryPrint);
    setTimeout(tryPrint, 1200);
    setTimeout(() => setPrintingNow(false), 2000);
  };

  useEffect(() => {
    if (!autoPrint) { autoPrintedFor.current = null; return; }
    if (!open || isLoading || !pdfUrl || !nfeId || autoPrintedFor.current === nfeId) return;
    autoPrintedFor.current = nfeId;
    const t = window.setTimeout(() => {
      handlePrint();
      onAutoPrintHandled?.();
    }, 250);
    return () => window.clearTimeout(t);
  }, [autoPrint, open, isLoading, pdfUrl, nfeId, onAutoPrintHandled]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[90vh] p-0 flex flex-col">
        <DialogHeader className="p-4 pb-2 border-b">
          <DialogTitle className="flex items-center justify-between">
            <span>DANFE — NF-e {data?.numero ? `nº ${data.numero}` : ""}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => refetch()} disabled={isFetching}>
                <RefreshCw className={`h-4 w-4 mr-1 ${isFetching ? "animate-spin" : ""}`} /> Recarregar
              </Button>
              <Button size="sm" variant="outline" onClick={handleDownload} disabled={!pdfUrl}>
                <Download className="h-4 w-4 mr-1" /> Baixar PDF
              </Button>
              <Button size="sm" onClick={handlePrint} disabled={!pdfUrl || printingNow}>
                <Printer className="h-4 w-4 mr-1" /> Imprimir
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 bg-muted/30">
          {isLoading ? (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              Gerando DANFE oficial (sped-da)...
            </div>
          ) : error ? (
            <div className="h-full flex flex-col items-center justify-center gap-3 p-6 text-center">
              <p className="text-destructive font-medium">Não foi possível gerar a DANFE.</p>
              <p className="text-sm text-muted-foreground max-w-xl">{(error as Error).message}</p>
              <Button size="sm" variant="outline" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4 mr-1" /> Tentar novamente
              </Button>
            </div>
          ) : pdfUrl ? (
            <iframe
              src={pdfUrl}
              title="DANFE PDF"
              className="w-full h-full border-0"
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
