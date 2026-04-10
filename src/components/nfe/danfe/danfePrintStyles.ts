export const danfePrintStyles = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Times New Roman', Times, serif;
    font-size: 8pt;
    width: 210mm;
    margin: 0 auto;
    padding: 5mm;
    color: #000;
    background: #fff;
  }

  .danfe-page {
    width: 100%;
    border: 2px solid #000;
  }

  /* ===== RECIBO ===== */
  .recibo-area {
    padding: 0;
  }

  .recibo-area table {
    width: 100%;
    border-collapse: collapse;
  }

  .recibo-area td {
    border: 1px solid #000;
    vertical-align: top;
    padding: 0;
  }

  .hr-dashed {
    border: none;
    border-top: 1px dashed #000;
    margin: 2px 0;
  }

  /* ===== GENERIC TABLE ===== */
  .danfe-section {
    width: 100%;
    border-collapse: collapse;
  }

  .danfe-section td, .danfe-section th {
    border: 1px solid #000;
    vertical-align: top;
    padding: 0;
  }

  .danfe-section.no-top td {
    border-top: none;
  }

  /* ===== LABELS ===== */
  .nf-label {
    display: block;
    font-size: 5pt;
    color: #333;
    padding: 0 2px;
    line-height: 1.1;
    text-transform: uppercase;
    font-weight: normal;
  }

  .nf-info {
    display: block;
    font-size: 7.5pt;
    padding: 0 2px 1px 2px;
    line-height: 1.2;
    min-height: 9px;
  }

  .nf-info-lg {
    display: block;
    font-size: 10pt;
    font-weight: bold;
    padding: 0 2px 1px 2px;
    line-height: 1.2;
  }

  .nf-info-right {
    display: block;
    font-size: 7.5pt;
    padding: 0 2px 1px 2px;
    line-height: 1.2;
    text-align: right;
    min-height: 9px;
  }

  /* ===== SIDE BLACK LABELS ===== */
  .black-label {
    background: #000;
    color: #fff;
    text-align: center;
    font-size: 5.5pt;
    font-weight: bold;
    width: 6mm !important;
    max-width: 6mm !important;
    min-width: 6mm !important;
    writing-mode: vertical-rl;
    text-orientation: mixed;
    transform: rotate(180deg);
    letter-spacing: 0.3px;
    padding: 1px !important;
    line-height: 1;
    vertical-align: middle;
  }

  /* ===== HEADER ===== */
  .header-row {
    border: none !important;
  }

  .header-row > td {
    border: 1px solid #000;
    vertical-align: top;
  }

  .company-name {
    font-size: 10pt;
    font-weight: bold;
    text-align: center;
    padding: 3px 4px 1px 4px;
    line-height: 1.2;
  }

  .company-info {
    font-size: 7pt;
    text-align: center;
    line-height: 1.3;
    padding: 0 4px 2px 4px;
  }

  .danfe-center-col {
    text-align: center;
    vertical-align: top;
    padding: 2px 0;
  }

  .danfe-title {
    font-size: 14pt;
    font-weight: bold;
    letter-spacing: 2px;
    margin: 0;
  }

  .danfe-subtitle {
    font-size: 6pt;
    line-height: 1.2;
    margin: 1px 0;
  }

  .danfe-es {
    text-align: center;
    margin: 3px 0 2px 0;
    font-size: 7pt;
  }

  .danfe-es .box-number {
    display: inline-block;
    border: 1px solid #000;
    width: 14px;
    height: 14px;
    text-align: center;
    font-weight: bold;
    font-size: 10pt;
    line-height: 14px;
    vertical-align: middle;
    margin-right: 3px;
  }

  .danfe-es .legenda {
    display: inline-block;
    font-size: 5.5pt;
    text-align: left;
    vertical-align: middle;
    line-height: 1.2;
  }

  .danfe-num {
    text-align: center;
    font-size: 9pt;
    font-weight: bold;
    margin: 1px 0;
  }

  .danfe-serie-page {
    text-align: center;
    font-size: 7pt;
    margin: 0;
  }

  /* ===== CHAVE ACESSO ===== */
  .chave-box {
    padding: 2px 3px;
  }

  .chave-barcode {
    text-align: center;
    height: 12mm;
    overflow: hidden;
    margin-bottom: 1px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .chave-barcode img {
    max-height: 12mm;
    max-width: 100%;
  }

  .chave-barcode-text {
    font-family: 'Libre Barcode 128', monospace;
    font-size: 32pt;
    line-height: 12mm;
  }

  .chave-label {
    font-size: 5pt;
    text-align: center;
    text-transform: uppercase;
    margin-bottom: 0;
  }

  .chave-value {
    font-size: 7pt;
    text-align: center;
    font-family: 'Courier New', Courier, monospace;
    word-break: break-all;
    letter-spacing: 0.8px;
    padding: 1px 2px;
    line-height: 1.3;
  }

  .chave-consulta {
    font-size: 5.5pt;
    text-align: center;
    margin-top: 2px;
    line-height: 1.2;
    padding: 2px;
    border-top: 1px solid #000;
  }

  /* ===== PRODUCTS ===== */
  .products-wrapper {
    padding: 0;
    border: none !important;
  }

  .products-table {
    width: 100%;
    border-collapse: collapse;
  }

  .products-table td, .products-table th {
    border: 1px solid #000;
    border-top: none;
    padding: 0;
  }

  .products-header td {
    background: #e8e8e8;
    font-size: 4.5pt;
    font-weight: bold;
    text-align: center;
    padding: 1px 1px !important;
    text-transform: uppercase;
    border: 1px solid #000;
    border-bottom: 1px solid #000;
    line-height: 1.1;
  }

  .products-body td {
    font-size: 6pt;
    padding: 0.5px 1px !important;
    border-left: 1px solid #000;
    border-right: 1px solid #000;
    border-bottom: 1px solid #ccc;
    line-height: 1.2;
  }

  .products-body td.right {
    text-align: right;
  }

  .products-body td.center {
    text-align: center;
  }

  /* ===== HOMOLOGAÇÃO ===== */
  .homolog-banner {
    background: #fff3cd;
    border-bottom: 2px solid #856404;
    text-align: center;
    font-weight: bold;
    font-size: 8pt;
    padding: 2px;
  }

  /* ===== INFO ADICIONAL ===== */
  .info-adicional td {
    vertical-align: top;
    min-height: 18mm;
  }

  /* ===== STATUS ===== */
  .status-footer {
    text-align: center;
    font-weight: bold;
    font-size: 8pt;
    padding: 2px;
    border-top: 2px solid #000;
  }

  @media print {
    body { width: 210mm; padding: 5mm; margin: 0; }
    @page { size: A4 portrait; margin: 5mm; }
    .danfe-page { border-width: 2px; }
  }
`;
