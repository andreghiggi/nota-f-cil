# Aceitar `destinatario` na NFC-e sem depender de `cliente`

## Problema

Quando o sistema parceiro envia os dados do consumidor no bloco `destinatario` (com `cpf` ou `cnpj` e `nome`), a NFC-e sai sem o consumidor identificado no XML. Hoje a nossa API só monta o destinatário quando o dado chega no bloco `cliente`.

Isso foi verificado no código: a montagem do consumidor usa exclusivamente `payload_entrada.cliente`; o bloco `destinatario` é apenas armazenado, nunca lido na emissão de NFC-e.

## Correção (escopo mínimo)

Na emissão de NFC-e, passar a aceitar o consumidor vindo de qualquer um dos blocos equivalentes, na ordem: `cliente`, `destinatario`, `dest`, `consumidor`. O primeiro bloco que trouxer um CPF/CNPJ válido é usado; se nenhum trouxer, o comportamento atual permanece igual (consumidor não identificado, ou CPF fictício em homologação).

Nada muda para quem já envia `cliente` — o resultado é idêntico ao de hoje.

## Fora do escopo

- Nenhuma alteração de telas, DANFE, NF-e, MDF-e, CT-e ou NFS-e.
- Nenhuma emissão de nota de teste.
- Nenhuma alteração no projeto do parceiro (Bon Appetit/ComandaTech).
- Nenhuma mudança no banco ou na produção da VPS.

## Detalhes técnicos

- Arquivo: `supabase/functions/fiscal-api/index.ts`.
- `buildNfceClientePayload` já normaliza `cpf`, `cnpj`, `cpf_cnpj`, `documento` e `nome`. A mudança é na chamada (linha ~1271): em vez de `nfce.payload_entrada?.cliente`, escolher o primeiro dos blocos `cliente | destinatario | dest | consumidor` que contenha documento não vazio.
- A inclusão condicional `...(clientePayload?.cpf || clientePayload?.cnpj ? { cliente: clientePayload } : {})` (linha ~1453) permanece como está, passando a receber o payload resolvido.
- Sem alterações em `nfce-api` (ela grava o payload bruto) nem na API2.
- Validação: typecheck/build; conferência do payload montado por log, sem transmitir NFC-e.
