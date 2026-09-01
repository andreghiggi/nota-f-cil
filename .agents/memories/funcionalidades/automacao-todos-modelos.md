---
name: Automação de processamento para todos os modelos fiscais
description: Workers de fila MDF-e/CT-e/NFS-e, varredura de presos e sweep 539 estendido a transporte
type: feature
---
- Workers de fila: `process-mdfe-queue`, `process-cte-queue`, `process-nfse-queue` compartilham `supabase/functions/_shared/fila-worker.ts` (sweep de órfãos 'processando' > 5 min, lote 20, backoff exponencial, falha transitória não queima o documento — reagenda 15 min e amplia o teto).
- Tabela `fila_processamento_nfse` criada; `nfse-api` insere na fila antes da emissão síncrona e remove em caso de sucesso (mesmo padrão de mdfe-api/cte-api).
- `fiscal-cron-tick` orquestra tudo: fila-nfce/nfe (120s), fila-mdfe/cte (180s), fila-nfse (300s), contingência (300s), sweep-539 (1h) e sweep-presos (15 min).
- `fiscal-api` action `sweep_presos`: reenfileira documentos parados em pendente/processando sem item de fila e limpa itens de fila cujo documento já está em estado final — em nfe, nfce, mdfe, cte e nfse.
- `sweep_539` estendido a MDF-e e CT-e via `/mdfe/consulta-chave` e `/cte/consultar` (API2). O `/mdfe/consulta-chave` passou a devolver `cStat`, `xMotivo` e `protocolo` além do XML.
