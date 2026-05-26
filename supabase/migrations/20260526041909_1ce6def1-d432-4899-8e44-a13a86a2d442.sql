
REVOKE EXECUTE ON FUNCTION public.excluir_documento_nao_processado(text, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.excluir_documento_nao_processado(text, uuid) TO authenticated;
