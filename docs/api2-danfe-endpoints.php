<?php
/**
 * ============================================================================
 *  Endpoints DANFE/DANFCE — sped-da
 *  Cole este bloco dentro do `public/index.php` do api2 (antes do dispatcher
 *  final / fallback). Requer:
 *      composer require nfephp-org/sped-da
 *
 *  Rotas adicionadas:
 *      POST /nfe/danfe       → DANFE NF-e (modelo 55) em PDF
 *      POST /nfe/danfe-simples → mesmo, sem logo, retrato A4
 *      POST /nfce/danfe      → DANFCE NFC-e (modelo 65) em PDF
 *
 *  Contrato JSON de entrada (todos opcionais salvo `xml`):
 *  {
 *    "xml":             "<nfeProc ...>...</nfeProc>",
 *    "logo_base64":     "data:image/png;base64,iVBOR...",
 *    "orientacao":      "P" | "L",            // default "P"
 *    "tamanho":         "A4",                  // default "A4"
 *    "mostrar_canhoto": true,                  // default true
 *    "tipo":            "pdf" | "base64"      // default "pdf"
 *  }
 *  Resposta:
 *    - tipo=pdf    → Content-Type: application/pdf (binário)
 *    - tipo=base64 → { "sucesso": true, "pdf_base64": "..." }
 *  Em erro: HTTP 4xx/5xx + { "sucesso": false, "erro": "..." }
 * ============================================================================
 */

use NFePHP\DA\NFe\Danfe;
use NFePHP\DA\NFCe\Danfce;

if (!function_exists('agilize_danfe_render')) {

    function agilize_danfe_read_body(): array
    {
        $raw = file_get_contents('php://input');
        if (!$raw) return [];
        $data = json_decode($raw, true);
        return is_array($data) ? $data : [];
    }

    function agilize_danfe_send_pdf(string $pdf, string $tipo, string $filename): void
    {
        if ($tipo === 'base64') {
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode([
                'sucesso'    => true,
                'pdf_base64' => base64_encode($pdf),
                'filename'   => $filename,
            ]);
            return;
        }
        header('Content-Type: application/pdf');
        header('Content-Disposition: inline; filename="' . $filename . '"');
        header('Content-Length: ' . strlen($pdf));
        echo $pdf;
    }

    function agilize_danfe_send_error(int $status, string $msg): void
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['sucesso' => false, 'erro' => $msg]);
    }

    function agilize_danfe_render(array $body, string $modelo): void
    {
        $xml = trim((string)($body['xml'] ?? ''));
        if ($xml === '') { agilize_danfe_send_error(400, 'xml é obrigatório'); return; }

        // aceita base64
        if ($xml[0] !== '<') {
            $decoded = base64_decode($xml, true);
            if ($decoded && str_contains($decoded, '<')) $xml = $decoded;
        }

        $tipo            = strtolower((string)($body['tipo'] ?? 'pdf'));
        $orientacao      = strtoupper((string)($body['orientacao'] ?? 'P'));
        $tamanho         = strtoupper((string)($body['tamanho'] ?? 'A4'));
        $mostrarCanhoto  = (bool)($body['mostrar_canhoto'] ?? true);
        $logoBase64      = (string)($body['logo_base64'] ?? '');
        $logoData        = '';

        if ($logoBase64 !== '') {
            // aceita data:image/png;base64,xxxx
            if (str_contains($logoBase64, ',')) {
                $logoBase64 = explode(',', $logoBase64, 2)[1];
            }
            $bin = base64_decode($logoBase64, true);
            if ($bin) {
                $logoData = 'data://text/plain;base64,' . base64_encode($bin);
            }
        }

        try {
            if ($modelo === '65') {
                $danfe = new Danfce($xml);
                if ($logoData) $danfe->logoParameters($logoData, 'C', false);
                $pdf = $danfe->render();
                $filename = 'DANFCE.pdf';
            } else {
                $danfe = new Danfe($xml);
                $danfe->debugMode(false);
                $danfe->creditsIntegratorFooter('Agilize ERP');
                if (method_exists($danfe, 'setOrientation')) {
                    $danfe->setOrientation($orientacao);
                }
                if (method_exists($danfe, 'printParameters')) {
                    $danfe->printParameters($orientacao, $tamanho, 'P');
                }
                if (!$mostrarCanhoto && method_exists($danfe, 'showCanhoto')) {
                    $danfe->showCanhoto(false);
                }
                if ($logoData) $danfe->logoParameters($logoData, 'C', false);
                $pdf = $danfe->render();
                $filename = 'DANFE.pdf';
            }
        } catch (\Throwable $e) {
            agilize_danfe_send_error(500, 'falha ao gerar PDF: ' . $e->getMessage());
            return;
        }

        agilize_danfe_send_pdf($pdf, $tipo, $filename);
    }
}

/* ---------------- DISPATCHER ----------------
 * Coloque ANTES do fallback que devolve a lista de endpoints.
 * Se você já tem um roteador baseado em $_SERVER['REQUEST_URI'],
 * só adicione os 3 case abaixo.
 */
$__danfe_uri = strtok($_SERVER['REQUEST_URI'] ?? '', '?');
$__danfe_method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

if ($__danfe_method === 'POST') {
    switch ($__danfe_uri) {
        case '/nfe/danfe':
        case '/nfe/danfe-simples':
            agilize_danfe_render(agilize_danfe_read_body(), '55');
            exit;
        case '/nfce/danfe':
            agilize_danfe_render(agilize_danfe_read_body(), '65');
            exit;
    }
}
