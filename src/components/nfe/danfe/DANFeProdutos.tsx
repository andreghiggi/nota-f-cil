import { formatCurrency } from "./DANFePrintContent";

interface DANFeProdutosProps {
  itens: any[];
}

export function DANFeProdutos({ itens }: DANFeProdutosProps) {
  return (
    <>
      <div style={{
        background: "#e8e8e8",
        fontSize: "6.5pt",
        fontWeight: "bold",
        padding: "1px 4px",
        textTransform: "uppercase",
        borderBottom: "1px solid #000",
        textAlign: "center",
      }}>
        DADOS DOS PRODUTOS / SERVIÇOS
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {[
              { label: "CÓDIGO", width: "8%" },
              { label: "DESCRIÇÃO DO PRODUTO / SERVIÇO", width: "25%" },
              { label: "NCM/SH", width: "7%" },
              { label: "CST", width: "4%" },
              { label: "CFOP", width: "5%" },
              { label: "UN", width: "4%" },
              { label: "QUANT.", width: "8%" },
              { label: "VALOR UNIT.", width: "9%" },
              { label: "VALOR TOTAL", width: "9%" },
              { label: "B.CÁLC ICMS", width: "8%" },
              { label: "VALOR ICMS", width: "7%" },
              { label: "VALOR IPI", width: "6%" },
              { label: "ALÍQ. ICMS", width: "5%" },
              { label: "ALÍQ. IPI", width: "5%" },
            ].map((col) => (
              <th key={col.label} style={{
                background: "#e8e8e8",
                fontSize: "5pt",
                fontWeight: "bold",
                padding: "1px 2px",
                border: "1px solid #000",
                borderTop: "none",
                textAlign: "center",
                textTransform: "uppercase",
                width: col.width,
              }}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {itens.map((item: any) => (
            <tr key={item.id}>
              <Td>{item.codigo_produto}</Td>
              <Td align="left">{item.descricao}</Td>
              <Td>{item.ncm || ""}</Td>
              <Td>{item.cst_icms || item.csosn || ""}</Td>
              <Td>{item.cfop}</Td>
              <Td>{item.unidade}</Td>
              <Td align="right">{formatCurrency(Number(item.quantidade))}</Td>
              <Td align="right">{formatCurrency(Number(item.valor_unitario))}</Td>
              <Td align="right">{formatCurrency(Number(item.valor_total))}</Td>
              <Td align="right">{item.valor_icms ? formatCurrency(Number(item.valor_total)) : ""}</Td>
              <Td align="right">{item.valor_icms ? formatCurrency(Number(item.valor_icms)) : ""}</Td>
              <Td align="right">{item.valor_ipi ? formatCurrency(Number(item.valor_ipi)) : ""}</Td>
              <Td align="right">{item.aliquota_icms ? `${Number(item.aliquota_icms).toFixed(2)}%` : ""}</Td>
              <Td align="right">{item.aliquota_ipi ? `${Number(item.aliquota_ipi).toFixed(2)}%` : ""}</Td>
            </tr>
          ))}
          {/* Fill empty rows for minimum visual */}
          {itens.length < 5 && Array.from({ length: 5 - itens.length }).map((_, i) => (
            <tr key={`empty-${i}`}>
              {Array.from({ length: 14 }).map((_, j) => (
                <Td key={j}>&nbsp;</Td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function Td({ children, align = "center" }: { children: React.ReactNode; align?: string }) {
  return (
    <td style={{
      fontSize: "6.5pt",
      padding: "1px 2px",
      borderLeft: "1px solid #000",
      borderRight: "1px solid #000",
      borderBottom: "1px solid #ccc",
      verticalAlign: "top",
      textAlign: align as any,
    }}>
      {children}
    </td>
  );
}
