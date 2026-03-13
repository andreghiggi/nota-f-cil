import { Cell } from "./DANFePrintContent";

interface DANFeTransporteProps {
  nfe: any;
}

const modalidadeFreteLabels: Record<string, string> = {
  "0": "0 - Por conta do Emitente",
  "1": "1 - Por conta do Destinatário",
  "2": "2 - Por conta de Terceiros",
  "9": "9 - Sem Frete",
};

export function DANFeTransporte({ nfe }: DANFeTransporteProps) {
  const modFrete = nfe.modalidade_frete || "9";

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
        TRANSPORTADOR / VOLUMES TRANSPORTADOS
      </div>

      {/* Row 1 */}
      <div style={{ display: "flex", borderBottom: "1px solid #000" }}>
        <Cell label="MODALIDADE DO FRETE" value={modalidadeFreteLabels[modFrete] || modFrete} flex={3} />
        <Cell label="NOME / RAZÃO SOCIAL" value="—" flex={4} />
        <Cell label="CÓDIGO ANTT" value="" flex={1} />
        <Cell label="PLACA DO VEÍCULO" value="" flex={1} />
        <Cell label="UF" value="" flex={0.5} />
        <Cell label="CNPJ / CPF" value="" flex={2} last />
      </div>

      {/* Row 2 */}
      <div style={{ display: "flex", borderBottom: "1px solid #000" }}>
        <Cell label="ENDEREÇO" value="" flex={5} />
        <Cell label="MUNICÍPIO" value="" flex={3} />
        <Cell label="UF" value="" flex={0.5} />
        <Cell label="INSCRIÇÃO ESTADUAL" value="" flex={2} last />
      </div>

      {/* Row 3 - Volumes */}
      <div style={{ display: "flex", borderBottom: "1px solid #000" }}>
        <Cell label="QUANTIDADE" value="" flex={1} />
        <Cell label="ESPÉCIE" value="" flex={2} />
        <Cell label="MARCA" value="" flex={2} />
        <Cell label="NUMERAÇÃO" value="" flex={1} />
        <Cell label="PESO BRUTO" value="" flex={1} right />
        <Cell label="PESO LÍQUIDO" value="" flex={1} right last />
      </div>
    </>
  );
}
