---
name: Prevenção de Duplicidade (539) e Contingência Automática
description: cNF determinístico, recuperação automática de rejeição 539, contingência offline NFC-e e reuso de numeração
type: feature
---
**Causa raiz do 539:** o `cNF` era sorteado a cada tentativa (`random_int` no sped-nfe/API2). Se a 1ª transmissão chegava na SEFAZ mas a resposta se perdia, o retry gerava XML/digest diferente → "Duplicidade de NF-e, com diferença na Chave de Acesso".

**Correções permanentes:**
- `fiscal-api` gera `cNF` **determinístico** (hash FNV/djb2 de `id|numero|serie`, 8 dígitos, nunca igual ao nNF) e envia em `payload.cNF` e `payload.nota.cNF` para NFC-e e NF-e. API2 já honra via `fiscal_cnf_forcado($nota)`.
- Helper `montarChaveAcesso()` (com DV mod 11) permite calcular a chave localmente e consultar a SEFAZ mesmo sem retorno.
- `recuperarDuplicidade539()`: em qualquer resposta com 539/duplicidade, consulta `/nfe/consulta-chave` (chave da mensagem → chave conhecida → chave calculada). Se cStat 100/150 → grava status `autorizada` com chave/protocolo/XML automaticamente.
- **Contingência automática NFC-e:** falha por indisponibilidade SEFAZ (108/109/timeout) coloca a nota em `contingencia` com `tp_emis=9` e enfileira em `nfce_contingencia_queue` (prazo 24h, worker `nfce-contingencia-worker`). API2 passou a honrar `tpEmis` + `dhCont` + `xJust` no `tagide` (antes era fixo `tpEmis => 1`).
- **Sem buraco de numeração:** rejeição definitiva nas filas devolve o número a `series_numeros_liberados`; `gerar_numero_nfce` e `gerar_numero_mdfe` passaram a consumir esse pool (o `gerar_numero_nfe` já consumia).
