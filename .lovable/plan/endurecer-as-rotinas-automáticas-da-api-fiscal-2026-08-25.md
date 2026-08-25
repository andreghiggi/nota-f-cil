# Endurecer as rotinas automáticas da API fiscal

## Situação atual (verificada agora)

- As falhas de `job startup timeout` pararam às 01:51 UTC. Desde então, todas as execuções das rotinas automáticas terminaram com sucesso (filas NF-e/NFC-e, contingência e sincronização DF-e).
- Nas 24h anteriores houve mais de 1.000 execuções falhadas por esgotamento de processos de trabalho do banco — 4 rotinas disparando em paralelo, cada uma podendo demorar minutos, contra um limite baixo de processos simultâneos.
- Hoje existem 6 rotinas agendadas: fila NFC-e (2 min), fila NF-e (2 min, defasada), DF-e (15 min), contingência (5 min), varredura de duplicidade (a cada hora), inutilização diária.

O reescalonamento resolveu o incêndio, mas nada impede que volte a acontecer quando o volume crescer. As melhorias abaixo atacam a causa estrutural.

## O que implementar

### 1. Um único "pulso" no lugar de rotinas concorrentes
Substituir os agendamentos separados por **uma única rotina orquestradora** que roda a cada minuto e decide, dentro dela mesma, o que precisa rodar (fila NFC-e, fila NF-e, contingência, DF-e). Isso passa de 4 processos simultâneos do banco para 1, eliminando a disputa que derrubou tudo.

### 2. Trava de execução (evitar sobreposição)
Cada rotina passa a pegar uma trava antes de rodar. Se a execução anterior ainda está em andamento, a nova simplesmente não inicia em vez de empilhar. Trava com expiração automática, para que uma queda no meio do caminho não deixe a rotina bloqueada.

### 3. Disjuntor para quando a API2/SEFAZ está fora
Registrar falhas consecutivas de comunicação. Ao passar de um limite, as rotinas param de tentar por alguns minutos e retomam sozinhas. Hoje cada indisponibilidade da SEFAZ vira dezenas de tentativas caras que só somam carga.

### 4. Limite de tempo e paginação obrigatórios nas consultas
- Tempo máximo por consulta nas funções da API, para que uma listagem pesada nunca segure conexões e derrube a autenticação dos demais clientes.
- Paginação obrigatória (com teto) nas listagens de NF-e, NFC-e, MDF-e, NFS-e e DF-e.
- Lote das filas com tamanho adaptativo: reduz quando há erros, aumenta quando está limpo.

### 5. Cache curto de validação de token
Guardar em memória, por ~60 segundos, o resultado da validação de cada chave de API. Hoje toda chamada bate no banco — é justamente essa consulta que travou primeiro durante a saturação.

### 6. Monitoramento com alerta ativo
- Tabela de saúde das rotinas: última execução, duração, quantidade processada, último erro.
- Painel interno mostrando fila parada, documentos presos em "processando" e rotinas que não rodam há X minutos.
- Disparo de webhook/notificação quando uma rotina falhar N vezes seguidas ou a fila passar de um tamanho limite — hoje só descobrimos o problema quando o cliente reclama.

### 7. Endpoint de saúde leve
`GET /health` em cada função da API, respondendo sem consultar tabelas pesadas, para monitoramento externo distinguir "API fora" de "banco lento".

### 8. Limpeza e retenção
Expurgo periódico dos históricos que só crescem (execuções de rotina, logs fiscais, logs de webhook), mantendo uma janela de retenção. Também reduz o custo das varreduras.

## Ordem sugerida

1. Trava de execução + rotina orquestradora única (maior impacto, resolve a causa raiz)
2. Limite de tempo, paginação e lote adaptativo
3. Cache de token + endpoints de saúde
4. Disjuntor para indisponibilidade da SEFAZ/API2
5. Monitoramento, alertas e retenção

## Notas técnicas

- A orquestração fica em uma nova função `fiscal-cron-tick`, invocada por um único agendamento; as funções atuais de fila continuam existindo e passam a ser chamadas por ela.
- Travas via tabela `job_locks` (chave, dono, expiração) — mais observável que travas puramente em memória do banco.
- Estado do disjuntor e histórico de execuções em tabelas próprias, com RLS restrita a administradores.
- Nenhuma alteração na API2 (PHP/sped-nfe) é necessária para esta etapa; o comportamento de transmissão à SEFAZ permanece igual.
- O domínio `api.agilizeerp.com.br` continua sendo um item separado (DNS apontando para outro provedor) e não é resolvido por este plano.
