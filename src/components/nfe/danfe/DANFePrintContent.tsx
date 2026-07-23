interface DANFePrintContentProps {
  nfe: any;
  itens: any[];
}

export function DANFePrintContent({ nfe, itens }: DANFePrintContentProps) {
  const emp = nfe.empresas || {};
  const endereco = [emp.logradouro, emp.numero].filter(Boolean).join(", ");
  const endereco2 = [emp.bairro, emp.municipio ? `${emp.municipio} - ${emp.uf}` : ""].filter(Boolean).join(" - ");
  const endereco3 = [emp.cep ? `CEP: ${formatCEP(emp.cep)}` : "", emp.telefone ? `Fone: ${emp.telefone}` : ""].filter(Boolean).join(" | ");

  const tipoNF = nfe.finalidade === "entrada" ? "0" : "1";

  return (
    <div className="danfe-page">
      {/* Homologação */}
      {nfe.ambiente === "homologacao" && (
        <div className="homolog-banner">
          EMITIDA EM AMBIENTE DE HOMOLOGAÇÃO - SEM VALOR FISCAL
        </div>
      )}

      {/* ========== RECIBO (fora da borda principal conceitualmente, mas dentro da page) ========== */}
      <div className="recibo-area">
        <table cellPadding={0} cellSpacing={0} style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            <tr>
              <td colSpan={2} style={{ border: "1px solid #000", borderTop: "none", borderLeft: "none", borderRight: "none", height: "7mm", fontSize: "6pt", padding: "1px 3px", verticalAlign: "top" }}>
                <span style={{ fontSize: "5pt", textTransform: "uppercase" }}>Recebemos de </span>
                <strong style={{ fontFamily: "'Courier New', monospace", fontSize: "6.5pt" }}>{(emp.razao_social || "EMPRESA").slice(0, 60)}</strong>
                <span style={{ fontSize: "5pt" }}> os produtos e/ou serviços constantes na Nota Fiscal indicada ao lado.</span>
              </td>
              <td rowSpan={2} style={{ border: "1px solid #000", borderTop: "none", borderRight: "none", width: "20mm", textAlign: "center", fontSize: "7pt", verticalAlign: "middle", padding: "2px" }}>
                <strong>NF-e</strong><br />
                Nº <strong>{nfe.numero}</strong><br />
                Série <strong>{nfe.serie}</strong>
              </td>
            </tr>
            <tr>
              <td style={{ border: "1px solid #000", borderLeft: "none", width: "32mm" }}>
                <span className="nf-label">DATA DE RECEBIMENTO</span>
                <span className="nf-info">&nbsp;</span>
              </td>
              <td style={{ border: "1px solid #000" }}>
                <span className="nf-label">IDENTIFICAÇÃO E ASSINATURA DO RECEBEDOR</span>
                <span className="nf-info">&nbsp;</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <hr className="hr-dashed" />

      {/* ========== CABEÇALHO ========== */}
      <table cellPadding={0} cellSpacing={0} className="danfe-section">
        <tbody>
          <tr className="header-row">
            {/* Emitente */}
            <td style={{ width: "40%", verticalAlign: "top" }}>
              <div className="company-name">{(emp.razao_social || "EMPRESA").slice(0, 60)}</div>
              {emp.nome_fantasia && <div className="company-info" style={{ fontWeight: "bold" }}>{emp.nome_fantasia.slice(0, 60)}</div>}
              <div className="company-info">
                {endereco}<br />
                {endereco2}<br />
                {endereco3}
              </div>
            </td>
            {/* DANFE central */}
            <td style={{ width: "22%", verticalAlign: "top" }} className="danfe-center-col">
              <div className="danfe-title">DANFE</div>
              <div className="danfe-subtitle">
                Documento Auxiliar da<br />Nota Fiscal Eletrônica
              </div>
              <div className="danfe-es">
                <span className="box-number">{tipoNF}</span>
                <span className="legenda">
                  0 - Entrada<br />1 - Saída
                </span>
              </div>
              <div className="danfe-num">Nº {String(nfe.numero).padStart(9, "0")}</div>
              <div className="danfe-serie-page">SÉRIE {nfe.serie} &nbsp; FOLHA 1/1</div>
            </td>
            {/* Chave de acesso + código de barras */}
            <td style={{ width: "38%", verticalAlign: "top" }}>
              <div className="chave-box">
                <div className="chave-barcode">
                  {nfe.chave_acesso ? (
                    <span className="chave-barcode-text">{nfe.chave_acesso}</span>
                  ) : (
                    <span style={{ fontSize: "7pt", color: "#999" }}>CÓDIGO DE BARRAS</span>
                  )}
                </div>
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
      <table cellPadding={0} cellSpacing={0} className="danfe-section no-top">
        <tbody>
          <tr>
            <td style={{ width: "62%" }}>
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
            <td colSpan={2}>
              <table cellPadding={0} cellSpacing={0} style={{ width: "100%", borderCollapse: "collapse" }}>
                <tbody>
                  <tr>
                    <td style={{ width: "33%", border: "none", borderRight: "1px solid #000" }}>
                      <span className="nf-label">INSCRIÇÃO ESTADUAL</span>
                      <span className="nf-info">{emp.inscricao_estadual || ""}</span>
                    </td>
                    <td style={{ width: "33%", border: "none", borderRight: "1px solid #000" }}>
                      <span className="nf-label">INSCRIÇÃO ESTADUAL DO SUBST. TRIB.</span>
                      <span className="nf-info">&nbsp;</span>
                    </td>
                    <td style={{ border: "none" }}>
                      <span className="nf-label">CNPJ</span>
                      <span className="nf-info">{formatCPFCNPJ(emp.cnpj || emp.cpf || "")}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>

      {/* ========== DESTINATÁRIO ========== */}
      <table cellPadding={0} cellSpacing={0} className="danfe-section no-top">
        <tbody>
          <tr>
            <td rowSpan={3} className="black-label">DESTINATÁRIO / REMETENTE</td>
            <td style={{ width: "48%" }}>
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
            <td>
              <span className="nf-label">BAIRRO/DISTRITO</span>
              <span className="nf-info">{nfe.dest_bairro || ""}</span>
            </td>
            <td>
              <span className="nf-label">CEP</span>
              <span className="nf-info">{formatCEP(nfe.dest_cep || "")}</span>
            </td>
          </tr>
          <tr>
            <td>
              <table cellPadding={0} cellSpacing={0} style={{ width: "100%", borderCollapse: "collapse" }}>
                <tbody>
                  <tr>
                    <td style={{ width: "60%", border: "none", borderRight: "1px solid #000" }}>
                      <span className="nf-label">MUNICÍPIO</span>
                      <span className="nf-info">{nfe.dest_municipio || ""}</span>
                    </td>
                    <td style={{ border: "none" }}>
                      <span className="nf-label">FONE/FAX</span>
                      <span className="nf-info">{nfe.dest_telefone || ""}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
            <td>
              <table cellPadding={0} cellSpacing={0} style={{ width: "100%", borderCollapse: "collapse" }}>
                <tbody>
                  <tr>
                    <td style={{ width: "25%", border: "none", borderRight: "1px solid #000" }}>
                      <span className="nf-label">UF</span>
                      <span className="nf-info">{nfe.dest_uf || ""}</span>
                    </td>
                    <td style={{ border: "none" }}>
                      <span className="nf-label">INSCRIÇÃO ESTADUAL</span>
                      <span className="nf-info">{nfe.dest_ie || ""}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
            <td>
              <span className="nf-label">DATA ENTRADA/SAÍDA</span>
              <span className="nf-info">{nfe.data_autorizacao ? new Date(nfe.data_autorizacao).toLocaleDateString("pt-BR") : ""}</span>
            </td>
          </tr>
        </tbody>
      </table>

      {/* ========== FATURA / DUPLICATAS ========== */}
      <table cellPadding={0} cellSpacing={0} className="danfe-section no-top">
        <tbody>
          <tr>
            <td className="black-label" style={{ height: "5mm" }}>FATURA / DUPLICATAS</td>
            <td style={{ padding: "1px 3px", fontSize: "6.5pt" }}>&nbsp;</td>
          </tr>
        </tbody>
      </table>

      {/* ========== CÁLCULO DO IMPOSTO ========== */}
      <table cellPadding={0} cellSpacing={0} className="danfe-section no-top">
        <tbody>
          <tr>
            <td rowSpan={2} className="black-label">CÁLCULO DO IMPOSTO</td>
            <td>
              <span className="nf-label">BASE DE CÁLC. DO ICMS</span>
              <span className="nf-info-right">{fc(calcBaseICMS(itens))}</span>
            </td>
            <td>
              <span className="nf-label">VALOR DO ICMS</span>
              <span className="nf-info-right">{fc(nfe.valor_icms || 0)}</span>
            </td>
            <td>
              <span className="nf-label">BASE DE CÁLC. ICMS ST</span>
              <span className="nf-info-right">{fc(calcBaseICMSST(itens))}</span>
            </td>
            <td>
              <span className="nf-label">VALOR DO ICMS ST</span>
              <span className="nf-info-right">{fc(calcICMSST(itens))}</span>
            </td>
            <td>
              <span className="nf-label">V. TOTAL PRODUTOS</span>
              <span className="nf-info-right">{fc(nfe.valor_produtos || nfe.valor_total || 0)}</span>
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
              <span className="nf-label">OUTRAS DESP.</span>
              <span className="nf-info-right">{fc(nfe.valor_outras_despesas || 0)}</span>
            </td>
            <td>
              <span className="nf-label">VALOR DO IPI</span>
              <span className="nf-info-right">{fc(nfe.valor_ipi || 0)}</span>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Tributos + Total NF */}
      <table cellPadding={0} cellSpacing={0} className="danfe-section no-top">
        <tbody>
          <tr>
            <td style={{ width: "6mm" }}>&nbsp;</td>
            <td style={{ width: "55%" }}>
              <span className="nf-label">VALOR APROX. DOS TRIBUTOS</span>
              <span className="nf-info-right">{fc((nfe.valor_icms || 0) + (nfe.valor_pis || 0) + (nfe.valor_cofins || 0) + (nfe.valor_ipi || 0))}</span>
            </td>
            <td>
              <span className="nf-label">VALOR TOTAL DA NOTA FISCAL</span>
              <span className="nf-info-lg" style={{ textAlign: "right" }}>{fc(nfe.valor_total)}</span>
            </td>
          </tr>
        </tbody>
      </table>

      {/* ========== TRANSPORTADOR ========== */}
      {(() => {
        const p = nfe.payload_entrada || {};
        const tSrc = nfe.transporte || p.transporte || p.transp || p.transportador || p.transportadora || {};
        const tr = tSrc.transportadora || tSrc.transporta || tSrc || {};
        const veic = tSrc.veiculo || tSrc.veicTransp || tSrc || {};
        const vol = Array.isArray(tSrc.volumes) ? (tSrc.volumes[0] || {}) : (tSrc.vol || {});
        const trDoc = String(tr.cnpj || tr.CNPJ || tr.cpf || tr.CPF || tr.cnpj_cpf || "").replace(/\D/g, "");
        const trIE = String(tr.ie || tr.IE || tr.inscricao_estadual || "").replace(/\D/g, "");
        const placa = String(veic.placa || veic.placa_veiculo || "").toUpperCase();
        const ufVeic = veic.uf_veiculo || veic.UF || veic.uf || "";
        const rntc = veic.rntc || veic.RNTC || "";
        return (
          <table cellPadding={0} cellSpacing={0} className="danfe-section no-top">
            <tbody>
              <tr>
                <td rowSpan={3} className="black-label">TRANSPORTADOR / VOLUMES TRANSPORTADOS</td>
                <td style={{ width: "30%" }}>
                  <span className="nf-label">RAZÃO SOCIAL</span>
                  <span className="nf-info">{tr.razao_social || tr.nome || tr.xNome || ""}</span>
                </td>
                <td style={{ width: "15%" }}>
                  <span className="nf-label">FRETE POR CONTA</span>
                  <span className="nf-info">{freteLabel(nfe.modalidade_frete)}</span>
                </td>
                <td style={{ width: "10%" }}>
                  <span className="nf-label">CÓDIGO ANTT</span>
                  <span className="nf-info">{rntc}</span>
                </td>
                <td style={{ width: "10%" }}>
                  <span className="nf-label">PLACA VEÍCULO</span>
                  <span className="nf-info">{placa}</span>
                </td>
                <td style={{ width: "5%" }}>
                  <span className="nf-label">UF</span>
                  <span className="nf-info">{ufVeic}</span>
                </td>
                <td>
                  <span className="nf-label">CNPJ/CPF</span>
                  <span className="nf-info">{formatCPFCNPJ(trDoc)}</span>
                </td>
              </tr>
              <tr>
                <td colSpan={2}>
                  <span className="nf-label">ENDEREÇO</span>
                  <span className="nf-info">{tr.endereco || tr.xEnder || ""}</span>
                </td>
                <td colSpan={2}>
                  <span className="nf-label">MUNICÍPIO</span>
                  <span className="nf-info">{tr.municipio || tr.cidade || tr.xMun || ""}</span>
                </td>
                <td>
                  <span className="nf-label">UF</span>
                  <span className="nf-info">{tr.uf || tr.UF || ""}</span>
                </td>
                <td>
                  <span className="nf-label">INSC. ESTADUAL</span>
                  <span className="nf-info">{trIE}</span>
                </td>
              </tr>
              <tr>
                <td>
                  <span className="nf-label">QUANTIDADE</span>
                  <span className="nf-info">{vol.qVol || vol.quantidade || ""}</span>
                </td>
                <td>
                  <span className="nf-label">ESPÉCIE</span>
                  <span className="nf-info">{vol.esp || vol.especie || ""}</span>
                </td>
                <td>
                  <span className="nf-label">MARCA</span>
                  <span className="nf-info">{vol.marca || ""}</span>
                </td>
                <td>
                  <span className="nf-label">NUMERAÇÃO</span>
                  <span className="nf-info">{vol.nVol || vol.numeracao || ""}</span>
                </td>
                <td>
                  <span className="nf-label">PESO BRUTO</span>
                  <span className="nf-info">{vol.pesoB || vol.peso_bruto || ""}</span>
                </td>
                <td>
                  <span className="nf-label">PESO LÍQUIDO</span>
                  <span className="nf-info">{vol.pesoL || vol.peso_liquido || ""}</span>
                </td>
              </tr>
            </tbody>
          </table>
        );
      })()}

      {/* ========== DADOS DO PRODUTO ========== */}
      <table cellPadding={0} cellSpacing={0} className="danfe-section no-top">
        <tbody>
          <tr>
            <td className="black-label" rowSpan={1}>DADOS DO PRODUTO / SERVIÇO</td>
            <td className="products-wrapper">
              <table cellPadding={0} cellSpacing={0} className="products-table">
                <thead>
                  <tr className="products-header">
                    <td style={{ width: "8%" }}>CÓD. PROD.</td>
                    <td style={{ width: "24%" }}>DESCRIÇÃO DO PRODUTO/SERVIÇO</td>
                    <td style={{ width: "6%" }}>NCM/SH</td>
                    <td style={{ width: "4%" }}>CST</td>
                    <td style={{ width: "4%" }}>CFOP</td>
                    <td style={{ width: "3%" }}>UN</td>
                    <td style={{ width: "7%" }}>QUANT.</td>
                    <td style={{ width: "8%" }}>VL.UNITÁRIO</td>
                    <td style={{ width: "8%" }}>VL.TOTAL</td>
                    <td style={{ width: "7%" }}>B.CÁLC.ICMS</td>
                    <td style={{ width: "7%" }}>VL.ICMS</td>
                    <td style={{ width: "5%" }}>VL.IPI</td>
                    <td style={{ width: "4.5%" }}>%ICMS</td>
                    <td style={{ width: "4.5%" }}>%IPI</td>
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
                      <td className="right">{fq(Number(item.quantidade))}</td>
                      <td className="right">{fv(Number(item.valor_unitario))}</td>
                      <td className="right">{fc(Number(item.valor_total))}</td>
                      <td className="right">{item.base_calculo_icms ? fc(Number(item.base_calculo_icms)) : (item.valor_icms ? fc(Number(item.valor_total)) : "")}</td>
                      <td className="right">{item.valor_icms ? fc(Number(item.valor_icms)) : ""}</td>
                      <td className="right">{item.valor_ipi ? fc(Number(item.valor_ipi)) : ""}</td>
                      <td className="right">{item.aliquota_icms ? `${Number(item.aliquota_icms).toFixed(2)}` : ""}</td>
                      <td className="right">{item.aliquota_ipi ? `${Number(item.aliquota_ipi).toFixed(2)}` : ""}</td>
                    </tr>
                  ))}
                  {/* Linhas vazias para preencher mínimo */}
                  {itens.length < 5 && Array.from({ length: 5 - itens.length }).map((_, i) => (
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
      <table cellPadding={0} cellSpacing={0} className="danfe-section no-top">
        <tbody>
          <tr>
            <td className="black-label">CÁLCULO DO ISSQN</td>
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

      {/* ========== FATURA / DUPLICATAS ========== */}
      {(() => {
        const cobr = nfe.payload_entrada?.cobranca || nfe.payload_entrada?.cobr || null;
        const dupRaw = cobr?.dup || cobr?.duplicatas || nfe.payload_entrada?.duplicatas || nfe.payload_entrada?.parcelas || [];
        const dups = (Array.isArray(dupRaw) ? dupRaw : Object.values(dupRaw || {})).map((d: any, i: number) => ({
          nDup: String(d?.nDup ?? d?.numero ?? String(i + 1).padStart(3, "0")),
          dVenc: d?.dVenc ?? d?.data_vencimento ?? d?.vencimento ?? "",
          vDup: Number(d?.vDup ?? d?.valor ?? 0),
        })).filter((d) => d.dVenc && d.vDup > 0);
        if (dups.length === 0) return null;
        return (
          <table cellPadding={0} cellSpacing={0} className="danfe-section no-top">
            <tbody>
              <tr>
                <td className="black-label" style={{ width: "12mm" }}>FATURA / DUPLICATAS</td>
                <td style={{ padding: "2px 4px", verticalAlign: "top" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "6.5pt" }}>
                    <tbody>
                      {Array.from({ length: Math.ceil(dups.length / 4) }).map((_, row) => (
                        <tr key={row}>
                          {dups.slice(row * 4, row * 4 + 4).map((d, j) => (
                            <td key={j} style={{ border: "1px solid #000", padding: "2px 4px", width: "25%" }}>
                              <span className="nf-label">N° {d.nDup}</span>
                              <span className="nf-info">Venc.: {formatDateBR(d.dVenc)} — {fc(d.vDup)}</span>
                            </td>
                          ))}
                          {Array.from({ length: 4 - dups.slice(row * 4, row * 4 + 4).length }).map((_, k) => (
                            <td key={`e-${k}`} style={{ border: "1px solid #000", padding: "2px 4px", width: "25%" }}>&nbsp;</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </td>
              </tr>
            </tbody>
          </table>
        );
      })()}

      {/* ========== INFORMAÇÕES COMPLEMENTARES ========== */}
      <table cellPadding={0} cellSpacing={0} className="danfe-section no-top">
        <tbody>
          <tr>
            <td className="black-label">DADOS ADICIONAIS</td>
            <td style={{ width: "58%", minHeight: "18mm", height: "18mm", verticalAlign: "top" }}>
              <span className="nf-label">INFORMAÇÕES COMPLEMENTARES</span>
              <span className="nf-info" style={{ fontSize: "6pt", lineHeight: "1.3" }}>
                {buildInfoComplementar(nfe)}
              </span>
            </td>
            <td style={{ minHeight: "18mm", verticalAlign: "top" }}>
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

// ===== Helpers =====

function fc(value: number) {
  return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

function fq(value: number) {
  return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 4 }).format(value);
}

function fv(value: number) {
  return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 4 }).format(value);
}

function formatCNPJ(cnpj: string) {
  if (!cnpj) return "";
  return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

function formatCPFCNPJ(doc: string) {
  if (!doc) return "";
  const clean = doc.replace(/\D/g, "");
  if (clean.length === 11) return clean.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  return formatCNPJ(clean);
}

function formatCEP(cep: string) {
  if (!cep) return "";
  const clean = cep.replace(/\D/g, "");
  if (clean.length === 8) return clean.replace(/^(\d{5})(\d{3})$/, "$1-$2");
  return cep;
}

function formatDateBR(d: string) {
  if (!d) return "";
  const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return d;
}

function formatChave(chave: string) {
  if (!chave) return "";
  return chave.replace(/(.{4})/g, "$1 ").trim();
}

function freteLabel(mod: string) {
  const labels: Record<string, string> = {
    "0": "0 - Emitente",
    "1": "1 - Dest/Rem",
    "2": "2 - Terceiros",
    "3": "3 - Próprio Rem",
    "4": "4 - Próprio Dest",
    "9": "9 - Sem Frete",
  };
  return labels[mod] || mod || "9 - Sem Frete";
}

function calcBaseICMS(itens: any[]) {
  return itens.reduce((sum, item) => sum + (Number(item.base_calculo_icms) || 0), 0);
}

function calcBaseICMSST(itens: any[]) {
  return itens.reduce((sum, item) => sum + (Number(item.base_calculo_icms_st) || 0), 0);
}

function calcICMSST(itens: any[]) {
  return itens.reduce((sum, item) => sum + (Number(item.valor_icms_st) || 0), 0);
}

function buildInfoComplementar(nfe: any) {
  const parts: string[] = [];
  const p = nfe.payload_entrada || {};
  const infCpl = nfe.inf_cpl
    || p.inf_cpl || p.infCpl
    || p.informacoes_complementares
    || p.informacoes_adicionais_contribuinte
    || p.informacoes_adicionais
    || p.info_adicional
    || p.observacoes;
  if (infCpl) parts.push(String(infCpl));

  // Endereço de entrega (quando diferente do destinatário)
  const ent = nfe.entrega || p.entrega || p.endereco_entrega;
  if (ent && (ent.logradouro || ent.xLgr || ent.municipio || ent.xMun)) {
    const linha = [
      ent.nome || ent.xNome,
      [ent.logradouro || ent.xLgr, ent.numero || ent.nro].filter(Boolean).join(", "),
      ent.complemento || ent.xCpl,
      ent.bairro || ent.xBairro,
      [ent.municipio || ent.xMun, ent.uf || ent.UF].filter(Boolean).join("/"),
      (ent.cep || ent.CEP) ? `CEP ${formatCEP(String(ent.cep || ent.CEP))}` : "",
    ].filter(Boolean).join(" - ");
    if (linha) parts.push(`ENTREGA: ${linha}`);
  }

  if (nfe.valor_pis) parts.push(`PIS: R$ ${fc(nfe.valor_pis)}`);
  if (nfe.valor_cofins) parts.push(`COFINS: R$ ${fc(nfe.valor_cofins)}`);
  if (nfe.dest_email) parts.push(`Email destinatário: ${nfe.dest_email}`);
  if (nfe.ambiente === "homologacao") parts.push("NF-E EMITIDA EM AMBIENTE DE HOMOLOGAÇÃO - SEM VALOR FISCAL");
  return parts.join(" | ") || "";
}
