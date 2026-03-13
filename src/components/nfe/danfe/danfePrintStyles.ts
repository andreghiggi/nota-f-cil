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

  .danfe {
    border: 2px solid #000;
    width: 100%;
  }

  /* Row layout */
  .danfe-row {
    display: flex;
    border-bottom: 1px solid #000;
  }
  .danfe-row:last-child {
    border-bottom: none;
  }

  /* Cell */
  .danfe-cell {
    border-right: 1px solid #000;
    padding: 2px 4px;
    min-height: 20px;
    position: relative;
  }
  .danfe-cell:last-child {
    border-right: none;
  }

  .danfe-cell-label {
    font-size: 5.5pt;
    color: #333;
    text-transform: uppercase;
    line-height: 1;
    margin-bottom: 1px;
  }

  .danfe-cell-value {
    font-size: 8pt;
    font-weight: normal;
    line-height: 1.2;
    word-break: break-word;
  }

  .danfe-cell-value-lg {
    font-size: 10pt;
    font-weight: bold;
  }

  /* Header area */
  .danfe-header {
    display: flex;
    border-bottom: 2px solid #000;
  }

  .danfe-header-emitente {
    width: 40%;
    border-right: 1px solid #000;
    padding: 4px 6px;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  .danfe-header-emitente-nome {
    font-size: 11pt;
    font-weight: bold;
    text-align: center;
    margin-bottom: 2px;
  }

  .danfe-header-emitente-fantasia {
    font-size: 8pt;
    text-align: center;
    margin-bottom: 2px;
  }

  .danfe-header-emitente-endereco {
    font-size: 7pt;
    text-align: center;
    line-height: 1.3;
  }

  .danfe-header-danfe {
    width: 22%;
    border-right: 1px solid #000;
    padding: 4px;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }

  .danfe-header-danfe-title {
    font-size: 14pt;
    font-weight: bold;
    letter-spacing: 2px;
  }

  .danfe-header-danfe-desc {
    font-size: 6pt;
    margin: 2px 0;
    line-height: 1.2;
  }

  .danfe-header-danfe-entrada {
    font-size: 8pt;
    margin: 2px 0;
  }

  .danfe-header-danfe-entrada-box {
    display: inline-block;
    border: 1px solid #000;
    width: 14px;
    height: 14px;
    text-align: center;
    font-weight: bold;
    font-size: 10pt;
    line-height: 14px;
    margin-left: 4px;
  }

  .danfe-header-danfe-numero {
    font-size: 10pt;
    font-weight: bold;
    margin-top: 2px;
  }

  .danfe-header-chave {
    width: 38%;
    padding: 4px 6px;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  .danfe-header-chave-barcode {
    text-align: center;
    font-size: 7pt;
    font-family: 'Libre Barcode 128', 'IDAutomationHC39M', monospace;
    font-size: 28pt;
    letter-spacing: 0;
    margin-bottom: 2px;
    line-height: 1;
  }

  .danfe-header-chave-label {
    font-size: 5.5pt;
    text-align: center;
    margin-bottom: 1px;
  }

  .danfe-header-chave-value {
    font-size: 7pt;
    text-align: center;
    font-family: monospace;
    word-break: break-all;
    letter-spacing: 0.5px;
  }

  .danfe-header-chave-consulta {
    font-size: 6pt;
    text-align: center;
    margin-top: 4px;
    line-height: 1.2;
  }

  /* Section titles */
  .danfe-section-title {
    background: #e8e8e8;
    font-size: 6.5pt;
    font-weight: bold;
    padding: 1px 4px;
    text-transform: uppercase;
    border-bottom: 1px solid #000;
    text-align: center;
  }

  /* Products table */
  .danfe-products {
    width: 100%;
    border-collapse: collapse;
  }
  .danfe-products th {
    background: #e8e8e8;
    font-size: 5.5pt;
    font-weight: bold;
    padding: 1px 2px;
    border: 1px solid #000;
    border-top: none;
    text-align: center;
    text-transform: uppercase;
  }
  .danfe-products td {
    font-size: 7pt;
    padding: 1px 2px;
    border-left: 1px solid #000;
    border-right: 1px solid #000;
    border-bottom: 1px solid #ccc;
    vertical-align: top;
  }
  .danfe-products td.right {
    text-align: right;
  }
  .danfe-products td.center {
    text-align: center;
  }

  /* Totals grid */
  .danfe-totals-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
  }
  .danfe-totals-grid .danfe-cell {
    border-bottom: none;
  }

  /* Transport */
  .danfe-transport-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr 1fr 1fr;
  }

  /* Flex helpers */
  .flex-2 { flex: 2; }
  .flex-3 { flex: 3; }
  .flex-4 { flex: 4; }
  .flex-5 { flex: 5; }
  .flex-1 { flex: 1; }
  .text-right { text-align: right; }
  .text-center { text-align: center; }
  .bold { font-weight: bold; }

  /* Homologação banner */
  .danfe-homolog {
    background: #fff3cd;
    border: 2px solid #856404;
    text-align: center;
    font-weight: bold;
    font-size: 9pt;
    padding: 3px;
    margin-bottom: 0;
  }

  /* Status footer */
  .danfe-status {
    text-align: center;
    font-weight: bold;
    font-size: 9pt;
    padding: 4px;
    border-top: 2px solid #000;
  }

  .danfe-info-complementar {
    min-height: 40px;
    padding: 3px 4px;
    font-size: 6.5pt;
    line-height: 1.3;
  }

  @media print {
    body { width: 210mm; padding: 5mm; }
    @page { size: A4 portrait; margin: 5mm; }
  }
`;
