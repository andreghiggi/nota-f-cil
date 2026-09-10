# Abrir a plataforma para outra empresa (parceiro) com isolamento total

Objetivo: um segundo parceiro usar a mesma plataforma nos ERPs dele, com empresas, notas, certificados e tokens totalmente separados dos da i9, documentação pronta (NF-e e NFC-e, incluindo IBS/CBS) e rotinas fiscais funcionando.

## Regra inegociável: nenhuma empresa da i9 pode parar

Nada do que está emitindo hoje pode ser interrompido. Por isso:

- Toda mudança de acesso é feita **adicionando** vínculo de parceiro, com as empresas atuais já migradas para o parceiro "i9" na mesma operação — nunca fica uma empresa sem dono.
- As chaves e tokens que os ERPs atuais já usam continuam válidos, sem regeneração e sem troca de URL.
- A chave de parceiro no cadastro é **opcional**: quem não enviar continua caindo na conta i9, exatamente como hoje.
- Cada etapa é aplicada e conferida em separado; após cada uma, faço uma emissão de teste e confirmo que as listagens da i9 seguem completas antes de seguir.
- Se qualquer verificação apontar risco de perda de acesso, a etapa é revertida na hora.

## O que verifiquei agora



- A VPS nova está no Brasil e respondendo bem: `api2.agilizeerp.com.br` no IP 191.252.179.49, resposta em 0,7s, anunciando os modelos 55, 65, 58, 57, 67 e NFS-e nacional. Integração ativa.
- O cadastro automático de empresa pela API (`/nfe-api/register`) hoje vincula toda empresa nova ao **primeiro administrador da plataforma** — ou seja, as empresas do parceiro nasceriam dentro da conta da i9. Esse é o ponto crítico a corrigir.
- A documentação atual (página no painel e o HTML público de NF-e) **não descreve IBS/CBS** e não existe HTML público de NFC-e, embora a API já aceite esses campos quando o ERP envia `enviar_ibs_cbs`.
- As regras de acesso no banco são por dono do registro (`user_id` da empresa) mais uma exceção global de administrador. O banco estava indisponível no momento da checagem, então o estado exato das regras será reconferido antes de alterar qualquer coisa.

## Etapas

### 1. Verificação inicial (antes de mudar qualquer coisa)
Reconferir no banco: regras de acesso vigentes por tabela, quantas empresas estão hoje sob o administrador i9 e quais nasceram via API, e o estado das rotinas automáticas (fila, pulso do agendador, sweeps).

### 2. Contas de parceiro (isolamento real)
- Nova tabela de **parceiros** e vínculo de usuários a parceiros (um parceiro pode ter vários usuários da equipe).
- Coluna de parceiro nas empresas; backfill de todas as empresas atuais para o parceiro "i9".
- Regras de acesso reescritas: cada usuário enxerga as empresas do seu parceiro (e os documentos, certificados, séries, tokens, notas recebidas e filas ligados a elas). O administrador i9 continua com visão global.
- Painel: seletor/rótulo do parceiro e listas filtradas automaticamente.

### 3. Cadastro pela API vinculado ao parceiro
- `/nfe-api/register` passa a exigir uma **chave de parceiro** (`x-partner-key`); a empresa criada nasce dentro daquele parceiro, nunca mais na conta da i9.
- Chamadas sem chave continuam funcionando por compatibilidade, caindo no parceiro i9 (comportamento atual), para não quebrar quem já integra.
- Tela de gestão de parceiros para a i9: criar parceiro, gerar/revogar chave, ver empresas e consumo.

### 4. Habilitação fiscal ponta a ponta para o parceiro
Revisar e garantir, na conta do parceiro: cadastro de empresa, upload de certificado, CSC da NFC-e, séries fiscais (NF-e/NFC-e), ambiente homologação→produção e emissão de teste. Corrigir o que travar nesse fluxo quando o usuário não é administrador.

### 5. Documentação atualizada
- Página de Documentação no painel: seção NF-e e NFC-e revisadas, com **bloco IBS/CBS** (campos aceitos, quando enviar, exemplo de payload e resposta) e o cadastro automático de empresa com chave de parceiro.
- HTML público: atualizar `docs-nfe.html` e criar `docs-nfce.html` equivalente, ambos com IBS/CBS, webhooks, erros e limites.

### 6. Fechamento
Rodar um cadastro completo de parceiro fictício ponta a ponta em homologação (empresa → certificado → série → emissão NF-e e NFC-e), confirmar que a conta i9 não enxerga esses dados e que o parceiro não enxerga os da i9.

## Detalhes técnicos

- Novas tabelas `parceiros` e `parceiro_usuarios`; `empresas.parceiro_id` com backfill e NOT NULL ao final.
- Função `security definer` `parceiro_do_usuario(uuid)` usada nas políticas RLS, evitando recursão; políticas atuais reescritas de `user_id = auth.uid()` para `parceiro_id = parceiro_do_usuario(auth.uid()) OR has_role(auth.uid(),'admin')`.
- Chave de parceiro armazenada como hash (mesmo padrão dos tokens API), validada em `nfe-api`, `nfce-api` e `management-api`.
- Nenhuma alteração de URL de produção, tokens de clientes existentes ou fluxo da API2.
