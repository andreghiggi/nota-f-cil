import { formatCNPJ, formatChave } from "./DANFePrintContent";

interface DANFeHeaderProps {
  nfe: any;
}

export function DANFeHeader({ nfe }: DANFeHeaderProps) {
  const empresa = nfe.empresas;
  const endereco = [empresa?.logradouro, empresa?.numero].filter(Boolean).join(", ");
  const endereco2 = [empresa?.bairro, empresa?.municipio ? `${empresa.municipio} - ${empresa?.uf}` : ""].filter(Boolean).join(" - ");
  const endereco3 = [empresa?.cep ? `CEP: ${empresa.cep}` : "", empresa?.telefone ? `Fone: ${empresa.telefone}` : ""].filter(Boolean).join(" | ");

  return (
    <div style={{ display: "flex", borderBottom: "2px solid #000" }}>
      {/* Emitente */}
      <div style={{
        width: "40%",
        borderRight: "1px solid #000",
        padding: "4px 6px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
      }}>
        <div style={{ fontSize: "11pt", fontWeight: "bold", textAlign: "center", marginBottom: "2px" }}>
          {empresa?.razao_social || "EMPRESA"}
        </div>
        {empresa?.nome_fantasia && (
          <div style={{ fontSize: "8pt", textAlign: "center", marginBottom: "2px" }}>
            {empresa.nome_fantasia}
          </div>
        )}
        <div style={{ fontSize: "7pt", textAlign: "center", lineHeight: 1.3 }}>
          {endereco}<br />
          {endereco2}<br />
          {endereco3}
        </div>
      </div>

      {/* DANFE central */}
      <div style={{
        width: "22%",
        borderRight: "1px solid #000",
        padding: "4px",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}>
        <div style={{ fontSize: "14pt", fontWeight: "bold", letterSpacing: "2px" }}>DANFE</div>
        <div style={{ fontSize: "6pt", margin: "2px 0", lineHeight: 1.2 }}>
          DOCUMENTO AUXILIAR DA<br />NOTA FISCAL ELETRÔNICA
        </div>
        <div style={{ fontSize: "8pt", margin: "2px 0" }}>
          0 - ENTRADA
          <br />
          1 - SAÍDA
          <span style={{
            display: "inline-block",
            border: "1px solid #000",
            width: "14px",
            height: "14px",
            textAlign: "center",
            fontWeight: "bold",
            fontSize: "10pt",
            lineHeight: "14px",
            marginLeft: "4px",
            verticalAlign: "middle",
          }}>1</span>
        </div>
        <div style={{ fontSize: "10pt", fontWeight: "bold", marginTop: "2px" }}>
          Nº {nfe.numero}
        </div>
        <div style={{ fontSize: "8pt" }}>
          SÉRIE {nfe.serie}
        </div>
        <div style={{ fontSize: "6pt", marginTop: "2px" }}>
          FOLHA 1/1
        </div>
      </div>

      {/* Chave de acesso */}
      <div style={{
        width: "38%",
        padding: "4px 6px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
      }}>
        {/* Barcode placeholder */}
        {nfe.chave_acesso && (
          <div style={{
            textAlign: "center",
            fontFamily: "'Libre Barcode 128', monospace",
            fontSize: "28pt",
            lineHeight: 1,
            marginBottom: "4px",
            letterSpacing: 0,
          }}>
            {nfe.chave_acesso}
          </div>
        )}
        <div style={{ fontSize: "5.5pt", textAlign: "center", marginBottom: "1px" }}>
          CHAVE DE ACESSO
        </div>
        <div style={{
          fontSize: "7pt",
          textAlign: "center",
          fontFamily: "monospace",
          wordBreak: "break-all",
          letterSpacing: "0.5px",
        }}>
          {nfe.chave_acesso ? formatChave(nfe.chave_acesso) : "—"}
        </div>
        <div style={{ fontSize: "6pt", textAlign: "center", marginTop: "6px", lineHeight: 1.2 }}>
          Consulta de autenticidade no portal nacional<br />
          da NF-e: www.nfe.fazenda.gov.br/portal
        </div>
      </div>
    </div>
  );
}
