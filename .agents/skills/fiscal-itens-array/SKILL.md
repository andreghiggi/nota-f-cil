---
name: fiscal-itens-array
description: PHP fiscal-api exige itens como array JSON (não objeto). Sempre Object.values(itensObj) no payload de NFC-e/NF-e.
type: constraint
---

A api2 PHP (sped-nfe) usa `fiscal_tag_ibscbs_tot(): array $itens` com tipagem estrita. Se o Edge Function enviar `itens` como objeto JS `{ "0": {...}, "1": {...} }`, `json_decode` no PHP gera `stdClass` → fatal TypeError → toda emissão quebra.

**Regra:** ao montar payload para `fiscal-api/index.php`, `itens` deve ser sempre array JSON:
```ts
itens: Object.values(itensObj)
```
Nunca `itens: itensObj`.

Aplica a NFC-e (linha ~819) e NF-e (linha ~1381) em `supabase/functions/fiscal-api/index.ts`.
