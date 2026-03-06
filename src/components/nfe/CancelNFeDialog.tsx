import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";

interface CancelNFeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  numero: string;
  onConfirm: (justificativa: string) => void;
  loading: boolean;
}

export function CancelNFeDialog({ open, onOpenChange, numero, onConfirm, loading }: CancelNFeDialogProps) {
  const [justificativa, setJustificativa] = useState("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancelar NF-e {numero}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            Esta ação é irreversível. Informe a justificativa do cancelamento (mínimo 15 caracteres).
          </p>
          <Textarea
            placeholder="Motivo do cancelamento..."
            value={justificativa}
            onChange={(e) => setJustificativa(e.target.value)}
            rows={3}
          />
          {justificativa.length > 0 && justificativa.length < 15 && (
            <p className="text-xs text-destructive">Mínimo 15 caracteres ({justificativa.length}/15)</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Voltar
          </Button>
          <Button
            variant="destructive"
            onClick={() => onConfirm(justificativa)}
            disabled={justificativa.length < 15 || loading}
          >
            {loading ? "Cancelando..." : "Confirmar Cancelamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
