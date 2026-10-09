# Rejeição 1080 (Total de IBS UF) em NFC-e com 3+ itens — Avenida Gastropub

## O que o cliente relata
- CNPJ 03.464.186/0001-28. NFC-e com 1 item ou com divisão exata autoriza; com 3 itens e sobra de centavo (3 x R$15,00, IBS 0,1%) sempre rejeita com 1080.
- Mesmo quando a soma dos itens enviada bate com o total, a nota é rejeitada. Isso indica que o total vem de um cálculo nosso, não da soma do que o ERP envia.
- Ainda não confirmamos a causa; o passo 1 serve para isso.
- Também passou a receber "Token sem permissão para emitir NFC-e (Permission denied)".

## Passos
1. **Diagnóstico (somente leitura, na VPS)**: pegar as NFC-e rejeitadas com 1080 dessa empresa. Comparar o XML enviado (vIBSUF de cada item) com o total `vIBSUF` do grupo IBSCBSTot. Verificar no caminho da NFC-e (fiscal-api e API2) de onde sai o total: soma dos itens arredondados ou valor total × alíquota.
2. **Correção pontual**: na NFC-e, o total de IBS UF, IBS Mun, CBS e IBS geral passa a ser sempre a soma dos valores de cada item, já arredondados com 2 casas, como já é feito na NF-e. Quando o ERP mandar o valor por item, ele é respeitado. Aplicar o mesmo na API2, se ela recalcular o total.
3. **Token**: conferir na VPS o token dessa empresa (está ativo, tem permissão de NFC-e, está ligado à empresa certa). Não existe bloqueio automático por excesso de requisições. Se faltar a permissão, só informo e não altero nada sem a sua autorização.
4. **Validação**: gerar o XML de uma NFC-e de 3 x R$15,00 em homologação, ou só a montagem do XML sem enviar, e confirmar que total = soma dos itens (0,05). Conferir que NFC-e de outras lojas continua autorizando e que nenhuma nota ficou presa.
5. **Resposta ao cliente**: texto pronto respondendo às 3 perguntas, com um exemplo de payload que funciona.

## Regras
- Backup antes de editar, `php -l` antes de recarregar, recarga suave. Não mexer em notas nem em outras lojas.
- Se a causa for diferente da descrita acima, paro e trago aqui antes de mudar.

## Detalhes técnicos
- NF-e já agrega em `fiscal-api/index.ts` (~linha 2363) com `r2` por item. A NFC-e monta `gIBSCBS` por item (~linha 1401) e precisa usar o mesmo agregador para `IBSCBSTot`.
- O cálculo por item (~linha 69) usa `toFixed(2)`. Revisar se o total é recalculado a partir de `valor_total`.
- O erro de permissão vem de `nfce-api` (`PERMISSION_DENIED`): checar `api_tokens.permissoes` e o vínculo com a empresa.
