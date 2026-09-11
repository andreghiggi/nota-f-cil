# Limpeza segura das NFC-e fantasmas — Marcelo Monfrini e Cozinha da Ruiva

## Objetivo

Regularizar somente as NFC-e de Marcelo Monfrini e Cozinha da Ruiva, preservando toda tentativa fiscal válida e garantindo que as próximas emissões do ERP continuem na sequência correta.

## Etapas

### 1. Levantar os registros reais na VPS
- Localizar as duas empresas pelo CNPJ/identificador, sem depender apenas do nome.
- Listar NFC-e pendentes, processando, abortadas e rejeitadas, junto com série, número, `external_id`, chave, protocolo, retorno da SEFAZ, horários e itens das filas.
- Detectar números repetidos e distinguir registros visuais duplicados de transmissões fiscais diferentes.

### 2. Reconciliar cada número com a SEFAZ
- Para toda suspeita de nota fantasma, consultar primeiro a chave informada na rejeição 539; depois, as demais chaves conhecidas/calculadas daquele número.
- Se a SEFAZ confirmar autorização, manter um único registro canônico como `autorizada`, trazendo chave, protocolo e XML corretos, e retirar apenas cópias internas e filas redundantes.
- Se houver tentativa válida ainda não autorizada, preservar o registro e reprocessar com o mesmo número e o mesmo `cNF`.
- Se a SEFAZ confirmar que o número não existe, devolver o número ao pool para a próxima tentativa. Não reutilizar número autorizado, cancelado ou inutilizado.

### 3. Corrigir sequência e limpar resíduos
- Remover somente filas órfãs, cópias internas comprovadas e referências que poderiam retransmitir uma nota já concluída.
- Ajustar o contador de cada série para refletir o maior número fiscal efetivamente consumido, considerando também números disponíveis no pool.
- Executar a limpeza em transação e registrar um relatório antes/depois, permitindo reversão dos ajustes internos.

### 4. Validar a integração do ERP
- Confirmar que a proteção por `external_id` e NSU evita retries duplicados.
- Confirmar que o `cNF` é determinístico e reaproveitado nas retransmissões tanto na API quanto na API2.
- Verificar que a API interna chama a API2 pelo endereço correto e que worker, trava e disjuntor estão saudáveis.
- Fazer uma emissão controlada por empresa, quando houver novo envio real do ERP, e acompanhar até o status final e o webhook.

### 5. Entrega do diagnóstico final
- Informar, nota a nota, quais eram fantasmas, quais já estavam autorizadas, quais foram preservadas/reprocessadas e quais números voltaram ao pool.
- Informar a série e o próximo número válido de cada empresa.
- Confirmar fila zerada, ausência de registros presos e resultado dos novos envios do ERP.

## Regras de segurança

- Produção permanece na VPS; o backend Cloud não será ligado nem alterado.
- Nenhuma nota é apagada antes da conferência na SEFAZ.
- Nenhuma autorização existente é retransmitida, inutilizada ou colocada novamente no pool.
- A limpeza fica restrita a Marcelo Monfrini e Cozinha da Ruiva.
