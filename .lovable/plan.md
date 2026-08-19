# Correção: empresas criadas por API externa ficam "órfãs" no painel

## O problema (confirmado no banco)

A METALURGICA METAL MAYER foi criada pelo endpoint público de registro (Emit Smart). Esse endpoint grava a empresa com um dono fictício (`user_id = 00000000-0000-0000-0000-000000000000`), que não é nenhum usuário real.

Como as regras de acesso de séries, certificados e tokens exigem "a empresa pertence a quem está logado", nada disso pode ser criado ou lido pelo seu usuário — daí os erros ao cadastrar série e registrar certificado.

Hoje existem **7 empresas nessa situação**:
- Empresa Demo Emit Smart LTDA
- PROBE EMIT SMART
- DESTAK INDUSTRIA E COMERCIO DE BIOMASSA LTDA
- Posto Teste Migração LTDA
- 35.698.998 ANDRE GHIGGI
- METALURGICA METAL MAYER (18/08)
- ANABEL MACAN JOIAS LTDA. (19/08)

Existem regras de admin apenas para a tabela de empresas (por isso elas aparecem na lista), mas não para séries, certificados, tokens, notas, webhooks, configurações nem para o armazenamento de arquivos de certificado.

## Correções

1. **Adotar as empresas órfãs**: transferir as 7 empresas para o usuário administrador (i9informaticaesistemas@gmail.com), resolvendo imediatamente Metal Mayer e Anabel Macan.

2. **Registro externo passa a nascer com dono real**: o endpoint de registro deixa de usar o usuário fictício e passa a vincular a empresa ao administrador da plataforma (resolvido dinamicamente pela tabela de papéis, com o valor atual como último recurso). Assim novas empresas do Emit Smart já entram utilizáveis.

3. **Acesso de administrador completo**: criar regras de admin para séries fiscais, certificados digitais, tokens de API, notas (NF-e, NFC-e, MDF-e, NFS-e) e seus itens/eventos, webhooks, configurações fiscais, DF-e recebidas e números liberados — leitura e gestão. Hoje o admin enxerga a empresa, mas não os dados dela.

4. **Arquivos de certificado**: adicionar regras de administrador no bucket `certificados` (envio, leitura e exclusão), que hoje também dependem exclusivamente de propriedade direta.

5. **Varredura preventiva**: verificar se outros endpoints públicos (management-api, nfce-api, dfe-api) também criam empresas sem dono e alinhá-los à mesma regra.

## Detalhes técnicos

- Migração SQL: `UPDATE empresas SET user_id = <admin> WHERE user_id = '00000000-...'` + políticas `USING/WITH CHECK (public.has_role(auth.uid(),'admin'))` nas tabelas listadas e em `storage.objects` para `bucket_id = 'certificados'`.
- `supabase/functions/nfe-api/index.ts` (~linha 431): substituir `systemUserId` por consulta a `user_roles` (role `admin`, mais antigo) com fallback.
- Nenhuma alteração de layout; comportamento do ERP e dos tokens já emitidos permanece igual (tokens são validados por hash, não por dono).
