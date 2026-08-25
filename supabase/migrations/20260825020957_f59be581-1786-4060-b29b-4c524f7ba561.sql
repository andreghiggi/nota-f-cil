REVOKE EXECUTE ON FUNCTION public.acquire_job_lock(text, text, integer) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.release_job_lock(text, text) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.job_run_start(text) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.job_run_finish(uuid, text, integer, integer, text, jsonb) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.circuit_record(text, boolean, text, integer, integer) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.purge_operational_history(integer) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.circuit_is_open(text) FROM anon, PUBLIC;

GRANT EXECUTE ON FUNCTION public.acquire_job_lock(text, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_job_lock(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.job_run_start(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.job_run_finish(uuid, text, integer, integer, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.circuit_record(text, boolean, text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.purge_operational_history(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.circuit_is_open(text) TO service_role, authenticated;