# Review geral — processos fiscais (API e API2)

Diagnóstico feito agora com dados reais: métricas de emissão dos últimos 7 dias, execuções das rotinas automáticas (3 dias), saúde do banco, hardware e configuração da API2, e varredura de segurança.

## O que está saudável

- Rotinas automáticas estáveis: em 3 dias, 3.966 execuções e apenas 1 falha (fila NF-e, timeout de 32s). O orquestrador único com trava e disjuntor resolveu a saturação anterior.
- Banco folgado: 23/60 conexões, memória 56%, disco 10%, 472 MB, zero reinícios.
- API2 online, resposta de `/status` em 0,47s, OPcache + JIT ativos no PHP-FPM, RAM já subiu para 3,9 GB.
- Fila de NF-e vazia (nenhum documento preso).

## Falhas e riscos encontrados

### 1. Grave — código-fonte da API2 exposto publicamente
`https://api2.agilizeerp.com.br/index.php.bak`, `index.php.bak-703`, `diag_xml_ns.php` e outros respondem **HTTP 200**. Como `.bak` não é interpretado pelo PHP, o servidor entrega o **código-fonte inteiro em texto puro** — incluindo qualquer chave, caminho de certificado ou lógica de autenticação embutida. Existem 12+ arquivos `.bak` no webroot e vários `test_sign_*.php` na pasta da aplicação.

Correção: bloquear no nginx tudo que não seja `index.php` e as rotas conhecidas, mover backups para fora do webroot, remover os scripts de diagnóstico/teste e, se houver credencial no código exposto, rotacioná-la.

### 2. Hardware: ainda 1 vCPU
A RAM subiu (3,9 GB), mas `nproc` continua em **1**. Assinatura XML e geração de DANFE/DACTE são tarefas de CPU. Com `pm.max_children = 8` em 1 núcleo, duas emissões simultâneas já disputam o mesmo processador — é a causa dos picos de 20s. O upgrade de CPU precisa de power off + power on no painel (reboot interno não recria a topologia da VM).

### 3. Latência de emissão: 7 a 20s
Média medida: NFC-e 8,0s (p95 10,1s), NF-e no caminho síncrono 7–20s. Os casos de 600s+ são recuperações automáticas de rejeição, não emissão normal.

### 4. Manutenibilidade
`index.php` da API2 com 117 KB em arquivo único e `fiscal-api/index.ts` com 4.267 linhas concentram quase toda a regra fiscal. Sem versionamento na API2 (só backups `.bak` manuais), qualquer ajuste é arriscado.

### 5. Higiene de banco/auth
26 avisos do verificador: 24 funções `SECURITY DEFINER` executáveis por usuários anônimos/logados, extensão instalada no schema público e proteção contra senhas vazadas desligada.

## Plano proposto (em etapas, sem tocar no que emite hoje)

### Etapa A — Segurança imediata (API2)
1. Regra no nginx negando `.bak*`, `.php.bak`, `diag_*.php`, `test_*.php` e qualquer arquivo fora do roteador.
2. Mover todos os backups para `/var/opt/fiscal-api-backups/` (fora do webroot).
3. Remover scripts de diagnóstico e teste da pasta pública.
4. Conferir se algum arquivo exposto contém segredo; se sim, rotacionar.

### Etapa B — Agilizar o envio das notas
1. **Instrumentar por fase** (já existe log parcial): separar tempo de banco, upload/registro de certificado, assinatura, transmissão SEFAZ e gravação. Sem isso, otimização é chute.
2. **Cache de certificado na API2**: manter o PFX já convertido em cache local por empresa (com invalidação por hash), eliminando releitura/reconversão a cada emissão.
3. **Conexão persistente com a SEFAZ**: reaproveitar contexto TLS/cURL (keep-alive) entre chamadas do mesmo processo — o handshake mTLS costuma custar 300–800ms por emissão.
4. **Emissão assíncrona opcional** para o ERP: responder em <1s com `status: processando` e notificar por webhook ao autorizar. Quem preferir o modo atual continua igual (parâmetro por token/empresa).
5. **Aumentar vCPU** (2 ou 4) e reajustar `pm.max_children` proporcionalmente.
6. Reduzir partida a frio das funções: manter o `fiscal-cron-tick` tocando os endpoints `/health` das funções críticas.

### Etapa C — Estrutura de processos
1. Modularizar a API2: extrair NF-e, NFC-e, MDF-e, NFS-e e CT-e de `index.php` para arquivos de rota (o CT-e já saiu assim) e colocar a pasta sob controle de versão com deploy por script.
2. Quebrar `fiscal-api/index.ts` em módulos por modelo, mantendo o contrato externo idêntico.
3. Suíte de teste de fumaça em homologação por modelo, rodada antes de cada deploy.

### Etapa D — Assinatura digital
1. Medir o custo real da assinatura antes de trocar qualquer coisa. Se passar de ~1s por documento, avaliar assinatura via `xmlsec1` (binário em C) no lugar da implementação em PHP puro, mantendo o `sped-nfe` para montagem e transmissão.
2. Manter chave privada descriptografada apenas em memória, nunca em arquivo temporário no disco.

### Etapa E — Higiene de banco e auth
1. Revogar `EXECUTE` público das funções internas (`gerar_numero_*`, `pool_numero_sync`, `job_*`, `circuit_*`, `purge_*`), deixando-as acessíveis só ao papel de serviço.
2. Ligar proteção contra senhas vazadas.
3. Mover a extensão do schema público.

## Sugestão de ordem

A (segurança) → B1/B2/B3 (ganho direto de tempo) → vCPU → B4 (assíncrono) → E (higiene) → C/D (estrutural).

## Notas técnicas

- Nenhuma alteração de comportamento fiscal nas etapas A, B1–B3 e E; o XML enviado à SEFAZ permanece idêntico.
- A emissão assíncrona (B4) é opcional por empresa/token, sem quebrar integrações existentes.
- A modularização (C) é feita rota a rota, com backup fora do webroot e validação em homologação antes de cada troca.
