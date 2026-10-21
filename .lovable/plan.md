# NFS-e Débora (MEI) — rejeição 160: diagnóstico e correção proposta

## Fatos levantados (somente leitura)

**1. Origem do `opSimpNac`.** Vem da API2, em `nfse_map_simples()` (`api2/public/nfse_routes.php`). Ele lê a coluna `empresas.nfse_op_simp` do MySQL da API2, que é copiada da coluna `nfse_op_simples` do Fiscal Flow em `syncNfseConfig()` (`nfse_op_simp: empresa.nfse_op_simples ?? 0`) a cada emissão.

```text
$op = (int)($empresa['nfse_op_simp'] ?? 0);
if ($op === 2) return MEI;          // opSimpNac=2
if ($op === 3) return MeEpp;        // opSimpNac=3
if ($op === 1) return NaoOptante;   // opSimpNac=1
if (in_array($crt, [1, 2])) return MeEpp;   // fallback pelo CRT
return NaoOptante;
```

Não há mapeamento a partir de `regime_tributario = 'mei'` porque esse valor não existe: o tipo aceita só `simples_nacional`, `lucro_presumido` e `lucro_real`. A única forma de sair MEI é `nfse_op_simples = 2`, o campo "Situação no Simples Nacional" da seção NFS-e do cadastro da empresa.

**2. O que está gravado para Débora.**
- Fiscal Flow: `regime_tributario = simples_nacional`, `nfse_op_simples = 0` ("Não informar"), `nfse_reg_esp = 0`, IM vazia.
- API2 (id 10248): `crt = 1`, `nfse_op_simp = 0`, `nfse_reg_esp = 0`, `nfse_tpAmb = 2`.
- Resultado: `op = 0` cai no fallback do CRT 1, que gera `opSimpNac = 3` (ME/EPP). Essa é a causa da rejeição 160.

**3. Outros campos da DPS que dependem de ser MEI.**
- `regEspTrib`: sai 0 (Nenhum), coerente.
- `regApTribSN`: só é emitido se informado, e a rota não informa. Coerente para MEI.
- `IM`: omitida quando vazia, coerente (o próprio SDK registra que MEI com IM pode dar cStat 120).
- `tribISSQN` = 1 e `pAliq` em `tribMun`: `pAliq` não é emitido, porque a rota não passa `aliquotaMunicipal`.
- `totTrib`: hoje sempre sai `pTotTrib`, com `pTotTribMun` igual à alíquota recebida (padrão 5.00). Para MEI, o emissor web da SEFIN usa `<indTotTrib>0</indTotTrib>`, o que no SDK exige `motivoDispensaIssqn`. A rota nunca preenche esse campo. Esse é o próximo ponto provável de divergência depois que o `opSimpNac` estiver certo.
- `vServ`, retenção e demais campos não dependem de ser MEI.

## Correção proposta (só depois do seu "aprovado")

1. **Dado da empresa (só Débora):** gravar `nfse_op_simples = 2` no Fiscal Flow. A sincronização da próxima emissão leva o valor para `nfse_op_simp` da API2. Backup do valor anterior e reversão em um passo.
2. **Proteção geral (opcional, peço sua decisão):** na API2, quando `nfse_op_simp = 0`, deixar de supor ME/EPP pelo CRT e registrar um aviso. Isso afeta outras empresas do Simples que hoje dependem do fallback, por isso não está incluído sem sua aprovação.
3. **`totTrib` para MEI:** quando `opSimpNac = 2`, emitir `indTotTrib = 0` (dispensa) em vez de `pTotTrib` com 5.00. É uma mudança só na API2 e só para MEI. Só aplico se a SEFIN rejeitar depois do passo 1, ou se você preferir antecipar.
4. **Teste sem transmitir, como `www-data`:** gerar a DPS de Débora pelo caminho real até a assinatura, validar contra o XSD de 20/10 e mostrar `opSimpNac = 2` e `totTrib`, com a assinatura válida. Nenhuma nota é emitida.

## Detalhes técnicos

- Arquivos envolvidos: `api2/public/nfse_routes.php` (`nfse_map_simples`, montagem de `NfseValores`), `supabase/functions/fiscal-api/nfse.ts` (`syncNfseConfig`) e a tabela `public.empresas` (coluna `nfse_op_simples`).
- Os passos 2 e 3 não tocam NF-e, NFC-e, MDF-e, CT-e nem `vendor/`. O passo 1 é uma única linha de dado.
