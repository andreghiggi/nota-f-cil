# Auditoria de duplicidade (539) e recuperação automática — todos os módulos

## O que foi verificado (dados reais)

- Últimos 60 dias, NFC-e rejeitadas: **84 no total, 38 delas são [539] duplicidade** — todas com a mesma mensagem da API2: `"[539] NF-e duplicada — consulta retornou [] Os documentos se referem a diferentes objetos. Os digest são diferentes"`.
- NF-e rejeitadas: 34 no total, 2 com 539.
- Nenhuma rejeição por timeout/conexão gravada — ou seja, a falha acontece **depois** de a SEFAZ já ter autorizado.
- `series_numeros_liberados` tem apenas 2 registros e só é alimentada na exclusão manual de NF-e — números de notas travadas em `rejeitada` nunca voltam, o que produz os saltos de numeração.

## Causa raiz confirmada

Na emissão a API (fiscal-api) **não envia um `cNF` fixo**; a API2/sped-nfe gera um `cNF` aleatório a cada tentativa. Quando a primeira transmissão autoriza mas a resposta se perde (timeout/queda), o reenvio monta um XML com `cNF` diferente → mesma chave lógica, digest diferente → SEFAZ responde **539 com "digest diferentes"**, e a consulta de recuperação da API2 falha justamente por isso. A nota fica `rejeitada` mesmo estando autorizada, o ERP repete e o número é queimado.

Além disso:
- O fluxo `emit_nfce` **não tem** pós-consulta por chave nem tratamento de 539 (o `emit_nfe` tem pós-consulta, mas também não recupera no caso 539).
- Contingência offline (tpEmis=9) hoje só é acionada se o ERP mandar `tp_emis: 9`; não há acionamento automático quando a SEFAZ está fora (108/109/timeout).
- MDF-e e NFS-e não têm nenhuma rotina de recuperação por duplicidade.

## O que será implementado

### 1. cNF determinístico (elimina a causa do problema)
- Derivar `cNF` (8 dígitos) de forma estável a partir do `id` do documento + número + série, e enviá-lo em toda emissão de NFC-e, NF-e e MDF-e.
- Toda retransmissão passa a gerar **XML idêntico** → SEFAZ devolve 100 (ou 539 com digest igual, que é recuperável).
- Espelhar na API2: honrar `cNF` recebido no payload de emissão (hoje só é honrado na consulta por chave), e persistir o `cNF` usado por documento para reuso.

### 2. Recuperação automática em 539 (nunca mais ficar "rejeitada" indevidamente)
- Ao receber 539 em NFC-e/NF-e/MDF-e: consultar a chave na SEFAZ (`/nfe/consulta-chave`, modelos 55 e 65 — já suportado após o patch recente da API2).
  - `cStat 100` → gravar chave, protocolo, data de autorização e XML autorizado, status **autorizada**, disparar webhook `*.autorizada`.
  - Digest diferente → recompor o XML autorizado a partir do retorno da SEFAZ (fluxo de reconstrução já existente) antes de marcar autorizada.
  - Só marcar `rejeitada` se a SEFAZ confirmar que a nota não existe/foi denegada.
- Mesmo tratamento no worker de fila (`process-nfce-queue` / `process-nfe-queue`) antes de esgotar tentativas.

### 3. Contingência automática + reprocessamento
- Detectar indisponibilidade (cStat 108/109, timeout, connection reset, falha da API2) na emissão de NFC-e: em vez de rejeitar, marcar `contingencia` (tpEmis=9), enfileirar em `nfce_contingencia_queue` e responder ao ERP com `status: contingencia` + orientação de impressão.
- Worker de contingência já existente passa a retransmitir com o mesmo `cNF`/número (sem queimar numeração) e, em caso de 539, recupera pelo item 2.
- Cron do worker garantido a cada 2 minutos.

### 4. Numeração sem saltos
- Ao encerrar um documento como `rejeitada` definitiva (rejeição legítima do ERP), devolver o número ao pool `series_numeros_liberados` para NFC-e, NF-e e MDF-e (hoje só NF-e, e só na exclusão manual).
- `gerar_numero_nfce` / `gerar_numero_mdfe` passam a consumir do pool antes de incrementar a série (como já faz `gerar_numero_nfe`).

### 5. Varredura corretiva do passivo
- Rotina única que percorre todas as notas atualmente em `rejeitada` com 539 (38 NFC-e + 2 NF-e), consulta a SEFAZ e corrige as que estiverem autorizadas; relatório do que sobrou como rejeição legítima.

## Detalhes técnicos

- Arquivos: `supabase/functions/fiscal-api/index.ts` (emit_nfce, emit_nfe, emit_mdfe, novo helper `recuperar539`), `supabase/functions/nfce-api/index.ts`, `supabase/functions/process-nfce-queue/index.ts`, `process-nfe-queue/index.ts`, `nfce-contingencia-worker/index.ts`.
- Migração: função para devolver número ao pool + ajuste de `gerar_numero_nfce`/`gerar_numero_mdfe`; sem novas tabelas.
- API2 (`/var/www/fiscal-api/public/index.php`, via `api2-ssh-exec`): honrar `cNF` na emissão, retornar `cStat`/`chave` estruturados no 539 e reload do `php8.2-fpm` após o patch.
