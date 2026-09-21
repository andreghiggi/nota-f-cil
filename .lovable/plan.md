# Auditoria: reforma tributária e CT-e na API da VPS

Levantamento feito agora, direto no servidor da Locaweb, apenas lendo arquivos e consultando o banco. Nada foi alterado.

## O que já está funcionando na reforma

- A biblioteca fiscal instalada já é a geração nova (sped-nfe 5.x, layout 4.00 com o pacote de schemas PL_010_V1.30), ou seja, a base aceita os campos da reforma.
- Por item, a nota já monta o grupo IBS/CBS quando o ERP manda os dados (ou liga a chave `enviar_ibs_cbs`), incluindo base de cálculo, CST e classificação tributária (`cClassTrib`, com padrão 000001 quando vem inválida).
- Os totais de IBS/CBS da nota já são somados e enviados.
- Se o ERP não mandar nada de reforma, a nota sai como hoje, sem os campos novos. Esse comportamento está preservado.

Conclusão: o mínimo está de pé para NF-e e NFC-e.

## O que ainda falta na reforma

1. Imposto Seletivo (IS): a biblioteca já tem suporte, mas a nossa API nunca monta esse grupo. Nota de produto sujeito ao IS sai incompleta.
2. Grupos complementares de IBS/CBS não implementados: crédito presumido, tributação regular, diferimento, devolução de tributo e redução de alíquota. Hoje só sai o cálculo simples.
3. Divergência de configuração: um dos pontos de montagem da NF-e usa o pacote de schemas antigo (`PL_010_V1`) enquanto o restante usa `PL_010_V1.30`. Precisa ficar tudo no mesmo.
4. Validação de entrada ausente: classificação tributária inválida é silenciosamente trocada por 000001, e não há conferência entre CST informado e os valores. Isso vira rejeição na SEFAZ sem aviso claro para o ERP.
5. Impressão: nem o DANFE nem o cupom da NFC-e mostram qualquer informação de IBS/CBS/IS. O XML sai com os dados e o papel não.
6. Demais modelos sem reforma: CT-e, CT-e OS, MDF-e e NFS-e não têm nenhum tratamento de IBS/CBS.
7. Sem eventos da reforma (crédito presumido, apropriação, manifestação do destinatário sobre tributos) — a biblioteca já traz, a API não expõe.
8. Painel e documentação: os campos novos não aparecem nas telas nem estão descritos por completo no manual de integração.

## Situação real do CT-e

- Existem 4 CT-e modelo 57 no banco: 2 autorizados ("Autorizado o uso do CT-e") e 2 rejeitados com "Fatal error PHP na API fiscal CT-e".
- Nenhum CT-e OS (modelo 67) foi emitido até hoje — esse caminho nunca foi exercitado em produção.
- A fila de CT-e está vazia (nada travado).
- Só 2 séries de CT-e cadastradas, e nenhuma das 31 empresas está com o módulo CT-e marcado como ativo, mesmo tendo emissão acontecendo. Ou seja, a chave de ativação não está sendo respeitada/pedida.

### O que falta para o CT-e emitir tranquilo

1. Descobrir e corrigir a causa do erro fatal de PHP nas duas rejeições (hoje o ERP recebe uma mensagem genérica, sem o motivo real).
2. Trocar a resposta genérica por erro descritivo, para o ERP saber o que corrigir.
3. Preencher campos que hoje estão fixos ou vazios: data de saída da origem, chegada no destino, indicador de CT-e globalizado.
4. Testar de ponta a ponta o CT-e OS (modelo 67) em homologação: emitir, consultar, imprimir e cancelar.
5. Alinhar a ativação por empresa: ou passar a exigir o módulo ativo, ou remover a exigência para não confundir.
6. Conferir a impressão do DACTE do modelo 67.

## Sugestão de ordem de execução (quando você autorizar)

1. Corrigir o erro fatal do CT-e e a mensagem de erro devolvida.
2. Fechar o teste do CT-e OS em homologação.
3. Unificar o pacote de schemas da NF-e e adicionar validação clara dos campos da reforma.
4. Imposto Seletivo e grupos complementares de IBS/CBS.
5. Mostrar a reforma no DANFE e no cupom.
6. Estender a reforma aos demais modelos e atualizar o manual.

## Notas técnicas

- Servidor: 191.252.179.49, API2 em `/opt/apps/agilize-apis/api2`, banco em container `supabase-db-1`.
- Reforma na NF-e/NFC-e: `public/index.php` (grupo por item ~linhas 421-520; totais ~2105-2152).
- CT-e: `public/cte_routes.php` (emitir, consultar, cancelar, CC-e, inutilizar, DACTE, XML).
- Nesta auditoria nada foi escrito: apenas leitura de arquivos e SELECT no banco.
