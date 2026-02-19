import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, Download, X } from "lucide-react";
import { useRef } from "react";
import { Tables } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

type NfceWithEmpresa = Tables<"nfce"> & {
  empresas: Pick<Tables<"empresas">, "razao_social" | "cnpj" | "inscricao_estadual" | "logradouro" | "numero" | "bairro" | "municipio" | "uf" | "cep" | "telefone" | "nome_fantasia"> | null;
};

interface DANFCeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nfceId: string | null;
}

export function DANFCeDialog({ open, onOpenChange, nfceId }: DANFCeDialogProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const { data: nfce, isLoading } = useQuery({
    queryKey: ["nfce-danfce", nfceId],
    enabled: !!nfceId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("nfce")
        .select("*, empresas(razao_social, cnpj, inscricao_estadual, logradouro, numero, bairro, municipio, uf, cep, telefone, nome_fantasia)")
        .eq("id", nfceId!)
        .single();
      if (error) throw error;
      return data as NfceWithEmpresa;
    },
  });

  const { data: itens = [] } = useQuery({
    queryKey: ["nfce-itens-danfce", nfceId],
    enabled: !!nfceId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("nfce_itens")
        .select("*")
        .eq("nfce_id", nfceId!)
        .order("numero_item", { ascending: true });
      if (error) throw error;
      return data;
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
        <title>DANFE NFC-e ${nfce?.numero || ""}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Courier New', monospace; font-size: 10px; width: 80mm; margin: 0 auto; padding: 4mm; }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .divider { border-top: 1px dashed #000; margin: 4px 0; }
          .line { display: flex; justify-content: space-between; }
          .items-table { width: 100%; border-collapse: collapse; }
          .items-table td { padding: 1px 0; vertical-align: top; }
          .items-table .desc { max-width: 160px; }
          .right { text-align: right; }
          .small { font-size: 8px; }
          .total-line { font-size: 14px; font-weight: bold; }
          h2 { font-size: 12px; margin: 2px 0; }
          h3 { font-size: 10px; margin: 2px 0; }
          @media print { body { width: 80mm; } }
        </style>
      </head>
      <body>${content.innerHTML}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 300);
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const formatCNPJ = (cnpj: string) =>
    cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");

  const formatChave = (chave: string) =>
    chave.replace(/(.{4})/g, "$1 ").trim();

  if (!nfce && !isLoading) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Cupom Fiscal - NFC-e</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={handlePrint} disabled={!nfce}>
                <Printer className="h-4 w-4 mr-1" /> Imprimir
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Carregando...</div>
        ) : nfce ? (
          <div className="border rounded-lg p-4 bg-white text-black font-mono text-[11px] leading-tight">
            <div ref={printRef}>
              {/* Header - Empresa */}
              <div className="center">
                <div className="bold" style={{ fontSize: "12px" }}>
                  {nfce.empresas?.razao_social || "EMPRESA"}
                </div>
                {nfce.empresas?.nome_fantasia && (
                  <div>{nfce.empresas.nome_fantasia}</div>
                )}
                <div className="small">
                  CNPJ: {nfce.empresas?.cnpj ? formatCNPJ(nfce.empresas.cnpj) : "—"}
                  {nfce.empresas?.inscricao_estadual && ` | IE: ${nfce.empresas.inscricao_estadual}`}
                </div>
                <div className="small">
                  {[nfce.empresas?.logradouro, nfce.empresas?.numero, nfce.empresas?.bairro].filter(Boolean).join(", ")}
                </div>
                <div className="small">
                  {nfce.empresas?.municipio} - {nfce.empresas?.uf}
                  {nfce.empresas?.cep && ` | CEP: ${nfce.empresas.cep}`}
                </div>
              </div>

              <div className="divider" />

              <div className="center bold" style={{ fontSize: "12px" }}>
                DANFE NFC-e - Documento Auxiliar
              </div>
              <div className="center bold" style={{ fontSize: "11px" }}>
                da Nota Fiscal de Consumidor Eletrônica
              </div>

              {nfce.ambiente === "homologacao" && (
                <div className="center bold" style={{ fontSize: "10px", margin: "4px 0", border: "1px solid #000", padding: "2px" }}>
                  EMITIDA EM AMBIENTE DE HOMOLOGAÇÃO - SEM VALOR FISCAL
                </div>
              )}

              <div className="divider" />

              {/* Items */}
              <div className="bold">ITENS</div>
              <table className="items-table">
                <thead>
                  <tr>
                    <td className="bold small">#</td>
                    <td className="bold small">Descrição</td>
                    <td className="bold small right">Qtd</td>
                    <td className="bold small right">Unit</td>
                    <td className="bold small right">Total</td>
                  </tr>
                </thead>
                <tbody>
                  {itens.map((item) => (
                    <tr key={item.id}>
                      <td className="small">{item.numero_item}</td>
                      <td className="small desc">{item.descricao}</td>
                      <td className="small right">{Number(item.quantidade).toFixed(2)}</td>
                      <td className="small right">{Number(item.valor_unitario).toFixed(2)}</td>
                      <td className="small right">{Number(item.valor_total).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="divider" />

              {/* Totals */}
              <div className="line">
                <span>Qtd. Itens:</span>
                <span>{itens.length}</span>
              </div>
              <div className="line">
                <span>Subtotal:</span>
                <span>{formatCurrency(nfce.valor_produtos || 0)}</span>
              </div>
              {(nfce.valor_desconto ?? 0) > 0 && (
                <div className="line">
                  <span>Desconto:</span>
                  <span>-{formatCurrency(nfce.valor_desconto || 0)}</span>
                </div>
              )}
              {(nfce.valor_frete ?? 0) > 0 && (
                <div className="line">
                  <span>Frete:</span>
                  <span>{formatCurrency(nfce.valor_frete || 0)}</span>
                </div>
              )}
              <div className="divider" />
              <div className="line total-line">
                <span>TOTAL:</span>
                <span>{formatCurrency(nfce.valor_total)}</span>
              </div>

              <div className="divider" />

              {/* Fiscal info */}
              <div className="small">
                <div className="line">
                  <span>Número:</span>
                  <span>{nfce.numero}</span>
                </div>
                <div className="line">
                  <span>Série:</span>
                  <span>{nfce.serie}</span>
                </div>
                <div className="line">
                  <span>Data Emissão:</span>
                  <span>{new Date(nfce.data_emissao).toLocaleString("pt-BR")}</span>
                </div>
                {nfce.protocolo && (
                  <div className="line">
                    <span>Protocolo:</span>
                    <span>{nfce.protocolo}</span>
                  </div>
                )}
                {nfce.data_autorizacao && (
                  <div className="line">
                    <span>Autorização:</span>
                    <span>{new Date(nfce.data_autorizacao).toLocaleString("pt-BR")}</span>
                  </div>
                )}
              </div>

              {nfce.chave_acesso && (
                <>
                  <div className="divider" />
                  <div className="center small">
                    <div className="bold">Chave de Acesso</div>
                    <div style={{ wordBreak: "break-all", fontSize: "8px" }}>
                      {formatChave(nfce.chave_acesso)}
                    </div>
                  </div>
                </>
              )}

              {nfce.qrcode_url && (
                <>
                  <div className="divider" />
                  <div className="center" style={{ margin: "8px 0" }}>
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(nfce.qrcode_url)}`}
                      alt="QR Code NFC-e"
                      style={{ width: "150px", height: "150px", margin: "0 auto" }}
                    />
                  </div>
                  <div className="center small">
                    <div className="bold">Consulte pela Chave de Acesso em:</div>
                    <div style={{ wordBreak: "break-all", fontSize: "7px" }}>
                      {nfce.qrcode_url}
                    </div>
                  </div>
                </>
              )}

              <div className="divider" />
              <div className="center small" style={{ marginTop: "4px" }}>
                {nfce.status === "autorizada" ? (
                  <div className="bold">NFC-e AUTORIZADA</div>
                ) : nfce.status === "cancelada" ? (
                  <div className="bold">NFC-e CANCELADA</div>
                ) : (
                  <div className="bold">Status: {nfce.status.toUpperCase()}</div>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
