UPDATE public.tokens_api
SET permissoes = (
  SELECT ARRAY(SELECT DISTINCT unnest(
    COALESCE(permissoes, ARRAY[]::text[]) || ARRAY[
      'emitir_nfe','emitir_nfce','emitir_mdfe','emitir_cte','emitir_nfse',
      'emitir','consultar','cancelar','inutilizar','manifestar','gerenciar','reprocessar'
    ]))
)
WHERE empresa_id = 'f51ba934-eb5d-49f2-8652-52a165c7c4ec'
  AND status = 'ativo';