# Estabilizar api.agilizeerp.com.br e o backend fiscal

## O que foi verificado agora (19:10 UTC)

**1. O domínio api.agilizeerp.com.br não aponta para a API.**
- DNS resolve para a Vercel (216.198.79.1 / 64.29.17.1, CNAME `...vercel-dns-017.com`).
- A raiz `/` responde 200 com uma página vazia; **toda rota de API responde 404** (`/health`, `/nfe-api/health`, `/nfce-api/health`) e `/functions/v1/...` nem conecta.
- Ou seja: quem chama por esse host não fala com a API fiscal — isso explica "às vezes não acessa".

**2. O banco está com lentidão intermitente real.**
- Cerca de metade das consultas administrativas feitas agora falharam com pooler indisponível ou estouro de tempo, alternando com respostas normais.
- `cron.job_run_details` está com **421 MB, sem autovacuum registrado**. Qualquer consulta nessa tabela estoura o tempo limite. É o histórico do agendamento que roda a cada minuto e nunca é expurgado.
- `net._http_response` (histórico das chamadas HTTP do banco) com 50 MB, também sem limpeza.

**3. As rotinas automáticas pararam há ~3 horas.**
- Última execução registrada em `job_runs`: 16:03 UTC; a última tentativa da fila NFC-e falhou com `statement timeout` após 56 s.
- Duas travas ficaram para trás (`job:tick`, `job:fila-nfce`) — já expiradas, então não bloqueiam, mas mostram execuções interrompidas no meio.
- Nas 24h anteriores tudo estava saudável: ~2.200 execuções, apenas 1 falha.

**4. Sem impacto fiscal no momento.** Nenhuma NF-e ou NFC-e presa em pendente/processando. A API2 está saudável (`/status` em 0,34 s) e as funções do backend respondem em ~0,15 s.

Diagnóstico: a tabela de histórico do agendador inchou até o ponto de fazer as consultas do próprio agendador estourarem o tempo limite, derrubando o pulso das rotinas e contaminando o desempenho geral do banco. O domínio é um problema separado, de DNS.

## Plano de correção

### Etapa 1 — Destravar o banco (imediato)
1. Truncar/expurgar `cron.job_run_details` mantendo apenas os últimos 2 dias e rodar `VACUUM FULL` na tabela para devolver os 421 MB.
2. Mesmo tratamento em `net._http_response` (retenção de 1 dia).
3. Limpar travas expiradas em `job_locks`.

### Etapa 2 — Impedir que volte a inchar
4. Incluir na rotina de purga já existente (`purga-historico`, diária) a limpeza de `cron.job_run_details` e `net._http_response`, com retenção fixa.
5. Criar índice por `start_time` no histórico do agendador para as consultas de diagnóstico não estourarem mais.
6. Registrar execuções em `job_runs` também quando o pulso falhar antes de começar, para a parada ficar visível.

### Etapa 3 — Detectar parada de rotina
7. Alerta simples: se nenhum pulso for registrado por mais de 10 minutos, marcar o estado como degradado e disparar notificação (mesma via dos webhooks já existentes). Hoje só se percebe olhando manualmente.

### Etapa 4 — Resolver o domínio
8. `api.agilizeerp.com.br` está sob um projeto na Vercel, fora do alcance deste projeto. Duas saídas:
   - **Recomendada:** apontar o DNS do subdomínio direto para o endpoint das funções do backend (mudança no registrador, feita por você — eu passo o valor exato).
   - **Alternativa:** manter na Vercel e configurar lá regras de reescrita de `/*` para as funções do backend.
9. Enquanto isso, os ERPs devem usar a URL direta das funções, que responde normalmente.

## Notas técnicas

- Nada muda na API2 (PHP/sped-nfe) nem no comportamento de transmissão à SEFAZ.
- `VACUUM FULL` em `cron.job_run_details` trava brevemente essa tabela; o agendamento pode perder um ou dois pulsos durante a operação, sem perda de documentos (a fila é reprocessada no pulso seguinte).
- A retenção de histórico passa a ser: agendador 2 dias, respostas HTTP internas 1 dia, `job_runs` conforme a purga atual.
