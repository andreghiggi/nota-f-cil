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
  }

  table {
    width: 100%;
    border-collapse: collapse;
  }

  table td, table th {
    border: 1px solid #000;
    vertical-align: top;
    padding: 0;
  }

  table.no-top td {
    border-top: none;
  }

  .nf-label {
    display: block;
    font-size: 5.5pt;
    color: #333;
    padding: 1px 3px 0 3px;
    line-height: 1.1;
    text-transform: uppercase;
  }

  .nf-info {
    display: block;
    font-size: 8pt;
    padding: 0 3px 2px 3px;
    line-height: 1.2;
  }

  .nf-info-lg {
    display: block;
    font-size: 10pt;
    font-weight: bold;
    padding: 0 3px 2px 3px;
    line-height: 1.2;
  }

  .nf-info-right {
    display: block;
    font-size: 8pt;
    padding: 0 3px 2px 3px;
    line-height: 1.2;
    text-align: right;
  }

  /* Black side labels */
  .black-label {
    background: #000;
    color: #fff;
    text-align: center;
    font-size: 6pt;
    font-weight: bold;
    width: 7mm !important;
    writing-mode: vertical-rl;
    text-orientation: mixed;
    transform: rotate(180deg);
    letter-spacing: 0.5px;
    padding: 2px !important;
    line-height: 1;
  }

  /* Header */
  .danfe-title {
    font-size: 14pt;
    font-weight: bold;
    letter-spacing: 2px;
    text-align: center;
    margin: 2px 0;
  }

  .danfe-subtitle {
    font-size: 6.5pt;
    text-align: center;
    line-height: 1.2;
    margin: 1px 0;
  }

  .danfe-es {
    text-align: center;
    margin: 4px 0 2px 0;
    font-size: 7.5pt;
  }

  .danfe-es .box-number {
    display: inline-block;
    border: 1px solid #000;
    width: 16px;
    height: 16px;
    text-align: center;
    font-weight: bold;
    font-size: 11pt;
    line-height: 16px;
    vertical-align: middle;
    margin-right: 4px;
  }

  .danfe-es .legenda {
    display: inline-block;
    font-size: 6.5pt;
    text-align: left;
    vertical-align: middle;
    line-height: 1.3;
  }

  .danfe-num {
    text-align: center;
    font-size: 10pt;
    font-weight: bold;
    margin: 2px 0;
  }

  .danfe-serie-page {
    text-align: center;
    font-size: 8pt;
    margin: 1px 0;
  }

  .company-name {
    font-size: 10pt;
    font-weight: bold;
    text-align: center;
    padding: 2px 4px;
  }

  .company-info {
    font-size: 7pt;
    text-align: center;
    line-height: 1.3;
    padding: 0 4px 2px 4px;
  }

  .chave-box {
    padding: 4px;
  }

  .chave-barcode {
    text-align: center;
    height: 10mm;
    overflow: hidden;
    margin-bottom: 2px;
    font-family: 'Libre Barcode 128', monospace;
    font-size: 30pt;
    line-height: 10mm;
  }

  .chave-label {
    font-size: 5.5pt;
    text-align: center;
    text-transform: uppercase;
    margin-bottom: 1px;
  }

  .chave-value {
    font-size: 7.5pt;
    text-align: center;
    font-family: 'Courier New', monospace;
    word-break: break-all;
    letter-spacing: 1px;
    padding: 1px 2px;
  }

  .chave-consulta {
    font-size: 6pt;
    text-align: center;
    margin-top: 4px;
    line-height: 1.2;
    padding: 2px;
    border-top: 1px solid #000;
  }

  /* Recibo */
  .recibo-area {
    margin-bottom: 2px;
  }

  .hr-dashed {
    border: none;
    border-top: 1px dashed #000;
    margin: 3px 0;
  }

  /* Products table */
  .products-header td {
    background: #e8e8e8;
    font-size: 5pt;
    font-weight: bold;
    text-align: center;
    padding: 1px 1px !important;
    text-transform: uppercase;
    border: 1px solid #000;
  }

  .products-body td {
    font-size: 6.5pt;
    padding: 1px 2px !important;
    border-left: 1px solid #000;
    border-right: 1px solid #000;
    border-bottom: 1px solid #ddd;
  }

  .products-body td.right {
    text-align: right;
  }

  .products-body td.center {
    text-align: center;
  }

  /* Homologação */
  .homolog-banner {
    background: #fff3cd;
    border: 2px solid #856404;
    text-align: center;
    font-weight: bold;
    font-size: 9pt;
    padding: 3px;
    margin-bottom: 2px;
  }

  /* Info adicional */
  .info-adicional {
    min-height: 20mm;
    padding: 0;
  }

  .info-adicional td {
    vertical-align: top;
  }

  /* Status */
  .status-footer {
    text-align: center;
    font-weight: bold;
    font-size: 9pt;
    padding: 3px;
    border: 2px solid #000;
    border-top: 2px solid #000;
    margin-top: -1px;
  }

  @media print {
    body { width: 210mm; padding: 5mm; }
    @page { size: A4 portrait; margin: 5mm; }
  }
`;
