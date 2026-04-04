
## Plano de Correção — Pontos de Atenção

### 1️⃣ fiscal-api crash em GET sem body (Severidade: Baixa)
**Problema**: A fiscal-api faz `await req.json()` na linha 20 sem verificar se há body, causando crash 500 em qualquer request GET (health checks, monitoring).
**Solução**: Adicionar verificação de method GET antes do `req.json()` retornando `{ status: "ok" }`.
**Impacto**: Permite health checks e monitoramento.

### 2️⃣ NF-e Produtor Rural CPF — Rejeição 253 (Severidade: Média)
**Problema**: Bug conhecido da SEFAZ RS em homologação para emitentes CPF. O DV é calculado corretamente com padding 14 dígitos + timezone -03:00, mas a SEFAZ rejeita.
**Solução**: Não há correção de código possível — é bug da SEFAZ. **Ação**: Documentar o cenário e preparar teste em produção quando autorizado pelo cliente. Verificar se o PHP está montando a chave corretamente via log de debug.
**Impacto**: Nenhuma alteração de código necessária agora.

### 3️⃣ Extensão pg_net no schema public (Severidade: Baixa)
**Problema**: A extensão `pg_net` está instalada no schema `public` em vez de `extensions`. É um warning de segurança do linter.
**Solução**: Migração SQL para mover a extensão: `ALTER EXTENSION pg_net SET SCHEMA extensions;`
**Impacto**: Melhora a postura de segurança.

### 4️⃣ Leaked Password Protection desabilitada (Severidade: Baixa)
**Problema**: A proteção contra senhas vazadas (HaveIBeenPwned) está desativada no auth.
**Solução**: Habilitar via configuração de auth.
**Impacto**: Usuários não poderão usar senhas que apareceram em vazamentos conhecidos.

### 5️⃣ Verificação do PHP/VPS para produtor rural (Severidade: Média)
**Problema**: Precisamos confirmar se o backend PHP está gerando a chave de acesso corretamente para CPF.
**Solução**: Acessar a VPS e verificar o log de debug (`/tmp/fiscal_debug.log`) da última tentativa de emissão do produtor rural, validando campo por campo da chave de 44 dígitos.
**Impacto**: Diagnóstico definitivo se é bug SEFAZ ou nosso.

---

**Resumo**: 
- Itens 1 e 3: correções rápidas de código/migração
- Item 4: configuração de auth
- Itens 2 e 5: diagnóstico via VPS (sem mudança de ambiente)
- **Nenhuma alteração para produção será feita**
