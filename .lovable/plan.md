# Liberar o módulo CT-e / CT-e OS por completo

## Estado atual verificado

- Menu lateral já tem CT-e e CT-e OS dentro de "Módulos Fiscais"; rotas `/cte` e `/cte-os` existem e usam `CteListPage`.
- Banco já tem `cte`, `cte_documentos`, `cte_eventos`, `fila_processamento_cte` e as colunas `serie_cte`, `numero_cte_atual`, `serie_cteos`, `numero_cteos_atual`, `cte_ativo`, `rntrc` em `empresas`.
- `cte-api` responde (health 200) e cobre: emitir (57 e 67), listar, consultar por id, XML, DACTE, cancelar, carta de correção. Worker `process-cte-queue` e `sweep_539` já cobrem CT-e.
- API2 já tem `cte_routes.php` com `/cte/status`, `/cte/emitir`, `/cte/consultar`, `/cte/cancelar`, `/cte/carta-correcao`, `/cte/inutilizar`, `/cte/dacte`, e `sped-cte` instalado, tratando modelos 57 e 67.

Faltando:

- Cadastro da empresa sem nenhuma seção CT-e (só NF-e, NFC-e, MDF-e, NFS-e).
- `SeriesFiscaisManager` aceita apenas `nfe | nfce | mdfe | nfse` — não dá para criar série de CT-e nem de CT-e OS.
- Onboarding (StepSeries) não oferece CT-e / CT-e OS.
- Tela de listagem sem "Consultar SEFAZ", "Carta de Correção" e "Inutilizar".
- `cte-api` e `fiscal-api` não expõem inutilização nem consulta de chave de CT-e, apesar de a API2 já ter as rotas.
- Inutilização automática diária cobre apenas NF-e e NFC-e.
- `/health` da API2 não anuncia CT-e; DACTE do modelo 67 precisa de verificação.
- Pendência antiga: `public/index.php` da API2 ficou com erro de sintaxe após o patch do `/mdfe/consulta-chave`.

## Etapa 1 — Cadastro da empresa e séries

- Nova seção "CT-e / CT-e OS" no cadastro da empresa, no mesmo padrão da NFS-e: ativar módulo (`cte_ativo`), série e número atual de CT-e e de CT-e OS, RNTRC.
- `SeriesFiscaisManager` passa a aceitar os tipos `cte` e `cteos`, com rótulo e ícone próprios.
- Onboarding ganha os dois modelos na escolha de documentos, criando as séries iguais aos demais.

## Etapa 2 — Ações completas na tela

Adicionar ao menu de ações da listagem CT-e/CT-e OS:

- Consultar SEFAZ (atualiza status pela chave, mesmo padrão da NF-e).
- Carta de Correção (diálogo com correções e mínimo de 15 caracteres).
- Inutilizar faixa de numeração, com justificativa padrão.

## Etapa 3 — Endpoints que faltam

- `cte-api`: `POST /:id/consultar` e `POST /inutilizar`.
- `fiscal-api`: ações `consult_cte_sefaz` e `inutilizar_cte`, chamando `/cte/consultar` e `/cte/inutilizar` da API2.
- Inutilização automática diária estendida a CT-e e CT-e OS (mesma justificativa já usada).

## Etapa 4 — API2

- Corrigir o erro de sintaxe pendente em `public/index.php` (`php -l` antes e depois) e concluir o retorno de `cStat`/`xMotivo`/protocolo no `/mdfe/consulta-chave`.
- Incluir `57` e `67` em `modelo_suportado` e listar as rotas CT-e no `/health`.
- Validar a geração do DACTE do modelo 67; implementar caso a rota hoje só cubra o 57.
- Teste de ponta a ponta em homologação: emitir CT-e 57 e CT-e OS 67, consultar, imprimir DACTE, cancelar.

## Etapa 5 — Documentação e painel

- `/docs` ganha a seção CT-e / CT-e OS com autenticação, permissões (`emitir_cte`, `cte.emitir`, `cteos.emitir`, `consultar`, `cancelar`), payload completo dos modelos 57 e 67, eventos e tabela de erros.
- Dashboard passa a contar CT-e junto dos demais modelos.

## Detalhes técnicos

- Nenhuma alteração no fluxo de emissão de NF-e, NFC-e, MDF-e e NFS-e.
- Campos do cadastro usam as colunas já existentes em `empresas` — sem migração nova; só uma migração caso falte série padrão de `cteos` em `series_fiscais`.
- `cte-api` mantém o cache de token, aliases de permissão e o pool de numeração (número devolvido em rejeição, consumido só em autorização/inutilização).
- Adicionar `[functions.cte-api] verify_jwt = false` ao `config.toml` para deixar explícito o acesso por `x-api-key`.
- Alterações na API2 feitas por SSH com `php -l` obrigatório antes de recarregar o PHP-FPM.
