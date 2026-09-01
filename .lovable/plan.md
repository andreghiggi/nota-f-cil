# Revisão de rotina da API fiscal + automação de processamento de todos os modelos

## O que a verificação encontrou agora (dados reais)

Saudável:
- Todas as rotinas automáticas das últimas 24h terminaram com sucesso (fila NFC-e, fila NF-e, contingência, DF-e, varredura 539, expurgo). Nenhuma falha registrada.
- Disjuntor SEFAZ/API2 fechado (0 falhas consecutivas). API2 responde `/status` em 0,33s.
- Nenhum documento órfão em "processando", nenhuma NFC-e em contingência pendente, nenhum certificado vencendo nos próximos 45 dias.

Problemas confirmados:
1. **MDF-e e CT-e têm fila no banco, mas ninguém consome.** Existem `fila_processamento_mdfe` (11 registros, o mais antigo de maio) e `fila_processamento_cte`, porém só existem workers para NF-e e NFC-e. A emissão desses modelos é síncrona: se a chamada falhar, o documento fica parado para sempre. Hoje há 2 MDF-e presos em "pendente" desde 14/05.
2. **NFS-e não tem fila nem reprocessamento.** Falha na emissão não tem nenhuma tentativa posterior.
3. **A recuperação automática de duplicidade (539) cobre só NF-e e NFC-e.** MDF-e, CT-e e CT-e OS rejeitados por duplicidade nunca são reconciliados com a SEFAZ.
4. **A inutilização automática diária cobre só modelos 55 e 65.** Numeração queimada de MDF-e/CT-e/NFS-e fica em aberto.
5. **A varredura de órfãos ("processando" sem retorno) é reativa**, só acontece quando alguém consulta o documento — não há varredura periódica.
6. **Fila com lixo acumulado**: registros de fila apontando para documentos já rejeitados/autorizados nunca são removidos.

## O que implementar

### Etapa 1 — Workers de fila para MDF-e, CT-e/CT-e OS e NFS-e
Criar o processamento assíncrono que hoje só existe para NF-e/NFC-e, com o mesmo padrão: lote limitado por execução, tentativas com recuo exponencial, teto de tentativas, remoção do item da fila em estado terminal e devolução do número ao pool quando rejeitado em definitivo. A emissão síncrona atual continua igual — a fila só entra como rede de segurança quando a chamada falha.

### Etapa 2 — Orquestrador único passa a cuidar de todos os modelos
Incluir as novas rotinas no pulso existente (que roda a cada minuto), respeitando trava de execução, intervalo mínimo e disjuntor. Sem novos agendamentos concorrentes no banco — o motivo da saturação anterior.

### Etapa 3 — Varredura periódica de documentos presos
Rotina que, a cada poucos minutos, procura documentos de qualquer modelo parados em "processando"/"pendente" há mais tempo que o limite, consulta a situação real na SEFAZ e conclui: autorizada (grava chave/protocolo/XML), rejeitada, ou devolve para a fila. Também faz a limpeza dos registros de fila cujo documento já está em estado final.

### Etapa 4 — Duplicidade (539) e inutilização diária para todos os modelos
Estender a varredura de 539 e a inutilização automática de 00:01 para MDF-e, CT-e, CT-e OS e NFS-e, mantendo a justificativa padrão já usada e a confirmação prévia na SEFAZ antes de inutilizar.

### Etapa 5 — Ajustes na API2
Verificar e completar, do lado PHP, as consultas de situação por chave/numeração para os modelos 58 (MDF-e) e 57/67 (CT-e/CT-e OS) e o retorno padronizado de cStat/xMotivo, que são o que as rotinas acima consomem. Sem mexer no fluxo de assinatura e transmissão que já funciona.

### Etapa 6 — Saneamento dos pendentes atuais
Reconciliar com a SEFAZ os 11 itens presos na fila de MDF-e e os 2 MDF-e em "pendente" desde maio, concluindo cada um (autorizado, rejeitado ou inutilizado) e limpando a fila.

### Etapa 7 — Painel e alerta
Expor no painel interno: fila por modelo, documentos presos, última execução de cada rotina e último erro; alerta quando uma rotina falhar seguidamente ou uma fila passar de um tamanho limite.

## Notas técnicas

- Workers novos como funções próprias (`process-mdfe-queue`, `process-cte-queue`, `process-nfse-queue`), chamados exclusivamente pelo `fiscal-cron-tick` — nada de agendamento pg_cron adicional.
- Cada worker: lote fixo (ex. 20), `acquire_job_lock` próprio, registro em `job_runs`, e `circuit_record` no disjuntor compartilhado `sefaz-api2`.
- Devolução de numeração continua pelos gatilhos `trg_pool_numero_*` já existentes; a fila só precisa gravar o status terminal correto.
- Varredura de presos e o 539 estendido entram como novas ações da `fiscal-api`, reaproveitando `recuperarDuplicidade539` e `montarChaveAcesso` com o modelo parametrizado.
- Nada do fluxo fiscal atualmente em produção (NF-e/NFC-e) é alterado: as mudanças são aditivas.
