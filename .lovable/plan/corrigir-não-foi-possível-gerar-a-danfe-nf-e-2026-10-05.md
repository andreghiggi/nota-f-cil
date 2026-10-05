# Corrigir "Não foi possível gerar a DANFE" (NF-e)

## O que está acontecendo
A tela da DANFE pede o PDF para a função fiscal; ela respondeu com erro e a tela mostra só a mensagem genérica. A causa ainda não está confirmada. Pode ser a função na VPS, a geração do PDF na API2 ou o ambiente do preview (que aponta para o backend pausado).

## O que será feito
1. **Diagnóstico (só leitura)**
   - Ver os registros da função fiscal na VPS (`supabase-functions-1`) na ação `danfe_nfe`, no horário do erro.
   - Testar a rota de DANFE da API2 (`/nfe/danfe`) com o XML de uma nota autorizada e ver o log do PHP (erro de biblioteca, memória, XML vazio ou logo inválida).
   - Confirmar se a nota tem o XML autorizado salvo.
2. **Correção pontual**, só no ponto que o diagnóstico mostrar:
   - Função: devolver o motivo real do erro para a tela, em vez do genérico, e usar o XML correto (com protocolo) para gerar o PDF.
   - API2: corrigir o trecho que falha na geração do PDF, com cópia de segurança e `php -l` antes da recarga suave.
   - Tela: mostrar a mensagem real devolvida pela função.
3. **Validação**: gerar a DANFE de uma NF-e autorizada e confirmar que o PDF abre.

## Fora do escopo
- Sem mudar dados de notas, sem reenviar nada para a SEFAZ.
- Sem mexer em NFC-e, MDF-e, CT-e ou na transmissão. A emissão continua funcionando durante a correção.
- Se a causa for diferente do previsto e tiver risco, paro e trago o resultado aqui.

## Detalhes técnicos
- Frontend: `src/components/nfe/DANFeDialog.tsx` usa `supabase.functions.invoke("fiscal-api", { action: "danfe_nfe" })`; ler `error.context` para extrair o JSON de erro.
- Backend: `supabase/functions/fiscal-api/index.ts`, ação `danfe_nfe` → API2 `POST /nfe/danfe` (`tipo: base64`). Deploy na VPS com backup e `docker restart supabase-functions-1`.
