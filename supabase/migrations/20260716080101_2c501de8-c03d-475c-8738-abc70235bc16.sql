
ALTER TYPE public.nfce_status ADD VALUE IF NOT EXISTS 'abortada';

ALTER TABLE public.nfce
  ADD COLUMN IF NOT EXISTS tp_emis SMALLINT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS contingencia_dh TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS contingencia_justificativa TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS nfce_uniq_external_id_em_andamento
  ON public.nfce (empresa_id, external_id)
  WHERE external_id IS NOT NULL
    AND status IN ('pendente','processando');

CREATE TABLE IF NOT EXISTS public.nfce_contingencia_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nfce_id UUID NOT NULL REFERENCES public.nfce(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pendente',
  tentativas INT NOT NULL DEFAULT 0,
  ultimo_erro TEXT,
  proxima_tentativa TIMESTAMPTZ NOT NULL DEFAULT now(),
  emitida_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  prazo_final TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours'),
  transmitida_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(nfce_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.nfce_contingencia_queue TO authenticated;
GRANT ALL ON public.nfce_contingencia_queue TO service_role;

ALTER TABLE public.nfce_contingencia_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Empresa owner gerencia fila contingencia NFCe"
ON public.nfce_contingencia_queue FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.empresas e
    WHERE e.id = nfce_contingencia_queue.empresa_id
      AND e.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.empresas e
    WHERE e.id = nfce_contingencia_queue.empresa_id
      AND e.user_id = auth.uid()
  )
);

CREATE INDEX IF NOT EXISTS idx_nfce_contingencia_queue_pendentes
  ON public.nfce_contingencia_queue (proxima_tentativa)
  WHERE status IN ('pendente','processando');

CREATE TRIGGER trg_nfce_contingencia_queue_updated_at
  BEFORE UPDATE ON public.nfce_contingencia_queue
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
