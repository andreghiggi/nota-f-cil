# Corrigir de vez a NF-e 16231 e impedir que se repita

## O que aconteceu
A NF-e 000016231 foi rejeitada pela SEFAZ ("CNPJ do destinatário inválido"). Depois, a consulta automática pegou a chave da nota de retorno citada no pedido (de outra empresa) e marcou a 16231 como autorizada. Por isso a DANFE não sai. A trava contra isso já foi publicada na consulta de NF-e; falta corrigir a nota, procurar outros casos iguais e fechar a porta nos demais caminhos.

## O que será feito
1. **Levantamento (só leitura)**: procurar em NF-e, NFC-e, MDF-e e CT-e todas as notas cuja chave gravada não bate com o CNPJ, modelo, série ou número da própria nota. Trago a lista antes de alterar qualquer coisa.
2. **Confirmar na SEFAZ** cada nota encontrada, consultando pela chave correta dela (calculada a partir dos dados da própria nota):
   - Se a SEFAZ disser que está autorizada: gravar a chave, o protocolo e o XML corretos.
   - Se não existir na SEFAZ: voltar para "rejeitada", com o último motivo real (no caso da 16231, "CNPJ do destinatário inválido"), limpar a chave e o protocolo errados e devolver o número para ser usado de novo.
3. **Trava no banco**: impedir que qualquer nota seja gravada como autorizada com uma chave que não seja dela (CNPJ/CPF, modelo, série e número). Funciona como última barreira, mesmo se algum outro caminho errar.
4. **Mesma trava no código** das consultas e recuperações de NFC-e, MDF-e e CT-e, igual à que já foi feita na NF-e.
5. **Avisar o ERP**: enviar a atualização da 16231 (rejeitada) pelo mesmo aviso automático que ele já recebe, para o ERP liberar o reenvio com o CNPJ do destinatário corrigido.
6. **Validação**: confirmar que a 16231 aparece como rejeitada, que a DANFE de notas autorizadas continua saindo e que não há notas presas na fila.

## Regras
- Cópia de segurança das linhas antes de alterar; tudo numa transação, com relatório de antes e depois.
- Nenhuma nota autorizada de verdade é alterada.
- A emissão de NF-e, NFC-e e MDF-e continua funcionando durante a correção. Só as funções fiscais são reiniciadas (alguns segundos).
- Se aparecer algo diferente do esperado, paro e trago aqui.

## Detalhes técnicos
- Banco na VPS (`supabase-db-1`). Validação da chave: posições 7-20 = documento do emitente (com 14 dígitos), 21-22 = modelo, 23-25 = série, 26-34 = número.
- Trigger `BEFORE INSERT OR UPDATE` em `nfe`, `nfce`, `mdfe`, `cte`: se `status='autorizada'` e a chave não pertencer à nota, gera erro. Cria em `db/vps/` e aplica com `php -l`-equivalente (`BEGIN; ... ; ROLLBACK` de teste antes do commit).
- `chavePertenceANota` reaproveitado em `nfce-api`, `mdfe-api`, `cte-api` e nos caminhos de recuperação 539/573 da `fiscal-api`; publicado na VPS com backup e `docker restart supabase-functions-1`.
- Aviso ao ERP via `send-webhook` (`nfe.rejeitada`).
