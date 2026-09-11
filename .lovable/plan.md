# Diagnóstico e correção das NFC-e paradas (abortadas/rejeitadas)

## O que já foi verificado agora

- A produção está na VPS: `api.agilizeerp.com.br`, `emit.agilizeerp.com.br` e `api2.agilizeerp.com.br` respondem no mesmo servidor (191.252.179.49), todos com HTTP 200.
- A rotina automática está viva na VPS: último pulso há 1 minuto, 224 execuções na última hora, mas **8 erros na última hora**.
- O ambiente daqui (Lovable Cloud) está pausado — nenhuma nota está sendo processada por aqui.
- Não consigo, hoje, ler os dados da VPS: não existe rotina de leitura publicada lá e o acesso remoto ao servidor está bloqueado. Por isso **ainda não há causa confirmada** para as notas abortadas/rejeitadas; qualquer explicação agora seria chute.

## Etapa 1 — Abrir leitura segura na VPS (pré-requisito)

Criar uma rotina de diagnóstico somente-leitura, protegida por chave, que você publica na VPS junto com o próximo deploy. Ela responde, sem alterar nada:

- Contagem de NFC-e por situação nos últimos 7 dias, por empresa.
- Notas presas em "processando"/"pendente" há mais de 5 minutos.
- Últimas notas abortadas e rejeitadas com o motivo exato devolvido pela SEFAZ/API2.
- Tamanho de cada fila, itens com tentativas esgotadas e último erro registrado.
- Últimas falhas das rotinas automáticas (as 8 erros/hora) e estado do disjuntor SEFAZ.
- Situação dos certificados e das séries por empresa.

Com isso eu leio a produção sem tocar em nada e sem expor senhas.

## Etapa 2 — Diagnóstico com dados reais

Com a leitura liberada, eu classifico as notas paradas em grupos de causa e digo, com números:

- Quantas abortadas foram abortadas pelo próprio ERP (fluxo de contingência) e quantas por falha nossa.
- Quantas rejeições são de conteúdo (dados da nota) e quantas são de infraestrutura (timeout, certificado, CSC, série, numeração).
- Se há empresa específica travando o conjunto e se a fila está avançando ou empilhando.

## Etapa 3 — Correção

A correção depende do que a Etapa 2 mostrar, mas as frentes prováveis já mapeadas:

- Reprocessar as notas que travaram por falha temporária, sem furo na numeração (reaproveitando o pool de números já existente).
- Reconciliar com a SEFAZ as que possam ter sido autorizadas sem retorno (duplicidade 539) antes de considerar qualquer uma perdida.
- Corrigir na API fiscal e na API2 o que estiver gerando rejeição repetida.
- Ajustar o motivo das 8 falhas por hora nas rotinas automáticas.
- Desbloquear o fluxo dos SaaS: garantir retorno de status e webhook para o ERP em vez de a nota ficar em "processando".

## Etapa 4 — Prevenção

- Alerta ativo quando uma fila passar de um limite ou uma nota ficar presa além do tempo.
- Painel com fila por modelo, presos, última execução e último erro.

## Notas técnicas

- Nova ação de diagnóstico somente-leitura (SELECT apenas), protegida por header com chave dedicada; sem `verify_jwt`, sem escrita, sem exposição de certificado ou secret.
- Publicada como ação da `fiscal-api` (ou função própria `fiscal-diagnostics`) — você aplica na VPS com o mesmo `git pull` + deploy que já usa.
- Nada do ambiente Lovable Cloud é religado; o backend continua pausado.
- Nenhuma alteração no fluxo de assinatura/transmissão da API2 nesta etapa.
