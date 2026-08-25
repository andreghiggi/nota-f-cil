# Restabelecer api.agilizeerp.com.br e o backend fiscal

## O que está acontecendo (verificado agora)

São **dois problemas independentes**:

**1. O banco do Fiscal Flow está saturado — esta é a causa real da API fora do ar.**
- `nfe-api` e `nfce-api` chamadas diretamente no backend **não respondem** (timeout de 30s, HTTP 000).
- `management-api` responde normal (200 em 0,6s) — porque só ela não depende da consulta pesada de token.
- Logs das funções: `Token validation error: canceling statement due to statement timeout` e `Error listing NFC-e: statement timeout`, repetindo-se de forma contínua há mais de uma hora.
- Logs do banco: sequência ininterrupta de `canceling statement due to statement timeout`, `canceling statement due to user request` e `FATAL: connection to client lost`.
- Consultas administrativas ao banco (inclusive um simples `count(*)`) também estouram o tempo limite.
- O painel de saúde da nuvem reporta "saudável", mas o banco na prática está inalcançável — quadro clássico de instância travada/sobrecarregada.

**2. O domínio api.agilizeerp.com.br não aponta mais para a API.**
- DNS resolve para a **Vercel** (64.29.17.65 / 216.198.79.65, CNAME `...vercel-dns-017.com`).
- O que responde é um site React genérico ("Lovable App / Lovable Generated Project"), publicado hoje às 00:24 UTC.
- Qualquer rota de API (`/nfe-api/`, `/functions/v1/nfe-api/`, `/health`) devolve **404 NOT_FOUND da Vercel** — não há regra de reescrita para as funções do backend.
- Ou seja: mesmo com o banco recuperado, chamadas para esse host continuarão falhando.

**A api2 (api2.agilizeerp.com.br) está 100% saudável** — responde `API Fiscal Híbrida Online`, modelos 55/65/58/NFS-e, `/status` em 200, latência ~330ms. Nada quebrou lá.

## Plano de correção

### Etapa 1 — Recuperar o banco (prioridade máxima, desbloqueia tudo)
1. Reiniciar a instância do backend (pede sua aprovação na hora) e aguardar ficar saudável.
2. Assim que voltar a responder, checar `pg_stat_activity` para identificar as consultas que ficaram presas e os jobs de cron rodando em paralelo.
3. Validar recuperação: `nfe-api` e `nfce-api` devem responder em menos de 2s (401 com chave inválida é resposta válida).

### Etapa 2 — Impedir que volte a travar
4. Analisar as consultas lentas e criar os índices faltantes nas colunas mais usadas na validação de token e nas listagens (`tokens_api`, `nfe`, `nfce` por `empresa_id` + `created_at` + `status`).
5. Colocar limite de tempo e paginação obrigatória nas listagens das funções, para que uma consulta pesada não derrube a autenticação de todo mundo.
6. Revisar a frequência dos crons (varredura de duplicidade, fila de NF-e, sincronização DF-e) e espaçar os que rodam em cima uns dos outros.

### Etapa 3 — Redirecionar o domínio
7. O domínio está hoje sob um projeto na **Vercel**, fora do alcance deste projeto. Duas saídas:
   - **Recomendada:** apontar `api.agilizeerp.com.br` diretamente para o endpoint das funções do backend (mudança de DNS no registrador, feita por você — eu passo o valor exato).
   - **Alternativa:** manter na Vercel e adicionar lá regras de reescrita de `/*` para as funções do backend.
8. Enquanto isso, os clientes/ERP devem usar a URL direta das funções do backend, que já funciona.

## Notas técnicas

- Nenhuma alteração será feita na api2 (PHP/sped-nfe) — ela está saudável e fora do problema.
- Nada será transmitido à SEFAZ durante o diagnóstico; notas presas em "processando" serão reavaliadas só depois que o banco estabilizar.
- O reinício do backend deixa banco e autenticação indisponíveis por alguns minutos; as emissões nesse intervalo ficam na fila e são reprocessadas.
