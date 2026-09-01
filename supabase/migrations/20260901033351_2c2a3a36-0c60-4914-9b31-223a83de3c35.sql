CREATE TABLE IF NOT EXISTS public.fila_processamento_nfse (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nfse_id uuid NOT NULL REFERENCES public.nfse(id) ON DELETE CASCADE,
  prioridade integer NOT NULL DEFAULT 5,
  tentativas integer NOT NULL DEFAULT 0,
  max_tentativas integer NOT NULL DEFAULT 3,
  proximo_processamento timestamptz NOT NULL DEFAULT now(),
  erro_ultimo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.fila_processamento_nfse TO service_role;
GRANT SELECT ON public.fila_processamento_nfse TO authenticated;

ALTER TABLE public.fila_processamento_nfse ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios veem fila NFS-e das suas empresas"
ON public.fila_processamento_nfse
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.nfse n
    JOIN public.empresas e ON e.id = n.empresa_id
    WHERE n.id = fila_processamento_nfse.nfse_id
      AND (e.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  )
);

CREATE INDEX IF NOT EXISTS idx_fila_nfse_proximo ON public.fila_processamento_nfse (proximo_processamento, prioridade);
CREATE UNIQUE INDEX IF NOT EXISTS idx_fila_nfse_doc ON public.fila_processamento_nfse (nfse_id);

CREATE TRIGGER trg_fila_nfse_updated
BEFORE UPDATE ON public.fila_processamento_nfse
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();