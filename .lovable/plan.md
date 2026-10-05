# Corrigir só a NF-e 16231 e devolver sempre o motivo "CNPJ inválido"

## O que aconteceu
A NF-e 000016231 foi rejeitada pela SEFAZ ("Rejeição 208: CNPJ do destinatário inválido"). Depois, a consulta automática gravou nela a chave de outra nota (a nota de retorno citada no pedido) e a marcou como autorizada. A trava que impede essa troca de chave já foi publicada.

## O que será feito
1. **Somente a nota 16231** (nenhuma outra nota ou loja é alterada):
   - Guardar uma cópia dos dados atuais dela.
   - Voltar o status para "rejeitada", com código 208 e motivo "Rejeição: CNPJ do destinatário inválido".
   - Apagar a chave e o protocolo da outra nota gravados nela.
   - Devolver o número para o ERP reenviar com o CNPJ corrigido.
2. **Mensagem sempre clara para a 208**: quando a SEFAZ devolver "CNPJ do destinatário inválido", o ERP recebe:
   - o código 208 e o texto da SEFAZ;
   - o CNPJ que foi enviado;
   - a orientação: "Corrija o CNPJ do destinatário e reenvie".

   A nota fica como rejeitada e nunca é tratada como autorizada.
3. **Validação**: confirmar que a 16231 aparece como rejeitada com esse motivo e que a DANFE das notas autorizadas continua saindo.

## Regras
- Nenhuma alteração em outras notas ou lojas.
- A emissão continua funcionando; só as funções fiscais são reiniciadas (alguns segundos), com cópia de segurança.

## Detalhes técnicos
- Banco da VPS: `UPDATE nfe` só no `id` `e056adab-6e54-4fa0-b370-848f9a0e60a2`. Campos alterados: `status='rejeitada'`, `codigo_retorno='208'`, `motivo_retorno`, e `chave_acesso`, `protocolo` e `data_autorizacao` = NULL. A cópia fica antes em `/root/backup-nfe-16231.json`.
- `fiscal-api`: no tratamento da rejeição, mapear cStat 208 para uma mensagem padrão que traz o documento do destinatário enviado. O mapeamento vale para qualquer nota futura, sem tocar em dados antigos. Publicado na VPS com backup e `docker restart supabase-functions-1`.
