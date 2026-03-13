import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { DANFePrintContent } from "./danfe/DANFePrintContent";
import { danfePrintStyles } from "./danfe/danfePrintStyles";

interface DANFeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nfeId: string | null;
}

export function DANFeDialog({ open, onOpenChange, nfeId }: DANFeDialogProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const { data: nfe, isLoading } = useQuery({
    queryKey: ["nfe-danfe", nfeId],
    enabled: !!nfeId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("nfe")
        .select("*, empresas(razao_social, cnpj, inscricao_estadual, logradouro, numero, bairro, municipio, uf, cep, telefone, nome_fantasia)")
        .eq("id", nfeId!)
        .single();
      if (error) throw error;
      return data as any;
    },
  });

  const { data: itens = [] } = useQuery({
    queryKey: ["nfe-itens-danfe", nfeId],
    enabled: !!nfeId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("nfe_itens")
        .select("*")
        .eq("nfe_id", nfeId!)
        .order("numero_item", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
  });

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>DANFE NF-e ${nfe?.numero || ""}</title>
        <style>${danfePrintStyles}</style>
      </head>
      <body>${content.innerHTML}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
  };

  if (!nfe && !isLoading) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="flex items-center justify-between">
            <span>DANFE - NF-e</span>
            <Button size="sm" variant="outline" onClick={handlePrint} disabled={!nfe}>
              <Printer className="h-4 w-4 mr-1" /> Imprimir
            </Button>
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Carregando...</div>
        ) : nfe ? (
          <div className="p-4">
            <div ref={printRef}>
              <DANFePrintContent nfe={nfe} itens={itens} />
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
