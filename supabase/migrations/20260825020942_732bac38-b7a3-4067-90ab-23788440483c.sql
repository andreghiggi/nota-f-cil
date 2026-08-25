-- ============ Travas de execução ============
CREATE TABLE IF NOT EXISTS public.job_locks (
  key text PRIMARY KEY,
  owner text NOT NULL,
  acquired_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
GRANT ALL ON public.job_locks TO service_role;
GRANT SELECT ON public.job_locks TO authenticated;
ALTER TABLE public.job_locks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins podem ver travas" ON public.job_locks
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ============ Histórico de execuções ============
CREATE TABLE IF NOT EXISTS public.job_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job text NOT NULL,
  status text NOT NULL DEFAULT 'running',
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  duration_ms integer,
  processed integer NOT NULL DEFAULT 0,
  errors integer NOT NULL DEFAULT 0,
  erro text,
  detalhes jsonb
);
CREATE INDEX IF NOT EXISTS idx_job_runs_job_started ON public.job_runs (job, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_runs_started ON public.job_runs (started_at DESC);
GRANT ALL ON public.job_runs TO service_role;
GRANT SELECT ON public.job_runs TO authenticated;
ALTER TABLE public.job_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins podem ver execucoes" ON public.job_runs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ============ Disjuntor ============
CREATE TABLE IF NOT EXISTS public.job_circuit (
  key text PRIMARY KEY,
  consecutive_failures integer NOT NULL DEFAULT 0,
  open_until timestamptz,
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.job_circuit TO service_role;
GRANT SELECT ON public.job_circuit TO authenticated;
ALTER TABLE public.job_circuit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins podem ver disjuntor" ON public.job_circuit
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ============ Funções ============
CREATE OR REPLACE FUNCTION public.acquire_job_lock(p_key text, p_owner text, p_ttl_seconds integer DEFAULT 300)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_ok boolean := false;
BEGIN
  DELETE FROM public.job_locks WHERE key = p_key AND expires_at < now();
  INSERT INTO public.job_locks (key, owner, acquired_at, expires_at)
  VALUES (p_key, p_owner, now(), now() + make_interval(secs => GREATEST(p_ttl_seconds, 10)))
  ON CONFLICT (key) DO NOTHING;
  GET DIAGNOSTICS v_ok = ROW_COUNT;
  RETURN v_ok;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_job_lock(p_key text, p_owner text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  DELETE FROM public.job_locks WHERE key = p_key AND owner = p_owner;
$$;

CREATE OR REPLACE FUNCTION public.job_run_start(p_job text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.job_runs (job, status) VALUES (p_job, 'running') RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.job_run_finish(
  p_run_id uuid,
  p_status text,
  p_processed integer DEFAULT 0,
  p_errors integer DEFAULT 0,
  p_erro text DEFAULT NULL,
  p_detalhes jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  UPDATE public.job_runs
     SET status = p_status,
         finished_at = now(),
         duration_ms = (EXTRACT(EPOCH FROM (now() - started_at)) * 1000)::integer,
         processed = COALESCE(p_processed, 0),
         errors = COALESCE(p_errors, 0),
         erro = p_erro,
         detalhes = p_detalhes
   WHERE id = p_run_id;
$$;

CREATE OR REPLACE FUNCTION public.circuit_is_open(p_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE((SELECT open_until > now() FROM public.job_circuit WHERE key = p_key), false);
$$;

CREATE OR REPLACE FUNCTION public.circuit_record(
  p_key text,
  p_ok boolean,
  p_error text DEFAULT NULL,
  p_threshold integer DEFAULT 5,
  p_cooldown_seconds integer DEFAULT 300
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF p_ok THEN
    INSERT INTO public.job_circuit (key, consecutive_failures, open_until, last_error, updated_at)
    VALUES (p_key, 0, NULL, NULL, now())
    ON CONFLICT (key) DO UPDATE
      SET consecutive_failures = 0, open_until = NULL, last_error = NULL, updated_at = now();
  ELSE
    INSERT INTO public.job_circuit (key, consecutive_failures, last_error, updated_at)
    VALUES (p_key, 1, p_error, now())
    ON CONFLICT (key) DO UPDATE
      SET consecutive_failures = public.job_circuit.consecutive_failures + 1,
          last_error = p_error,
          updated_at = now(),
          open_until = CASE
            WHEN public.job_circuit.consecutive_failures + 1 >= p_threshold
              THEN now() + make_interval(secs => GREATEST(p_cooldown_seconds, 30))
            ELSE public.job_circuit.open_until
          END;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.purge_operational_history(p_dias integer DEFAULT 60)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cut timestamptz := now() - make_interval(days => GREATEST(p_dias, 7));
  v_runs integer; v_logs integer; v_wh integer;
BEGIN
  DELETE FROM public.job_runs WHERE started_at < LEAST(v_cut, now() - interval '14 days');
  GET DIAGNOSTICS v_runs = ROW_COUNT;
  DELETE FROM public.logs_fiscais WHERE created_at < v_cut;
  GET DIAGNOSTICS v_logs = ROW_COUNT;
  DELETE FROM public.webhook_logs WHERE created_at < v_cut;
  GET DIAGNOSTICS v_wh = ROW_COUNT;
  DELETE FROM public.job_locks WHERE expires_at < now() - interval '1 day';
  RETURN jsonb_build_object('job_runs', v_runs, 'logs_fiscais', v_logs, 'webhook_logs', v_wh);
END;
$$;