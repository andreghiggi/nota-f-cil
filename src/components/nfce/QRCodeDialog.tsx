import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface QRCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  qrcodeUrl: string | null;
  chaveAcesso: string | null;
  numero: string;
}

export function QRCodeDialog({ open, onOpenChange, qrcodeUrl, chaveAcesso, numero }: QRCodeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>QR Code - NFC-e {numero}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-4">
          {qrcodeUrl ? (
            <>
              <div className="bg-white p-4 rounded-lg border">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrcodeUrl)}`}
                  alt="QR Code NFC-e"
                  className="w-[200px] h-[200px]"
                />
              </div>
              <p className="text-xs text-muted-foreground text-center break-all max-w-[280px]">
                {qrcodeUrl}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">QR Code não disponível para esta NFC-e.</p>
          )}
          {chaveAcesso && (
            <div className="text-center">
              <p className="text-xs font-medium text-foreground mb-1">Chave de Acesso</p>
              <p className="text-[10px] font-mono text-muted-foreground break-all">
                {chaveAcesso.replace(/(.{4})/g, "$1 ").trim()}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
