# Erro de leitura do certificado na NF 796 — diagnóstico e correção definitiva

## Objetivo
Descobrir por que a NF 796 falha com "erro ao ler o certificado", mesmo com o certificado reenviado várias vezes, corrigir a causa e garantir que isso não aconteça mais com as próximas empresas cadastradas.

## Etapa 1 — Diagnóstico (somente leitura, na VPS)
- Achar a NF 796 no banco da VPS (empresa, modelo, série, ambiente, mensagem de erro exata, data).
- Listar os certificados dessa empresa: quantos existem, qual está ativo, arquivo salvo, vencimento e documento (CNPJ/CPF).
- Conferir o que a API2 recebeu: registros de log do PHP na hora da emissão (senha, formato, erro do OpenSSL).
- Testar o certificado salvo direto na API2 (abrir o arquivo com a senha guardada), sem transmitir nada.

Causas mais prováveis a confirmar (nenhuma assumida antes da leitura):
1. A nota usa um certificado antigo/inativo em vez do último enviado (vários uploads, nenhum substitui o anterior).
2. Senha guardada com caracteres especiais ou acentos corrompida na conversão.
3. Certificado com criptografia antiga (RC2/3DES) que o OpenSSL 3 da API2 não abre sem o modo legado.
4. Arquivo gravado no caminho errado ou não sincronizado com a API2.
5. A validação da tela é simulada: aceita qualquer arquivo e senha, então um certificado ruim só falha na emissão.

## Etapa 2 — Correção (só a causa confirmada, mais as proteções abaixo)
- Ao enviar um novo certificado, desativar automaticamente os anteriores da empresa; a emissão usa sempre o mais recente válido.
- Validação real no envio: a API2 abre o arquivo com a senha antes de salvar e rejeita na hora, com mensagem clara (senha errada, criptografia antiga, CNPJ diferente da empresa, vencido).
- Na API2: suporte ao modo legado do OpenSSL para certificados antigos e conversão automática para um formato compatível.
- Guardar a senha sem risco de corromper caracteres especiais.
- Mensagem ao ERP com o motivo real, não apenas "erro ao ler certificado".
- Reprocessar a NF 796 com o mesmo número depois da correção.

## Regras de segurança
- Backup de cada arquivo antes de alterar, `php -l` antes de recarregar, recarga suave do serviço.
- Sem reiniciar o banco; alteração de dados só no certificado ativo da empresa afetada.
- NFC-e, NF-e e MDF-e das outras empresas não são interrompidas; se surgir algo diferente do esperado, paro e aviso.
- Resumo antes/depois no chat ao final.

## Detalhes técnicos
- Arquivos: `supabase/functions/validate-certificate` (hoje simulado, será trocado por chamada de validação real na API2), `StepCertificado.tsx` e `CertificadoUploadDialog.tsx` (desativar anteriores e validar de verdade), seleção de certificado nas funções de emissão (`fiscal-api`, `nfe-api`), endpoint de carregamento do PFX na API2 (`openssl pkcs12 -legacy` e reexportação AES-256).
- Publicação na VPS (container de funções) e na API2.
