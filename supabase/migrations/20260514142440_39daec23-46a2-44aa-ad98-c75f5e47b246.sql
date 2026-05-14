UPDATE public.tokens_api
SET permissoes = array_append(permissoes, 'emitir_mdfe'),
    updated_at = now()
WHERE empresa_id = '4c37e0fe-39d5-4f30-bbc3-5261e051f207'
  AND NOT ('emitir_mdfe' = ANY(permissoes));