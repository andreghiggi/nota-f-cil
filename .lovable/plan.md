# Inutilização automática diária de notas rejeitadas

Todo dia às 00:01 (horário de Brasília) o sistema varre as notas rejeitadas do dia anterior, confere na SEFAZ se elas realmente não existem, e inutiliza a numeração automaticamente com a justificativa padrão.

## Regras

Entram na rotina:
- NF-e (modelo 55) e NFC-e (modelo 65) com situação **rejeitada**, emitidas no dia anterior.
- Apenas números realmente perdidos: antes de inutilizar, cada nota é consultada na SEFAZ.

Ficam de fora:
- Rejeições por **duplicidade** (539) — essas seguem no fluxo de recuperação já existente, que as marca como autorizadas.
- Notas que a consulta à SEFAZ apontar como **autorizadas, canceladas ou denegadas** — nesses casos a rotina corrige o status no sistema em vez de inutilizar.
- MDF-e e NFS-e, que não possuem evento de inutilização na SEFAZ.

Após a inutilização aceita pela SEFAZ:
- A nota passa para a situação **inutilizada**.
- O motivo registrado é sempre: *"Nota nao consta na base de dados da SEFAZ"*.
- O número **não** volta para o pool de reaproveitamento (numeração inutilizada não pode ser reutilizada).
- Falhas individuais são registradas no log fiscal e não interrompem o restante da varredura.

## Detalhes técnicos

**`supabase/functions/fiscal-api/index.ts`** — nova ação `inutilizar_rejeitadas_do_dia`:
- Parâmetros opcionais: `data` (dia a processar, padrão = ontem em America/Sao_Paulo), `dry_run` (apenas lista o que seria inutilizado), `empresa_id` (limitar a uma empresa).
- Seleciona em `nfe` e `nfce` os registros com `status = 'rejeitada'` dentro da janela do dia, descartando os que tenham `539`/`duplicid` em `motivo_retorno`/`erro_processamento`.
- Para cada nota, reutiliza `recuperarDuplicidade539` (que já consulta a chave na SEFAZ, com as chaves candidatas) como verificação de existência:
  - encontrou documento autorizado → grava o status correto e **não** inutiliza;
  - não encontrou → chama `handleInutilizar(supabase, empresa_id, serie, numero, numero, 'Nota nao consta na base de dados da SEFAZ', modelo)`.
- Com retorno de sucesso da SEFAZ (cStat 102) ou "número já inutilizado" (cStat 563), atualiza o registro: `status = 'inutilizada'`, `codigo_retorno`, `motivo_retorno = 'Nota nao consta na base de dados da SEFAZ'`, `erro_processamento = null`.
- Responde com resumo: total analisado, inutilizadas, recuperadas como autorizadas, ignoradas por duplicidade e falhas.

**Agendamento** — job `pg_cron` `inutilizar-rejeitadas-diario` às `1 3 * * *` UTC (00:01 em Brasília) chamando a nova ação via `net.http_post`.

**Validação** — executar primeiro em `dry_run` sobre um dia com rejeições reais para conferir a lista antes de ligar o cron.
