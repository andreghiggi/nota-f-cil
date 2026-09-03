REVOKE ALL ON FUNCTION public.job_health() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.job_health() TO service_role;