CREATE OR REPLACE FUNCTION public.purge_operational_history(p_dias integer DEFAULT 60)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cut timestamptz := now() - make_interval(days => GREATEST(p_dias, 7));
  v_runs integer; v_logs integer; v_wh integer; v_cron integer := 0; v_net integer := 0;
BEGIN
  DELETE FROM public.job_runs WHERE started_at < LEAST(v_cut, now() - interval '14 days');
  GET DIAGNOSTICS v_runs = ROW_COUNT;
  DELETE FROM public.logs_fiscais WHERE created_at < v_cut;
  GET DIAGNOSTICS v_logs = ROW_COUNT;
  DELETE FROM public.webhook_logs WHERE created_at < v_cut;
  GET DIAGNOSTICS v_wh = ROW_COUNT;
  DELETE FROM public.job_locks WHERE expires_at < now() - interval '1 day';

  -- historico do agendador (pg_cron): retencao fixa de 2 dias
  BEGIN
    DELETE FROM cron.job_run_details WHERE start_time < now() - interval '2 days';
    GET DIAGNOSTICS v_cron = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN v_cron := -1;
  END;

  -- respostas HTTP internas (pg_net): retencao fixa de 1 dia
  BEGIN
    DELETE FROM net._http_response WHERE created < now() - interval '1 day';
    GET DIAGNOSTICS v_net = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN v_net := -1;
  END;

  RETURN jsonb_build_object('job_runs', v_runs, 'logs_fiscais', v_logs, 'webhook_logs', v_wh, 'cron_job_run_details', v_cron, 'net_http_response', v_net);
END;
$function$;

REVOKE ALL ON FUNCTION public.purge_operational_history(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_operational_history(integer) TO service_role;

-- Estado de saude das rotinas: detecta parada do pulso
CREATE OR REPLACE FUNCTION public.job_health()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'ultimo_tick', (SELECT max(started_at) FROM public.job_runs),
    'minutos_desde_ultimo_tick', COALESCE(round(EXTRACT(epoch FROM (now() - (SELECT max(started_at) FROM public.job_runs)))/60)::int, 9999),
    'degradado', COALESCE(EXTRACT(epoch FROM (now() - (SELECT max(started_at) FROM public.job_runs)))/60 > 10, true),
    'erros_1h', (SELECT count(*) FROM public.job_runs WHERE started_at > now() - interval '1 hour' AND status = 'error'),
    'execucoes_1h', (SELECT count(*) FROM public.job_runs WHERE started_at > now() - interval '1 hour')
  );
$function$;

REVOKE ALL ON FUNCTION public.job_health() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.job_health() TO authenticated, service_role;