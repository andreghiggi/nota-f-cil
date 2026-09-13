# Fazer o CNPJ do cliente aparecer no cupom (DANFE da NFC-e)

## O que está acontecendo

O cupom só mostra o CNPJ/CPF quando essa informação está dentro da própria nota autorizada. Nas vendas recentes, o sistema do cliente está enviando os dados do comprador num campo alternativo (`destinatario`), e o servidor que está no ar hoje ainda ignora esse campo — então a nota sai sem comprador e o cupom imprime "CONSUMIDOR NÃO IDENTIFICADO".

Verificado agora:
- As últimas notas (000005600 a 000005604) chegaram com o comprador em `destinatario`, não em `cliente`.
- O servidor de produção está rodando uma versão do código de 10/09, anterior à correção que já foi feita aqui no projeto.
- A geração do cupom já imprime "CONSUMIDOR - CNPJ ..." automaticamente quando a nota tem o comprador; não precisa mexer no layout do cupom.

## O que será feito

1. Publicar no servidor de produção a correção já pronta: aceitar o comprador enviado em `cliente`, `destinatario`, `dest` ou `consumidor`, usando o primeiro que trouxer CPF/CNPJ válido.
2. Reiniciar apenas o serviço das funções fiscais no servidor, sem tocar em banco, certificados ou demais rotinas.
3. Conferir, na próxima nota emitida de verdade, que o comprador consta na nota autorizada e que o cupom sai com "CONSUMIDOR - CNPJ ...".

## Fora do escopo

- Nenhuma alteração de telas, layout do cupom, NF-e, MDF-e, CT-e ou NFS-e.
- Nenhuma emissão de teste em produção, nenhum cancelamento e nenhuma alteração em notas já autorizadas.
- Notas já emitidas sem o comprador continuam como estão (a informação não existe na nota autorizada e não pode ser acrescentada depois).

## Detalhes técnicos

- Correção já aplicada localmente em `supabase/functions/fiscal-api/index.ts`: antes de chamar `buildNfceClientePayload`, escolhe entre `payload_entrada.cliente | destinatario | dest | consumidor` o primeiro bloco com `cpf`/`cnpj`/`cpf_cnpj`/`documento` com 11+ dígitos.
- Deploy: atualizar `/opt/apps/agilize-apis/supabase/functions/fiscal-api/index.ts` na VPS (191.252.179.49), preservando backup do arquivo atual, e recriar o container `supabase-functions-1` mantendo os `extra_hosts` já configurados.
- Sem alterações na API2/PHP: `NFePHP\DA\NFe\Danfce` (TraitBlocoVII) já imprime CNPJ/CPF a partir de `<dest>`.
- Validação: conferir na próxima NFC-e autorizada que `xml_retorno` contém `<dest><CNPJ>` e gerar o PDF do cupom dessa nota.
