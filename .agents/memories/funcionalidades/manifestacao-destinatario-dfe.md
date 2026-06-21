---
name: Manifestação do Destinatário (DF-e)
description: Sincronização e manifestação de NF-e destinadas à empresa — NFeDistribuicaoDFe + RecepcaoEvento via api2/sped-nfe
type: feature
---
**Rotas PHP (api2 /var/www/fiscal-api/public/index.php — ANTES do catch-all `sucesso([`):**
- `POST /nfe/dist-dfe` → Tools::sefazDistDFe($ultNSU, $numNSU). Retorna `{cStat, xMotivo, ultNSU, maxNSU, xml_retorno (base64 do retDistDFe)}`.
- `POST /nfe/manifestar` → Tools::sefazManifesta($chave, $xJust, $tpEvento). tpEventos: 210200 Confirmação, 210210 Ciência, 210220 Desconhecimento, 210240 Não Realizada. Justificativa ≥15 obrigatória para 210220/210240.

**ATENÇÃO:** OPcache do php-fpm 8.2 mantém código antigo. Após alterar `public/index.php` SEMPRE executar `systemctl reload php8.2-fpm`.

**Edge function `dfe-api`** (3 modos de auth):
- `x-api-key` → token API (ERP externo)
- `x-internal-cron: true` + body.empresa_id → uso interno pelo cron pg_cron, só `/sync`
- JWT do app → valida ownership da empresa via `empresas.user_id`

Endpoints: `POST /sync`, `GET /` (lista com filtro status), `GET /:id`, `GET /:id/xml`, `POST /:id/manifestar` (tipo: ciencia|confirmacao|desconhecimento|nao_realizada).

**Persistência (SEFAZ retorna docs gzipados em `<docZip schema="..." NSU="...">`):**
- `dfe_recebidas` — uma linha por chave (resumo/completo/evento). UNIQUE(empresa_id, chave_acesso). Upsert ao sincronizar.
- `dfe_eventos` — histórico de manifestações enviadas.
- `dfe_distribuicao_controle` — `ultimo_nsu` por empresa para consulta incremental.

**Cron pg_cron `dfe-sync-15min`** roda `dfe_sync_all_empresas()` a cada 15 min disparando `dfe-api/sync` via `net.http_post` para cada empresa ativa cujo `ultima_consulta < now() - intervalo_minutos`.

**XML completo só vem após manifestar Ciência ou Confirmação** — antes disso a SEFAZ devolve apenas `resNFe` (resumo). Página `/notas-recebidas` informa isso no rodapé.
