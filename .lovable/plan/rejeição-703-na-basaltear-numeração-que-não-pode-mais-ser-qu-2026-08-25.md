# Rejeição 703 na Basaltear + numeração que não pode mais ser queimada

## O que houve (confirmado nos dados)

Três tentativas de NF-e da Basaltear hoje (25/08, 10:59, 11:01 e 11:05 UTC = 07:59/08:01/08:05 em Brasília) voltaram da SEFAZ com:

`[703] Rejeicao: Data-Hora de Emissao posterior ao horario de recebimento`

Causa: quando o ERP manda apenas a **data** (`2026-08-25`, sem hora), a API converte para `2026-08-25T12:00:00-03:00` (meio-dia). Isso funciona para data retroativa, mas quando a data é **hoje e ainda é de manhã**, o meio-dia está no futuro e a SEFAZ rejeita. Foi exatamente o caso: emissão às 08h com dhEmi 12h.

Consequência de numeração: a nota 000016214 foi rejeitada, excluída manualmente, e a série ficou em 16214 com o número devolvido ao pool — ou seja, a sequência oscilou e dependeu de ação manual do usuário.

## Correções

### 1. Data de emissão nunca no futuro
- Regra nova na normalização (`toSaoPauloIso` em `nfe-api` e `toSaoPauloIsoFiscal` em `fiscal-api`):
  - data-only **anterior a hoje** → mantém meio-dia (comportamento retroativo atual, que funciona);
  - data-only **igual a hoje** → usa a hora atual de Brasília em vez de 12:00;
  - qualquer dhEmi resultante **maior que agora** → limita ao instante atual (menos 1 minuto de folga contra diferença de relógio).
- Mesma regra aplicada aos demais modelos que aceitam data do cliente (NFC-e, MDF-e, NFS-e).
- Guarda espelhada na API2 (PHP): antes de montar o XML, se `dhEmi` > agora, ajusta para agora. Assim, mesmo um ERP que mande hora futura não queima número.

### 2. Rejeição não avança mais a numeração (todos os modelos)
Hoje o número só volta ao pool em exclusão manual ou após esgotar tentativas na fila. Passa a valer:

- **Gatilho no banco**: sempre que um documento (`nfe`, `nfce`, `mdfe`, `nfse`) mudar para `rejeitada`, o número é devolvido automaticamente ao pool `series_numeros_liberados` (sem duplicar).
- **Reenvio mantém o número**: retransmitir o mesmo documento continua usando o número já gravado — nenhuma nova numeração é gerada.
- **Inutilização consome definitivamente**: quando o documento passa a `inutilizada`, o número é removido do pool (não pode ser reaproveitado).
- **Autorização também limpa**: se um documento antes rejeitado for recuperado como `autorizada` (caso 539), o número sai do pool.
- `gerar_numero_nfse` passa a consumir do pool antes de incrementar a série, como já fazem NF-e, NFC-e e MDF-e.

Resultado prático: o próximo documento reaproveita o número rejeitado; a série só avança quando o número foi de fato autorizado ou inutilizado.

### 3. Tratamento explícito do 703
- Ao receber `cStat 703` na emissão, a API reajusta `dhEmi` para o instante atual e **retransmite uma vez automaticamente**, em vez de gravar rejeição. Só grava rejeitada se a segunda tentativa também falhar.

## Detalhes técnicos

- `supabase/functions/nfe-api/index.ts`, `supabase/functions/fiscal-api/index.ts` — clamp de data futura nas funções de normalização + retry único no 703 dentro do fluxo `emit_nfe`/`emit_nfce`/`emit_mdfe`.
- Migração: função `devolver_numero_ao_pool(...)` + triggers `AFTER UPDATE OF status` em `nfe`, `nfce`, `mdfe`, `nfse`; ajuste de `gerar_numero_nfse` para consumir o pool.
- API2 (`/var/www/fiscal-api/public/index.php` via `api2-ssh-exec`): clamp de `dhEmi` futuro e reload do `php8.2-fpm`.
- Validação: emitir uma NF-e de homologação com `data_emissao` = hoje (sem hora) e confirmar autorização; conferir que uma nota rejeitada devolve o número e que a próxima emissão o reutiliza.
