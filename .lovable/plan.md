# Duplicidade NFC-e em agosto, recuperação de status e desempenho

## O que os dados mostram (agosto/2026, produção)

- 268 NFC-e processadas, **13 rejeitadas**. Destas, **10 são de duplicidade (cStat 539)**:
  - Cozinha da Ruiva: 13937, 13948, 13957, 14023, 14085, 14086, 14087
  - Margen Pizzaria (série 3): 11653, 11654
  - JP Refrigeração: 1372
- As outras 3 são rejeições legítimas do ERP: 386 (CFOP x CSOSN) nas 1368/1369 e 866 (ausência de troco) na 5400.
- Em todas as 10, a mensagem da SEFAZ traz a chave do documento que **já existe autorizado**, e ela difere da chave que gravamos. Exemplo da 14087:
  - chave que transmitimos: `...0000140871874713576` (cNF 87471357)
  - chave que a SEFAZ já tinha: `...0000140871947277347` (cNF 94727734)
- Ou seja: a primeira transmissão chegou à SEFAZ com um cNF **diferente** do cNF determinístico que a API aqui calcula e envia. Isso indica que a API2 ainda está sorteando o cNF em pelo menos uma parte do fluxo de NFC-e (modelo 65), ignorando o `cNF` forçado — a correção aplicada anteriormente não está valendo para esse caminho.
- A recuperação automática existe mas falhou: a mensagem gravada é `NF-e duplicada — consulta retornou []`, gerada pela API2. A consulta por chave voltou vazia, então nem a API2 nem a rotina daqui conseguiram fechar o status.

## Tempo de processamento

- Mediana 5,2s, p90 6,4s, máximo 355s. Não há medição separada de cada etapa (fila, API2, assinatura, SEFAZ), então hoje não dá para afirmar onde estão os segundos.

## O que será feito

### 1. Varredura e correção das 10 notas de agosto
- Para cada nota, extrair a chave real que a SEFAZ informou na mensagem de rejeição.
- Consultar essa chave na SEFAZ (modelo 65) e, se autorizada, gravar chave, protocolo, data de autorização, XML e status `autorizada`.
- Se a consulta indicar que não consta, manter rejeitada e devolver o número ao pool de reuso, sem buraco de numeração.
- Entregar um relatório nota a nota com o status final.

### 2. Corrigir a causa raiz na API2
- Auditar o fluxo de NFC-e (modelo 65) na API2 e garantir que o `cNF` enviado seja sempre respeitado, sem sorteio, igual ao que já vale para NF-e.
- Recarregar o PHP-FPM depois do ajuste (o OPcache mantém código antigo).

### 3. Corrigir a recuperação automática do 539
- Priorizar sempre a chave que vem entre colchetes na mensagem da SEFAZ, antes da chave calculada.
- Tratar retorno vazio da consulta como falha temporária e repetir, em vez de encerrar como rejeitada.
- Quando a consulta confirmar autorização, gravar também o XML autorizado para o DANFE e o ERP.
- Aplicar a mesma correção nos dois lados (aqui e na API2), e estender o mesmo tratamento para NF-e, MDF-e e NFS-e.

### 4. Rede de segurança
- Rotina periódica que varre notas rejeitadas por duplicidade nas últimas 48h e tenta a recuperação sozinha, para nenhuma nota ficar presa esperando intervenção manual.

### 5. Diagnóstico de desempenho
- Registrar o tempo de cada etapa (enfileiramento, chamada à API2, assinatura, ida à SEFAZ, gravação) nos logs de cada emissão.
- Com uma amostra desses tempos, atacar o gargalo real; as suspeitas atuais são espera na fila entre execuções do worker e latência da própria SEFAZ, mas isso só se confirma com a medição.

## Detalhes técnicos

- `supabase/functions/fiscal-api/index.ts`: ajustar `recuperarDuplicidade539` (ordem das chaves candidatas, retry em resposta vazia, gravação do XML) e reaproveitá-la nos fluxos de NF-e/MDF-e.
- API2 `/var/www/fiscal-api/public/index.php`: garantir `fiscal_cnf_forcado()` no `tagide` do modelo 65 e corrigir o handler interno de 539 que hoje devolve `consulta retornou []`.
- Instrumentação de tempo via `console.time`/marcos nos logs da edge function, sem alterar contrato de resposta.
- Correções de dados nas 10 notas por atualização direta, após confirmação chave a chave na SEFAZ.
