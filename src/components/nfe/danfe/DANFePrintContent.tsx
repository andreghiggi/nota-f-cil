import { DANFeHeader } from "./DANFeHeader";
import { DANFeDestinatario } from "./DANFeDestinatario";
import { DANFeProdutos } from "./DANFeProdutos";
import { DANFeTotais } from "./DANFeTotais";
import { DANFeTransporte } from "./DANFeTransporte";
import { DANFeInfoAdicionais } from "./DANFeInfoAdicionais";

interface DANFePrintContentProps {
  nfe: any;
  itens: any[];
}

export function DANFePrintContent({ nfe, itens }: DANFePrintContentProps) {
  return (
    <div style={{
      fontFamily: "'Times New Roman', Times, serif",
      fontSize: "8pt",
      color: "#000",
      background: "#fff",
      width: "100%",
      maxWidth: "210mm",
      margin: "0 auto",
    }}>
      <div className="danfe" style={{ border: "2px solid #000" }}>
        {/* Homologação warning */}
        {nfe.ambiente === "homologacao" && (
          <div style={{
            background: "#fff3cd",
            border: "2px solid #856404",
            textAlign: "center",
            fontWeight: "bold",
            fontSize: "9pt",
            padding: "3px",
          }}>
            EMITIDA EM AMBIENTE DE HOMOLOGAÇÃO - SEM VALOR FISCAL
          </div>
        )}

        <DANFeHeader nfe={nfe} />

        {/* Natureza da operação + Protocolo */}
        <div style={{ display: "flex", borderBottom: "1px solid #000" }}>
          <Cell label="NATUREZA DA OPERAÇÃO" value={nfe.natureza_operacao || "VENDA"} flex={6} />
          <Cell label="PROTOCOLO DE AUTORIZAÇÃO DE USO" value={
            nfe.protocolo
              ? `${nfe.protocolo} - ${nfe.data_autorizacao ? new Date(nfe.data_autorizacao).toLocaleString("pt-BR") : ""}`
              : "—"
          } flex={4} last />
        </div>

        {/* IE, IE ST, CNPJ */}
        <div style={{ display: "flex", borderBottom: "1px solid #000" }}>
          <Cell label="INSCRIÇÃO ESTADUAL" value={nfe.empresas?.inscricao_estadual || "—"} flex={3} />
          <Cell label="INSCRIÇÃO ESTADUAL DO SUBST. TRIBUT." value="" flex={3} />
          <Cell label="CNPJ" value={formatCNPJ(nfe.empresas?.cnpj || "")} flex={4} last />
        </div>

        {/* Destinatário */}
        <DANFeDestinatario nfe={nfe} />

        {/* Produtos */}
        <DANFeProdutos itens={itens} />

        {/* Totais */}
        <DANFeTotais nfe={nfe} />

        {/* Transporte */}
        <DANFeTransporte nfe={nfe} />

        {/* Informações Adicionais */}
        <DANFeInfoAdicionais nfe={nfe} />

        {/* Status */}
        <div style={{
          textAlign: "center",
          fontWeight: "bold",
          fontSize: "9pt",
          padding: "4px",
          borderTop: "2px solid #000",
        }}>
          {nfe.status === "autorizada" ? "NF-e AUTORIZADA" :
           nfe.status === "cancelada" ? "NF-e CANCELADA" :
           `Status: ${nfe.status?.toUpperCase()}`}
        </div>
      </div>
    </div>
  );
}

// Shared cell component
export function Cell({ label, value, flex = 1, last = false, right = false, large = false }: {
  label: string;
  value: string | number;
  flex?: number;
  last?: boolean;
  right?: boolean;
  large?: boolean;
}) {
  return (
    <div style={{
      flex,
      borderRight: last ? "none" : "1px solid #000",
      padding: "2px 4px",
      minHeight: "20px",
    }}>
      <div style={{ fontSize: "5.5pt", color: "#333", textTransform: "uppercase", lineHeight: 1, marginBottom: "1px" }}>
        {label}
      </div>
      <div style={{
        fontSize: large ? "10pt" : "8pt",
        fontWeight: large ? "bold" : "normal",
        lineHeight: 1.2,
        textAlign: right ? "right" : "left",
        wordBreak: "break-word",
      }}>
        {value}
      </div>
    </div>
  );
}

export function formatCNPJ(cnpj: string) {
  if (!cnpj) return "—";
  return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

export function formatCPFCNPJ(doc: string) {
  if (!doc) return "—";
  if (doc.length === 11) return doc.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  return formatCNPJ(doc);
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

export function formatChave(chave: string) {
  if (!chave) return "—";
  return chave.replace(/(.{4})/g, "$1 ").trim();
}
