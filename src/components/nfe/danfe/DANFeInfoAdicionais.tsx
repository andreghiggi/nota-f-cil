interface DANFeInfoAdicionaisProps {
  nfe: any;
}

export function DANFeInfoAdicionais({ nfe }: DANFeInfoAdicionaisProps) {
  const infos: string[] = [];
  
  if (nfe.valor_pis) infos.push(`Valor do PIS: ${Number(nfe.valor_pis).toFixed(2)}`);
  if (nfe.valor_cofins) infos.push(`Valor do COFINS: ${Number(nfe.valor_cofins).toFixed(2)}`);
  if (nfe.dest_email) infos.push(`Email destinatário: ${nfe.dest_email}`);

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
        DADOS ADICIONAIS
      </div>

      <div style={{ display: "flex", borderBottom: "1px solid #000" }}>
        <div style={{
          flex: 6,
          borderRight: "1px solid #000",
          padding: "3px 4px",
          minHeight: "40px",
        }}>
          <div style={{ fontSize: "5.5pt", color: "#333", textTransform: "uppercase", marginBottom: "1px" }}>
            INFORMAÇÕES COMPLEMENTARES
          </div>
          <div style={{ fontSize: "6.5pt", lineHeight: 1.3 }}>
            {infos.join(" | ") || "—"}
          </div>
        </div>
        <div style={{
          flex: 4,
          padding: "3px 4px",
          minHeight: "40px",
        }}>
          <div style={{ fontSize: "5.5pt", color: "#333", textTransform: "uppercase", marginBottom: "1px" }}>
            RESERVADO AO FISCO
          </div>
        </div>
      </div>
    </>
  );
}
