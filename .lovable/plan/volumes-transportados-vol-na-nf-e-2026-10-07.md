# Volumes transportados (vol) na NF-e

## Causa
A API só lê os volumes **dentro** do objeto de transporte (`transporte`, `transp`, `transportador` ou `transportadora`). O array `volumes` enviado na raiz do payload é ignorado. Além disso, os nomes `q_vol`, `n_vol`, `peso_l`, `peso_b` não são reconhecidos (só `qVol`/`quantidade`, `esp`/`especie`, `marca`, `nVol`/`numeracao`, `pesoL`/`peso_liquido`, `pesoB`/`peso_bruto`).

## Formato que já funciona hoje (sem mudança na API)
```json
"transportador": {
  "mod_frete": 0,
  "cnpj": "...", "razao_social": "...",
  "volumes": [
    { "qVol": 30, "esp": "m²", "marca": "granito", "nVol": "...", "pesoL": 1840, "pesoB": 1840 }
  ]
}
```
Também aceito: `"vol": { ... }` (objeto único) dentro do transportador, e nomes `quantidade`, `especie`, `numeracao`, `peso_liquido`, `peso_bruto`.

## Correção proposta (só leitura do payload, sem tocar em dados)
1. Aceitar `volumes`/`vol` também na raiz do payload, quando não vierem dentro do transporte.
2. Aceitar os nomes `q_vol`, `n_vol`, `peso_l`, `peso_b` além dos atuais.
3. Garantir que o grupo `transp` seja montado mesmo quando só vierem volumes.
4. Atualizar a documentação da NF-e com o exemplo acima.
5. Publicar na VPS com backup e reinício suave das funções; conferir que NF-e/NFC-e seguem emitindo.

A NF-e 16236 já autorizada não será alterada (o XML autorizado não pode mudar; se necessário, os volumes podem constar via Carta de Correção).
