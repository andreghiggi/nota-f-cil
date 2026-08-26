REVOKE EXECUTE ON FUNCTION public.gerar_numero_cte(uuid, text, text) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_pool_numero_status_cte() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gerar_numero_cte(uuid, text, text) TO service_role;