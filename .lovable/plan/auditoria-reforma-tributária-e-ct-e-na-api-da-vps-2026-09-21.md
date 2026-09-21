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

## Impacto nas lojas hoje

- A auditoria em si não parou nada: só leitura de arquivos e consultas. Venda e emissão seguem normais.
- Nada do que falta na reforma para hoje: enquanto o ERP não mandar os campos novos, as notas saem como sempre. As lojas não param por isso.
- O risco real de parada está no CT-e, e só no transporte: o erro de PHP já derrubou 2 emissões. Não afeta NFC-e nem NF-e das lojas.
- Quando a reforma passar a ser exigida pela SEFAZ, aí sim os itens pendentes viram bloqueio — por isso vale resolver antes, com calma.
- As correções propostas são feitas por etapa, com teste em homologação antes, e podem ser revertidas. Nenhuma toca no fluxo atual de NFC-e em horário de loja.

## Execução na janela das 00:01

Escopo desta execução (apenas o que foi auditado, nada além):

1. Corrigir a causa do erro fatal de PHP no CT-e e devolver o motivo real ao ERP em vez da mensagem genérica.
2. Preencher no CT-e os campos hoje fixos/vazios: saída da origem, chegada no destino e indicador de globalizado.
3. Unificar o pacote de schemas da NF-e (um ponto ainda usa `PL_010_V1`, o resto usa `PL_010_V1.30`).
4. Avisar com mensagem clara quando a classificação tributária da reforma vier inválida, em vez de trocar em silêncio por 000001.

Ficam de fora desta rodada (mudanças maiores, para uma etapa própria): Imposto Seletivo, grupos complementares de IBS/CBS, reforma no DANFE/cupom, reforma nos demais modelos e teste do CT-e OS.

Regras da execução:

- Cada arquivo alterado tem cópia de segurança antes, e `php -l` antes de recarregar.
- Recarga suave do serviço; sem reinício do banco e sem mexer em dados.
- Se aparecer algo diferente do que foi auditado, paro e deixo como está, sem alterar.
- Comparação antes/depois e um resumo completo no chat ao final.

Sobre o horário: eu não consigo ficar aguardando até 00:01 — assim que você aprovar, a execução acontece. Duas opções: você aprova por volta das 00:01 e eu executo na hora, ou aprova agora e eu executo imediatamente (as mudanças acima não interrompem emissão de NFC-e/NF-e; só o CT-e fica alguns segundos indisponível na recarga).

## Notas técnicas

- Servidor: 191.252.179.49, API2 em `/opt/apps/agilize-apis/api2`, banco em container `supabase-db-1`.
- Reforma na NF-e/NFC-e: `public/index.php` (grupo por item ~linhas 421-520; totais ~2105-2152).
- CT-e: `public/cte_routes.php` (emitir, consultar, cancelar, CC-e, inutilizar, DACTE, XML).
- Nesta auditoria nada foi escrito: apenas leitura de arquivos e SELECT no banco.
