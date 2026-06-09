# Contrato de erro padronizado — api2 (sped-nfe / sped-mdfe)

A edge function `fiscal-api` agora extrai mensagens de erro lendo, **nesta ordem**:

```
erro → error → mensagem → message → xMotivo → motivo → retorno.xMotivo
```

E detecta o código SEFAZ via regex `[NNN] Rejei...` ou `cStat=NNN`.

Para que o tratamento amigável (`friendlySefazError`) funcione 100% no ERP, os
endpoints PHP **devem sempre devolver JSON neste formato em caso de falha**,
mesmo quando a exceção vem do sped-nfe:

```json
{
  "sucesso": false,
  "erro": "[241] Rejeicao: Um numero da faixa ja foi utilizado",
  "cStat": "241",
  "xMotivo": "Rejeicao: Um numero da faixa ja foi utilizado"
}
```

## Ajustes recomendados no `public/index.php` do api2

```php
function api2_send_error(int $http, string $erro, array $extra = []): void {
    http_response_code($http);
    header('Content-Type: application/json; charset=utf-8');
    // tenta extrair cStat/xMotivo de "[NNN] Rejeicao: ..."
    $cStat = null; $xMot = null;
    if (preg_match('/\[?(\d{3})\]?\s*Rejei[cç][aã]o:\s*(.+)/iu', $erro, $m)) {
        $cStat = $m[1];
        $xMot  = trim($m[2]);
    }
    echo json_encode(array_merge([
        'sucesso' => false,
        'erro'    => $erro,
        'cStat'   => $cStat,
        'xMotivo' => $xMot,
    ], $extra), JSON_UNESCAPED_UNICODE);
    exit;
}

// uso típico em /nfe/inutilizar, /nfe/cancelar, /nfe/cce, /nfe/emitir, /mdfe/*:
try {
    $resp = $tools->sefazInutiliza($nSerie, $nIni, $nFin, $just);
    $st   = $tools->sefazInutilizaResposta($resp); // converte para array
    if (($st['cStat'] ?? '') !== '102') {
        api2_send_error(400,
            sprintf('[%s] %s', $st['cStat'] ?? '???', $st['xMotivo'] ?? 'Rejeicao'),
            ['protocolo' => $st['nProt'] ?? null, 'detalhes' => $st]
        );
    }
    echo json_encode(['sucesso' => true, 'cStat' => '102', 'xMotivo' => $st['xMotivo'], 'protocolo' => $st['nProt']]);
} catch (\Throwable $e) {
    api2_send_error(500, $e->getMessage());
}
```

## Códigos cStat tratados no ERP

| cStat | Ação        | Mensagem amigável                                                                       |
| ----- | ----------- | --------------------------------------------------------------------------------------- |
| 241   | inutilizar  | Número já foi transmitido — use Cancelamento                                            |
| 242   | inutilizar  | Faixa já consta como inutilizada                                                        |
| 243   | inutilizar  | Justificativa inválida (15–255 chars, sem especiais)                                    |
| 244   | inutilizar  | Faixa de numeração inválida                                                             |
| 217   | cancelar    | NF-e não consta na base da SEFAZ                                                        |
| 218   | cancelar    | NF-e já está cancelada                                                                  |
| 233   | cancelar    | Chave duplicada/inválida                                                                |
| 501   | cancelar    | Prazo legal excedido (24h) — emita NF-e de devolução                                    |
| 478   | cce         | Sequência inválida                                                                      |
| 494   | cce         | CC-e não pode alterar valores/quantidades/tributos                                      |
| 573   | cce         | Sequência de CC-e já registrada                                                         |
| 108/109 | emitir   | SEFAZ paralisada/indisponível — use contingência                                        |
| 539   | emitir      | NF-e duplicada                                                                          |
