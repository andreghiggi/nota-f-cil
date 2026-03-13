interface DANFePrintContentProps {
  nfe: any;
  itens: any[];
}

export function DANFePrintContent({ nfe, itens }: DANFePrintContentProps) {
  const emp = nfe.empresas || {};
  const endereco = [emp.logradouro, emp.numero].filter(Boolean).join(", ");
  const endereco2 = [emp.bairro, emp.municipio ? `${emp.municipio} - ${emp.uf}` : ""].filter(Boolean).join(" - ");
  const endereco3 = [emp.cep ? `CEP: ${emp.cep}` : "", emp.telefone ? `Fone: ${emp.telefone}` : ""].filter(Boolean).join(" | ");

  return (
    <div className="danfe-page">
      {/* Homologação */}
      {nfe.ambiente === "homologacao" && (
        <div className="homolog-banner">
          EMITIDA EM AMBIENTE DE HOMOLOGAÇÃO - SEM VALOR FISCAL
        </div>
      )}

      {/* ========== RECIBO ========== */}
      <div className="recibo-area">
        <table cellPadding={0} cellSpacing={0}>
          <tbody>
            <tr>
              <td colSpan={2} style={{ height: "8mm", fontSize: "6.5pt", padding: "2px 4px" }}>
                RECEBEMOS DE <strong style={{ fontFamily: "'Courier New', monospace", fontSize: "7pt" }}>{emp.razao_social || "EMPRESA"}</strong> OS PRODUTOS E/OU SERVIÇOS CONSTANTES NA NOTA FISCAL INDICADA AO LADO.
              </td>
              <td rowSpan={2} style={{ width: "22mm", textAlign: "center", fontSize: "8pt" }}>
                <strong>NF-e</strong><br />
                Nº <strong>{nfe.numero}</strong><br />
                Série <strong>{nfe.serie}</strong>
              </td>
            </tr>
            <tr>
              <td style={{ height: "8mm", width: "38mm" }}>
                <span className="nf-label">DATA DE RECEBIMENTO</span>
                <span className="nf-info">&nbsp;</span>
              </td>
              <td>
                <span className="nf-label">IDENTIFICAÇÃO E ASSINATURA DO RECEBEDOR</span>
                <span className="nf-info">&nbsp;</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <hr className="hr-dashed" />

      {/* ========== HEADER ========== */}
      <table cellPadding={0} cellSpacing={0}>
        <tbody>
          <tr>
            {/* Logo + Emitente */}
            <td style={{ width: "42%" }}>
              <div className="company-name">{emp.razao_social || "EMPRESA"}</div>
              {emp.nome_fantasia && <div className="company-info" style={{ fontWeight: "bold" }}>{emp.nome_fantasia}</div>}
              <div className="company-info">
                {endereco}<br />
                {endereco2}<br />
                {endereco3}
              </div>
            </td>
            {/* DANFE title */}
            <td style={{ width: "20%", textAlign: "center", verticalAlign: "middle" }}>
              <div className="danfe-title">DANFE</div>
              <div className="danfe-subtitle">
                Documento Auxiliar da<br />Nota Fiscal Eletrônica
              </div>
              <div className="danfe-es">
                <span className="box-number">1</span>
                <span className="legenda">
                  0 - Entrada<br />1 - Saída
                </span>
              </div>
              <div className="danfe-num">Nº {nfe.numero}</div>
              <div className="danfe-serie-page">SÉRIE: {nfe.serie}</div>
              <div className="danfe-serie-page">Página 1 de 1</div>
            </td>
            {/* Chave de acesso */}
            <td style={{ width: "38%" }}>
              <div className="chave-box">
                {nfe.chave_acesso && (
                  <div className="chave-barcode">{nfe.chave_acesso}</div>
                )}
                <div className="chave-label">CHAVE DE ACESSO</div>
                <div className="chave-value">
                  {nfe.chave_acesso ? formatChave(nfe.chave_acesso) : "—"}
                </div>
                <div className="chave-consulta">
                  Consulta de autenticidade no portal nacional da NF-e<br />
                  www.nfe.fazenda.gov.br/portal
                </div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* ========== NATUREZA + PROTOCOLO ========== */}
      <table cellPadding={0} cellSpacing={0} className="no-top">
        <tbody>
          <tr>
            <td colSpan={2}>
              <span className="nf-label">NATUREZA DA OPERAÇÃO</span>
              <span className="nf-info">{nfe.natureza_operacao || "VENDA"}</span>
            </td>
            <td style={{ width: "38%" }}>
              <span className="nf-label">PROTOCOLO DE AUTORIZAÇÃO DE USO</span>
              <span className="nf-info">
                {nfe.protocolo
                  ? `${nfe.protocolo} - ${nfe.data_autorizacao ? new Date(nfe.data_autorizacao).toLocaleString("pt-BR") : ""}`
                  : ""}
              </span>
            </td>
          </tr>
          <tr>
            <td>
              <span className="nf-label">INSCRIÇÃO ESTADUAL</span>
              <span className="nf-info">{emp.inscricao_estadual || ""}</span>
            </td>
            <td style={{ width: "32%" }}>
              <span className="nf-label">INSCRIÇÃO ESTADUAL DO SUBST. TRIB.</span>
              <span className="nf-info">&nbsp;</span>
            </td>
            <td>
              <span className="nf-label">CNPJ</span>
              <span className="nf-info">{emp.cnpj ? formatCNPJ(emp.cnpj) : ""}</span>
            </td>
          </tr>
        </tbody>
      </table>

      {/* ========== DESTINATÁRIO ========== */}
      <table cellPadding={0} cellSpacing={0} className="no-top">
        <tbody>
          <tr>
            <td rowSpan={3} className="black-label">DESTINATÁRIO/REMETENTE</td>
            <td colSpan={3}>
              <span className="nf-label">NOME/RAZÃO SOCIAL</span>
              <span className="nf-info">{nfe.dest_nome || "CONSUMIDOR NÃO IDENTIFICADO"}</span>
            </td>
            <td style={{ width: "18%" }}>
              <span className="nf-label">CNPJ/CPF</span>
              <span className="nf-info">{formatCPFCNPJ(nfe.dest_cpf_cnpj || "")}</span>
            </td>
            <td style={{ width: "14%" }}>
              <span className="nf-label">DATA DE EMISSÃO</span>
              <span className="nf-info">{new Date(nfe.data_emissao).toLocaleDateString("pt-BR")}</span>
            </td>
          </tr>
          <tr>
            <td>
              <span className="nf-label">ENDEREÇO</span>
              <span className="nf-info">{[nfe.dest_logradouro, nfe.dest_numero].filter(Boolean).join(", ") || ""}</span>
            </td>
            <td colSpan={2}>
              <span className="nf-label">BAIRRO/DISTRITO</span>
              <span className="nf-info">{nfe.dest_bairro || ""}</span>
            </td>
            <td>
              <span className="nf-label">CEP</span>
              <span className="nf-info">{nfe.dest_cep || ""}</span>
            </td>
            <td>
              <span className="nf-label">DATA ENTR./SAÍDA</span>
              <span className="nf-info">{nfe.data_autorizacao ? new Date(nfe.data_autorizacao).toLocaleDateString("pt-BR") : ""}</span>
            </td>
          </tr>
          <tr>
            <td>
              <span className="nf-label">MUNICÍPIO</span>
              <span className="nf-info">{nfe.dest_municipio || ""}</span>
            </td>
            <td>
              <span className="nf-label">FONE/FAX</span>
              <span className="nf-info">{nfe.dest_telefone || ""}</span>
            </td>
            <td>
              <span className="nf-label">UF</span>
              <span className="nf-info">{nfe.dest_uf || ""}</span>
            </td>
            <td>
              <span className="nf-label">INSCRIÇÃO ESTADUAL</span>
              <span className="nf-info">{nfe.dest_ie || ""}</span>
            </td>
            <td>
              <span className="nf-label">HORA ENTR./SAÍDA</span>
              <span className="nf-info">{nfe.data_autorizacao ? new Date(nfe.data_autorizacao).toLocaleTimeString("pt-BR") : ""}</span>
            </td>
          </tr>
        </tbody>
      </table>

      {/* ========== FATURA ========== */}
      <table cellPadding={0} cellSpacing={0} className="no-top">
        <tbody>
          <tr>
            <td className="black-label" style={{ height: "6mm" }}>FATURA</td>
            <td style={{ padding: "2px 4px", fontSize: "7pt" }}>&nbsp;</td>
          </tr>
        </tbody>
      </table>

      {/* ========== CÁLCULO DO IMPOSTO ========== */}
      <table cellPadding={0} cellSpacing={0} className="no-top">
        <tbody>
          <tr>
            <td rowSpan={2} className="black-label">CÁLCULO DO IMPOSTO</td>
            <td>
              <span className="nf-label">BASE DE CÁLCULO DO ICMS</span>
              <span className="nf-info-right">{fc(nfe.valor_icms || 0)}</span>
            </td>
            <td>
              <span className="nf-label">VALOR DO ICMS</span>
              <span className="nf-info-right">{fc(nfe.valor_icms || 0)}</span>
            </td>
            <td>
              <span className="nf-label">BASE DE CÁLCULO DO ICMS ST</span>
              <span className="nf-info-right">{fc(0)}</span>
            </td>
            <td>
              <span className="nf-label">VALOR DO ICMS ST</span>
              <span className="nf-info-right">{fc(0)}</span>
            </td>
            <td>
              <span className="nf-label">VALOR TOTAL DOS PRODUTOS</span>
              <span className="nf-info-right">{fc(nfe.valor_produtos || 0)}</span>
            </td>
          </tr>
          <tr>
            <td>
              <span className="nf-label">VALOR DO FRETE</span>
              <span className="nf-info-right">{fc(nfe.valor_frete || 0)}</span>
            </td>
            <td>
              <span className="nf-label">VALOR DO SEGURO</span>
              <span className="nf-info-right">{fc(nfe.valor_seguro || 0)}</span>
            </td>
            <td>
              <span className="nf-label">DESCONTO</span>
              <span className="nf-info-right">{fc(nfe.valor_desconto || 0)}</span>
            </td>
            <td>
              <span className="nf-label">OUTRAS DESP. ACESSÓRIAS</span>
              <span className="nf-info-right">{fc(nfe.valor_outras_despesas || 0)}</span>
            </td>
            <td>
              <span className="nf-label">VALOR DO IPI</span>
              <span className="nf-info-right">{fc(nfe.valor_ipi || 0)}</span>
            </td>
          </tr>
          <tr>
            <td className="black-label" style={{ height: "auto" }}>&nbsp;</td>
            <td colSpan={3}>
              <span className="nf-label">VALOR APROX. DOS TRIBUTOS</span>
              <span className="nf-info-right">{fc((nfe.valor_icms || 0) + (nfe.valor_pis || 0) + (nfe.valor_cofins || 0) + (nfe.valor_ipi || 0))}</span>
            </td>
            <td colSpan={2}>
              <span className="nf-label">VALOR TOTAL DA NOTA</span>
              <span className="nf-info-lg" style={{ textAlign: "right" }}>{fc(nfe.valor_total)}</span>
            </td>
          </tr>
        </tbody>
      </table>

      {/* ========== TRANSPORTADOR ========== */}
      <table cellPadding={0} cellSpacing={0} className="no-top">
        <tbody>
          <tr>
            <td rowSpan={3} className="black-label">TRANSPORTADOR / VOLUMES</td>
            <td colSpan={2}>
              <span className="nf-label">RAZÃO SOCIAL</span>
              <span className="nf-info">&nbsp;</span>
            </td>
            <td>
              <span className="nf-label">FRETE POR CONTA</span>
              <span className="nf-info">{freteLabel(nfe.modalidade_frete)}</span>
            </td>
            <td>
              <span className="nf-label">CÓDIGO ANTT</span>
              <span className="nf-info">&nbsp;</span>
            </td>
            <td>
              <span className="nf-label">PLACA</span>
              <span className="nf-info">&nbsp;</span>
            </td>
            <td style={{ width: "5%" }}>
              <span className="nf-label">UF</span>
              <span className="nf-info">&nbsp;</span>
            </td>
            <td>
              <span className="nf-label">CNPJ/CPF</span>
              <span className="nf-info">&nbsp;</span>
            </td>
          </tr>
          <tr>
            <td colSpan={2}>
              <span className="nf-label">ENDEREÇO</span>
              <span className="nf-info">&nbsp;</span>
            </td>
            <td colSpan={2}>
              <span className="nf-label">MUNICÍPIO</span>
              <span className="nf-info">&nbsp;</span>
            </td>
            <td>
              <span className="nf-label">UF</span>
              <span className="nf-info">&nbsp;</span>
            </td>
            <td colSpan={2}>
              <span className="nf-label">INSC. ESTADUAL</span>
              <span className="nf-info">&nbsp;</span>
            </td>
          </tr>
          <tr>
            <td>
              <span className="nf-label">QUANTIDADE</span>
              <span className="nf-info">&nbsp;</span>
            </td>
            <td>
              <span className="nf-label">ESPÉCIE</span>
              <span className="nf-info">&nbsp;</span>
            </td>
            <td>
              <span className="nf-label">MARCA</span>
              <span className="nf-info">&nbsp;</span>
            </td>
            <td>
              <span className="nf-label">NUMERAÇÃO</span>
              <span className="nf-info">&nbsp;</span>
            </td>
            <td>
              <span className="nf-label">PESO BRUTO</span>
              <span className="nf-info">&nbsp;</span>
            </td>
            <td colSpan={2}>
              <span className="nf-label">PESO LÍQUIDO</span>
              <span className="nf-info">&nbsp;</span>
            </td>
          </tr>
        </tbody>
      </table>

      {/* ========== DADOS DO PRODUTO ========== */}
      <table cellPadding={0} cellSpacing={0} className="no-top">
        <tbody>
          <tr>
            <td className="black-label" rowSpan={2}>DADOS DO PRODUTO/SERVIÇO</td>
            <td style={{ padding: 0, border: "none" }}>
              <table cellPadding={0} cellSpacing={0} style={{ borderTop: "none" }}>
                <thead>
                  <tr className="products-header">
                    <td style={{ width: "9%" }}>CÓDIGO</td>
                    <td style={{ width: "26%" }}>DESCRIÇÃO DO PRODUTO/SERVIÇO</td>
                    <td style={{ width: "6%" }}>NCM/SH</td>
                    <td style={{ width: "4%" }}>CST</td>
                    <td style={{ width: "4%" }}>CFOP</td>
                    <td style={{ width: "3%" }}>UN</td>
                    <td style={{ width: "7%" }}>QTD.</td>
                    <td style={{ width: "8%" }}>VLR.UNIT.</td>
                    <td style={{ width: "8%" }}>VLR.TOTAL</td>
                    <td style={{ width: "7%" }}>BC ICMS</td>
                    <td style={{ width: "7%" }}>VLR.ICMS</td>
                    <td style={{ width: "6%" }}>VLR.IPI</td>
                    <td style={{ width: "5%" }}>ALÍQ.ICMS</td>
                    <td style={{ width: "5%" }}>ALÍQ.IPI</td>
                  </tr>
                </thead>
                <tbody>
                  {itens.map((item: any) => (
                    <tr key={item.id} className="products-body">
                      <td>{item.codigo_produto}</td>
                      <td>{item.descricao}</td>
                      <td className="center">{item.ncm || ""}</td>
                      <td className="center">{item.cst_icms || item.csosn || ""}</td>
                      <td className="center">{item.cfop}</td>
                      <td className="center">{item.unidade}</td>
                      <td className="right">{fc(Number(item.quantidade))}</td>
                      <td className="right">{fc(Number(item.valor_unitario))}</td>
                      <td className="right">{fc(Number(item.valor_total))}</td>
                      <td className="right">{item.valor_icms ? fc(Number(item.valor_total)) : ""}</td>
                      <td className="right">{item.valor_icms ? fc(Number(item.valor_icms)) : ""}</td>
                      <td className="right">{item.valor_ipi ? fc(Number(item.valor_ipi)) : ""}</td>
                      <td className="right">{item.aliquota_icms ? `${Number(item.aliquota_icms).toFixed(2)}` : ""}</td>
                      <td className="right">{item.aliquota_ipi ? `${Number(item.aliquota_ipi).toFixed(2)}` : ""}</td>
                    </tr>
                  ))}
                  {/* Empty rows */}
                  {itens.length < 8 && Array.from({ length: 8 - itens.length }).map((_, i) => (
                    <tr key={`e-${i}`} className="products-body">
                      {Array.from({ length: 14 }).map((_, j) => (
                        <td key={j}>&nbsp;</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>

      {/* ========== ISSQN ========== */}
      <table cellPadding={0} cellSpacing={0} className="no-top">
        <tbody>
          <tr>
            <td>
              <span className="nf-label">INSCRIÇÃO MUNICIPAL</span>
              <span className="nf-info">&nbsp;</span>
            </td>
            <td>
              <span className="nf-label">VALOR TOTAL DOS SERVIÇOS</span>
              <span className="nf-info-right">&nbsp;</span>
            </td>
            <td>
              <span className="nf-label">BASE DE CÁLCULO DO ISSQN</span>
              <span className="nf-info-right">&nbsp;</span>
            </td>
            <td>
              <span className="nf-label">VALOR DO ISSQN</span>
              <span className="nf-info-right">&nbsp;</span>
            </td>
          </tr>
        </tbody>
      </table>

      {/* ========== INFORMAÇÕES COMPLEMENTARES ========== */}
      <table cellPadding={0} cellSpacing={0} className="no-top info-adicional">
        <tbody>
          <tr>
            <td colSpan={2} style={{ width: "60%", minHeight: "20mm", height: "20mm" }}>
              <span className="nf-label">INFORMAÇÕES COMPLEMENTARES</span>
              <span className="nf-info" style={{ fontSize: "6.5pt", lineHeight: 1.3 }}>
                {buildInfoComplementar(nfe)}
              </span>
            </td>
            <td colSpan={2} style={{ width: "40%", minHeight: "20mm" }}>
              <span className="nf-label">RESERVADO AO FISCO</span>
              <span className="nf-info">&nbsp;</span>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Status */}
      <div className="status-footer">
        {nfe.status === "autorizada" ? "NF-e AUTORIZADA" :
         nfe.status === "cancelada" ? "NF-e CANCELADA" :
         `Status: ${nfe.status?.toUpperCase()}`}
      </div>
    </div>
  );
}

function fc(value: number) {
  return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

function formatCNPJ(cnpj: string) {
  if (!cnpj) return "";
  return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

function formatCPFCNPJ(doc: string) {
  if (!doc) return "";
  if (doc.length === 11) return doc.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  return formatCNPJ(doc);
}

function formatChave(chave: string) {
  if (!chave) return "";
  return chave.replace(/(.{4})/g, "$1 ").trim();
}

function freteLabel(mod: string) {
  const labels: Record<string, string> = {
    "0": "0-Emitente",
    "1": "1-Dest/Rem",
    "2": "2-Terceiros",
    "9": "9-Sem Frete",
  };
  return labels[mod] || mod || "9-Sem Frete";
}

function buildInfoComplementar(nfe: any) {
  const parts: string[] = [];
  if (nfe.valor_pis) parts.push(`PIS: ${fc(nfe.valor_pis)}`);
  if (nfe.valor_cofins) parts.push(`COFINS: ${fc(nfe.valor_cofins)}`);
  if (nfe.dest_email) parts.push(`Email: ${nfe.dest_email}`);
  return parts.join(" | ") || "";
}
