
## Problema

O DANFE atual é gerado em React/HTML dentro do app e fica fora do padrão nacional. O download de XML também sai inconsistente. A biblioteca correta (`nfephp-org/sped-da`) já está disponível no projeto sped-nfe rodando no api2 (`api2.agilizeerp.com.br`) e gera a DANFE oficial em PDF.

A api2 hoje não tem endpoint de DANFE — precisa ser adicionado.

## Solução

Toda renderização da DANFE e do XML autorizado passa a vir do PHP (sped-da), o app só faz proxy e exibe o PDF.

### 1. PHP no api2 (`public/index.php`) — novos endpoints

`POST /nfe/danfe`
- Recebe `{ xml, logo_base64?, orientacao?, tamanho?, mostrar_canhoto?, tipo? }`
- `tipo`: `pdf` (default) ou `base64`
- Usa `NFePHP\DA\NFe\Danfe`:
  ```php
  $danfe = new Danfe($xml);
  $danfe->debugMode(false);
  $danfe->creditsIntegratorFooter('Agilize ERP');
  if ($logo) $danfe->logoParameters($logo, 'C', false);
  $pdf = $danfe->render();
  ```
- Retorna `application/pdf` direto ou JSON `{ pdf_base64 }`.

`POST /nfe/danfe-simples` (fallback)
- Mesmo contrato; renderiza retrato A4 sem logo (para chaves sem certificado).

`POST /nfce/danfe` (mesmo, usando `NFePHP\DA\NFCe\Danfce`) — fica preparado para NFC-e.

Vou entregar o snippet PHP pronto pra colar no `public/index.php` do servidor (não tenho SSH para implantar).

### 2. Edge Function `fiscal-api`

- Nova action `danfe_nfe`: recebe `nfe_id`, busca `xml_retorno` (normalizado), envia para `POST /nfe/danfe` no api2 com `tipo=base64`, devolve `{ pdf_base64, chave, numero }`.
- Mesma normalização já existente (`extractXmlCandidate` / decodificação Base64 / strip de `&lt;`).
- Cache opcional em memória por `chave_acesso` (TTL curto) para evitar regenerar.

### 3. Edge Function `nfe-api`

- `GET /nfe/{id}/danfe.pdf` → retorna `application/pdf` (binário) usando o `fiscal-api`.
- `GET /nfe/{id}/xml` → retorna o XML autorizado já normalizado (UTF-8 puro, com `<nfeProc>` quando existir), `Content-Type: application/xml`, `Content-Disposition: attachment`.
- Mantém endpoints atuais para retrocompatibilidade.

### 4. Frontend (`src/pages/NFe.tsx` + `DANFeDialog.tsx`)

- `DANFeDialog` deixa de renderizar HTML próprio. Passa a:
  1. Chamar `fiscal-api` action `danfe_nfe`.
  2. Receber `pdf_base64`, montar Blob `application/pdf` e exibir em `<iframe>` ocupando o dialog inteiro.
  3. Em modo `autoPrint`, abrir o blob em nova aba e disparar `print()` direto.
- Download XML: chama `nfe-api` (`/nfe/{id}/xml`) e salva o blob diretamente — fim das tentativas de “consertar” XML no frontend.
- Botão extra “Baixar PDF” ao lado de “Visualizar/Imprimir”.

### 5. Limpeza

- Remove a montagem manual de DANFE/HTML que está em `DANFeDialog.tsx` e qualquer normalização duplicada no client.
- Memory: atualizar `mem://funcionalidades/danfe-impressao` para registrar que DANFE é sempre PHP/sped-da.

## Detalhes técnicos

```text
React  ──► nfe-api /nfe/:id/danfe.pdf ──► fiscal-api action danfe_nfe ──► PHP /nfe/danfe (sped-da) ──► PDF
React  ──► nfe-api /nfe/:id/xml       ──► xml_retorno normalizado (UTF-8) ──► download
```

Contrato `POST /nfe/danfe` (PHP):
```json
{
  "xml": "<nfeProc ...>...</nfeProc>",
  "logo_base64": "data:image/png;base64,...",
  "orientacao": "P",
  "tamanho": "A4",
  "mostrar_canhoto": true,
  "tipo": "base64"
}
```
Resposta:
```json
{ "sucesso": true, "pdf_base64": "JVBERi0xLjQK..." }
```

## Entregáveis

1. Snippet PHP pronto pra colar (com handler `/nfe/danfe`, `/nfe/danfe-simples`, `/nfce/danfe`).
2. Edge functions `fiscal-api` (nova action) e `nfe-api` (rotas pdf/xml) atualizadas.
3. `DANFeDialog.tsx` simplificado pra usar iframe PDF.
4. Atualização de menu na página `/nfe` (Visualizar/Imprimir/Baixar PDF/Baixar XML).

## Confirmação necessária

Você consegue colar o snippet PHP no `public/index.php` do api2 e reiniciar o php-fpm? Sem esse deploy o `/nfe/danfe` não vai existir e o app não tem como gerar a DANFE nacional.
