import { Cell, formatCurrency } from "./DANFePrintContent";

interface DANFeTotaisProps {
  nfe: any;
}

export function DANFeTotais({ nfe }: DANFeTotaisProps) {
  return (
    <>
      <div style={{
        background: "#e8e8e8",
        fontSize: "6.5pt",
        fontWeight: "bold",
        padding: "1px 4px",
        textTransform: "uppercase",
        borderBottom: "1px solid #000",
        borderTop: "1px solid #000",
        textAlign: "center",
      }}>
        CÁLCULO DO IMPOSTO
      </div>

      {/* Row 1 */}
      <div style={{ display: "flex", borderBottom: "1px solid #000" }}>
        <Cell label="BASE DE CÁLCULO DO ICMS" value={formatCurrency(nfe.valor_icms || 0)} flex={2} right />
        <Cell label="VALOR DO ICMS" value={formatCurrency(nfe.valor_icms || 0)} flex={2} right />
        <Cell label="BASE DE CÁLCULO DO ICMS S.T." value={formatCurrency(0)} flex={2} right />
        <Cell label="VALOR DO ICMS SUBSTITUIÇÃO" value={formatCurrency(0)} flex={2} right />
        <Cell label="VALOR TOTAL DOS PRODUTOS" value={formatCurrency(nfe.valor_produtos || 0)} flex={2} right last />
      </div>

      {/* Row 2 */}
      <div style={{ display: "flex", borderBottom: "1px solid #000" }}>
        <Cell label="VALOR DO FRETE" value={formatCurrency(nfe.valor_frete || 0)} flex={1} right />
        <Cell label="VALOR DO SEGURO" value={formatCurrency(nfe.valor_seguro || 0)} flex={1} right />
        <Cell label="DESCONTO" value={formatCurrency(nfe.valor_desconto || 0)} flex={1} right />
        <Cell label="OUTRAS DESPESAS" value={formatCurrency(nfe.valor_outras_despesas || 0)} flex={1} right />
        <Cell label="VALOR DO IPI" value={formatCurrency(nfe.valor_ipi || 0)} flex={1} right />
        <Cell label="VALOR TOTAL DA NOTA" value={formatCurrency(nfe.valor_total)} flex={1} right last />
      </div>
    </>
  );
}
