import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

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
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; font-size: 9px; width: 210mm; margin: 0 auto; padding: 10mm; }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .border-box { border: 1px solid #000; padding: 4px; margin-bottom: 4px; }
          .line { display: flex; justify-content: space-between; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #000; padding: 2px 4px; text-align: left; font-size: 8px; }
          th { background: #f0f0f0; font-weight: bold; }
          .right { text-align: right; }
          h1 { font-size: 14px; margin: 4px 0; }
          h2 { font-size: 11px; margin: 2px 0; }
          .header-grid { display: grid; grid-template-columns: 1fr 2fr 1fr; gap: 4px; }
          @media print { body { width: 210mm; } }
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

  if (!nfe && !isLoading) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
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
          <div className="border rounded-lg p-6 bg-white text-black text-[10px] leading-tight">
            <div ref={printRef}>
              {/* Header */}
              <div className="border-box">
                <div className="header-grid">
                  <div>
                    <div className="bold" style={{ fontSize: "12px" }}>{nfe.empresas?.razao_social || "EMPRESA"}</div>
                    {nfe.empresas?.nome_fantasia && <div>{nfe.empresas.nome_fantasia}</div>}
                    <div>CNPJ: {nfe.empresas?.cnpj ? formatCNPJ(nfe.empresas.cnpj) : "—"}</div>
                    {nfe.empresas?.inscricao_estadual && <div>IE: {nfe.empresas.inscricao_estadual}</div>}
                    <div>{[nfe.empresas?.logradouro, nfe.empresas?.numero, nfe.empresas?.bairro].filter(Boolean).join(", ")}</div>
                    <div>{nfe.empresas?.municipio} - {nfe.empresas?.uf} {nfe.empresas?.cep && `| CEP: ${nfe.empresas.cep}`}</div>
                  </div>
                  <div className="center">
                    <h1>DANFE</h1>
                    <div>Documento Auxiliar da Nota Fiscal Eletrônica</div>
                    <div className="bold" style={{ marginTop: "4px" }}>
                      0 - ENTRADA &nbsp;&nbsp; 1 - SAÍDA
                    </div>
                    <div className="bold" style={{ fontSize: "14px", marginTop: "4px" }}>
                      Nº {nfe.numero} - Série {nfe.serie}
                    </div>
                  </div>
                  <div>
                    {nfe.chave_acesso && (
                      <div style={{ wordBreak: "break-all", fontSize: "7px" }}>
                        <div className="bold">Chave de Acesso</div>
                        {formatChave(nfe.chave_acesso)}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {nfe.ambiente === "homologacao" && (
                <div className="border-box center bold" style={{ fontSize: "10px", background: "#fff3cd" }}>
                  EMITIDA EM AMBIENTE DE HOMOLOGAÇÃO - SEM VALOR FISCAL
                </div>
              )}

              {/* Natureza da Operação */}
              <div className="border-box">
                <div className="bold">Natureza da Operação: {nfe.natureza_operacao}</div>
                {nfe.protocolo && <div>Protocolo de Autorização: {nfe.protocolo}</div>}
              </div>

              {/* Destinatário */}
              <div className="border-box">
                <div className="bold" style={{ fontSize: "9px", marginBottom: "2px" }}>DESTINATÁRIO / REMETENTE</div>
                <div className="grid">
                  <div>Nome: {nfe.dest_nome || "—"}</div>
                  <div>CPF/CNPJ: {nfe.dest_cpf_cnpj || "—"}</div>
                  <div>Endereço: {[nfe.dest_logradouro, nfe.dest_numero, nfe.dest_bairro].filter(Boolean).join(", ") || "—"}</div>
                  <div>Município: {nfe.dest_municipio || "—"} - {nfe.dest_uf || "—"}</div>
                  {nfe.dest_ie && <div>IE: {nfe.dest_ie}</div>}
                  {nfe.dest_email && <div>Email: {nfe.dest_email}</div>}
                </div>
              </div>

              {/* Items */}
              <div className="border-box">
                <div className="bold" style={{ fontSize: "9px", marginBottom: "2px" }}>PRODUTOS / SERVIÇOS</div>
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Código</th>
                      <th>Descrição</th>
                      <th>NCM</th>
                      <th>CFOP</th>
                      <th>Un</th>
                      <th className="right">Qtd</th>
                      <th className="right">Vl Unit</th>
                      <th className="right">Vl Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itens.map((item: any) => (
                      <tr key={item.id}>
                        <td>{item.numero_item}</td>
                        <td>{item.codigo_produto}</td>
                        <td>{item.descricao}</td>
                        <td>{item.ncm || "—"}</td>
                        <td>{item.cfop}</td>
                        <td>{item.unidade}</td>
                        <td className="right">{Number(item.quantidade).toFixed(2)}</td>
                        <td className="right">{Number(item.valor_unitario).toFixed(2)}</td>
                        <td className="right">{Number(item.valor_total).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div className="border-box">
                <div className="bold" style={{ fontSize: "9px", marginBottom: "2px" }}>TOTAIS</div>
                <div className="grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
                  <div>Produtos: {formatCurrency(nfe.valor_produtos || 0)}</div>
                  <div>Desconto: {formatCurrency(nfe.valor_desconto || 0)}</div>
                  <div>Frete: {formatCurrency(nfe.valor_frete || 0)}</div>
                  <div>Seguro: {formatCurrency(nfe.valor_seguro || 0)}</div>
                  <div>ICMS: {formatCurrency(nfe.valor_icms || 0)}</div>
                  <div>IPI: {formatCurrency(nfe.valor_ipi || 0)}</div>
                  <div>PIS: {formatCurrency(nfe.valor_pis || 0)}</div>
                  <div>COFINS: {formatCurrency(nfe.valor_cofins || 0)}</div>
                </div>
                <div className="bold right" style={{ fontSize: "14px", marginTop: "4px" }}>
                  TOTAL: {formatCurrency(nfe.valor_total)}
                </div>
              </div>

              {/* Footer */}
              <div className="border-box">
                <div className="grid">
                  <div>
                    <span className="bold">Data Emissão: </span>
                    {new Date(nfe.data_emissao).toLocaleString("pt-BR")}
                  </div>
                  {nfe.data_autorizacao && (
                    <div>
                      <span className="bold">Data Autorização: </span>
                      {new Date(nfe.data_autorizacao).toLocaleString("pt-BR")}
                    </div>
                  )}
                </div>
              </div>

              <div className="center bold" style={{ marginTop: "4px", fontSize: "9px" }}>
                {nfe.status === "autorizada" ? "NF-e AUTORIZADA" :
                 nfe.status === "cancelada" ? "NF-e CANCELADA" :
                 `Status: ${nfe.status.toUpperCase()}`}
              </div>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
