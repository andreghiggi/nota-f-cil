# Reestruturação do painel fiscal + CT-e / CT-e OS

Entrega em etapas independentes. Nenhuma etapa altera a lógica de emissão já em produção (NF-e, NFC-e, MDF-e, NFS-e continuam usando exatamente os mesmos endpoints e regras fiscais de hoje).

## Estado atual verificado

- Menu lateral hoje lista 13 itens soltos (Dashboard, Empresas, Novo Cliente, NF-e, NFC-e, MDF-e, NFS-e, Notas Recebidas, Certificados, Tokens, Webhooks, Logs, Configurações).
- A API2 responde `modelo_suportado: ["55","65","58","nfse-nacional"]`. **CT-e (57) e CT-e OS (67) não existem** — nem lá, nem aqui (sem tabelas, sem edge function, sem tela).
- As telas fiscais divergem: NF-e tem DANFE + cancelar + inutilizar + reprocessar; NFC-e tem XML/cancelar/inutilizar mas não DANFE em PDF pelo mesmo padrão; MDF-e tem encerrar/cancelar sem DAMDFE; NFS-e tem consultar/cancelar/XML sem DANFSe na lista. **Nenhuma das quatro tem filtro por período.**

## Etapa 1 — Menu e navegação (primeira entrega)

Novo agrupamento na sidebar, com submenus expansíveis:

```text
Dashboard
Empresas
Novo Cliente
Módulos Fiscais
  NF-e | NFC-e | MDF-e | NFS-e | CT-e | CT-e OS
Manifestação Eletrônica
  Notas Recebidas
Configurações
  Certificados | Tokens API | Webhooks | Logs | Parâmetros
Documentação API
```

- Grupo abre automaticamente quando a rota ativa pertence a ele; estado lembrado no localStorage.
- Rotas atuais preservadas (`/nfe`, `/nfce`, ...); novas rotas `/cte` e `/cte-os`.
- Nesta etapa CT-e e CT-e OS aparecem já navegáveis, com a tela padrão vazia até a Etapa 4.

## Etapa 2 — Tela padrão dos módulos fiscais

Componente único de listagem (`FiscalDocumentPage`) reaproveitado por todos os modelos, com o layout do NF-e como referência:

- Busca por número, chave de acesso, destinatário/tomador e ID externo.
- Filtro por empresa (multiempresa), status e **período** (atalhos hoje / 7 dias / 30 dias / mês / intervalo personalizado).
- Paginação server-side e ordenação por data de emissão.
- Coluna de ações padronizada por modelo: Consultar SEFAZ, DANFE/DANFCE/DAMDFE/DANFSe/DACTE (PDF padrão nacional), Baixar XML, Cancelar, Inutilizar, Reprocessar, além das específicas (Encerrar/Incluir condutor no MDF-e).
- Ações que hoje não existem passam a chamar endpoints já disponíveis na API2 (ex.: DAMDFE, DANFSe) sem tocar no fluxo de emissão.

## Etapa 3 — Performance

Investigação com medição antes de mudar código, cobrindo os dois lados:

- Instrumentar `fiscal-api` / `nfe-api` com marcas de tempo por fase (validação, montagem, chamada API2, persistência) e registrar em `job_runs`/`logs_fiscais`.
- Medir na API2 o tempo de assinatura, handshake mTLS e resposta SEFAZ.
- Suspeitas a confirmar: handshake TLS recriado a cada chamada, leitura/decodificação do certificado a cada requisição, gravação síncrona de XML grande, índices ausentes em `nfe/nfce/mdfe (empresa_id, data_emissao, status)`.
- Otimizações aplicadas só depois do diagnóstico, com o relatório antes/depois.

## Etapa 4 — CT-e (57) e CT-e OS (67) completos

1. **API2**: instalar `sped-cte`, criar as rotas espelhando o padrão do MDF-e — `/cte/status`, `/cte/emitir`, `/cte/consulta-chave`, `/cte/cancelar`, `/cte/inutilizar`, `/cte/carta-correcao`, `/cte/dacte`, `/cte/xml`, e as equivalentes de CT-e OS (modelo 67).
2. **Banco**: tabelas `cte`, `cte_itens`/`cte_documentos`, `cte_eventos`, `fila_processamento_cte`, séries em `series_fiscais`, com RLS por empresa igual aos demais modelos.
3. **Edge function `cte-api`**: mesmo contrato de autenticação por token, mesma normalização de permissões, mesmo pool de numeração (número devolvido em rejeição, consumido só em autorização/inutilização).
4. **Frontend**: telas `/cte` e `/cte-os` usando o componente da Etapa 2.
5. Inclusão no orquestrador `fiscal-cron-tick` (fila, varredura 539, inutilização automática).

## Etapa 5 — Sincronizar atualizações da API2

Levantar as rotas fiscais que a API2 já expõe e ainda não são chamadas daqui (ex.: `mdfe/incluir-condutor`, `mdfe/incluir-dfe`, `mdfe/nao-encerrados`, `mdfe/dist-dfe`, `nfse/pdf`) e ligá-las nas telas e edge functions correspondentes.

## Etapa 6 — Documentação pública completa

- Página `/docs` já é pública; ampliar para cobrir todos os módulos com o mesmo formato: autenticação, permissões, payload completo, exemplos de request/response, tabela de erros e eventos.
- Um índice lateral por modelo (NF-e, NFC-e, MDF-e, NFS-e, CT-e, CT-e OS, Manifestação, Webhooks, Management API).
- Link público destacado e `sitemap`/meta tags para a página.

## Etapa 7 — Revisão multiempresa e checklist final

- Auditar RLS e filtros por `empresa_id` em todas as tabelas novas e telas novas, incluindo o caso de empresas criadas via API externa (donas = admin).
- Conferir que toda listagem respeita o seletor de ambiente (homologação/produção).
- Relatório final com o que restou em aberto.

## Detalhes técnicos

- Sidebar reescrita com componente de grupo próprio (sem trocar a biblioteca de UI); rotas novas registradas em `src/App.tsx`.
- `FiscalDocumentPage` genérico em `src/components/fiscal/`, parametrizado por modelo (tabela, colunas, ações, labels); páginas atuais passam a ser configurações finas desse componente, preservando handlers existentes de XML/DANFE/cancelamento.
- Filtro de período aplicado em `data_emissao` com range no servidor, não no cliente.
- `cte-api` segue o mesmo esqueleto de `mdfe-api` (cache de token 60s, `/health`, `marcarUltimoUso`).
- Nenhuma alteração em `nfe-api`, `nfce-api`, `mdfe-api` e `nfse-api` nas Etapas 1, 2 e 6.
