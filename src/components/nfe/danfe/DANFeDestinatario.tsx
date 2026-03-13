import { Cell, formatCPFCNPJ } from "./DANFePrintContent";

interface DANFeDestinatarioProps {
  nfe: any;
}

export function DANFeDestinatario({ nfe }: DANFeDestinatarioProps) {
  return (
    <>
      {/* Section title */}
      <div style={{
        background: "#e8e8e8",
        fontSize: "6.5pt",
        fontWeight: "bold",
        padding: "1px 4px",
        textTransform: "uppercase",
        borderBottom: "1px solid #000",
        textAlign: "center",
      }}>
        DESTINATÁRIO / REMETENTE
      </div>

      {/* Row 1 */}
      <div style={{ display: "flex", borderBottom: "1px solid #000" }}>
        <Cell label="NOME / RAZÃO SOCIAL" value={nfe.dest_nome || "CONSUMIDOR NÃO IDENTIFICADO"} flex={6} />
        <Cell label="CNPJ / CPF" value={formatCPFCNPJ(nfe.dest_cpf_cnpj || "")} flex={2} />
        <Cell label="DATA DA EMISSÃO" value={new Date(nfe.data_emissao).toLocaleDateString("pt-BR")} flex={2} last />
      </div>

      {/* Row 2 */}
      <div style={{ display: "flex", borderBottom: "1px solid #000" }}>
        <Cell label="ENDEREÇO" value={[nfe.dest_logradouro, nfe.dest_numero].filter(Boolean).join(", ") || "—"} flex={5} />
        <Cell label="BAIRRO / DISTRITO" value={nfe.dest_bairro || "—"} flex={2} />
        <Cell label="CEP" value={nfe.dest_cep || "—"} flex={1} />
        <Cell label="DATA DA SAÍDA/ENTRADA" value={nfe.data_autorizacao ? new Date(nfe.data_autorizacao).toLocaleDateString("pt-BR") : "—"} flex={2} last />
      </div>

      {/* Row 3 */}
      <div style={{ display: "flex", borderBottom: "1px solid #000" }}>
        <Cell label="MUNICÍPIO" value={nfe.dest_municipio || "—"} flex={4} />
        <Cell label="UF" value={nfe.dest_uf || "—"} flex={1} />
        <Cell label="FONE / FAX" value={nfe.dest_telefone || "—"} flex={2} />
        <Cell label="INSCRIÇÃO ESTADUAL" value={nfe.dest_ie || "—"} flex={2} />
        <Cell label="HORA DA SAÍDA" value={nfe.data_autorizacao ? new Date(nfe.data_autorizacao).toLocaleTimeString("pt-BR") : "—"} flex={1} last />
      </div>
    </>
  );
}
