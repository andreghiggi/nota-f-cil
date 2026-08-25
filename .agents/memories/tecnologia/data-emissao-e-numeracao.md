---
name: Data de emissão e numeração fiscal
description: Regra de dhEmi nunca no futuro (rejeição 703) e devolução automática de número ao pool em rejeições
type: feature
---

- `dhEmi` nunca pode ser futuro: data-only de hoje/futura é convertida para o instante atual (-60s) em `toSaoPauloIso` (nfe-api), `toSaoPauloIsoFiscal` (fiscal-api) e `fiscal_dh_cliente` (API2). Data-only passada mantém meio-dia (retroativa).
- Rejeição 703 na emissão de NF-e: fiscal-api reajusta dhEmi para agora e retransmite 1x automaticamente antes de gravar rejeitada.
- Numeração: triggers `trg_pool_numero_*` em nfe/nfce/mdfe/nfse devolvem o número a `series_numeros_liberados` quando o status vira `rejeitada` e o removem quando vira autorizada/cancelada/inutilizada/processando. Todas as funções `gerar_numero_*` (inclusive nfse) consomem o pool antes de incrementar a série.
