DO $$
DECLARE f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND p.proname NOT IN ('has_role','excluir_documento_nao_processado','proximo_numero_fiscal')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.sig);
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.excluir_documento_nao_processado(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.excluir_documento_nao_processado(text, uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.proximo_numero_fiscal(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.proximo_numero_fiscal(uuid, text, text) TO authenticated, service_role;