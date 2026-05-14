ALTER TABLE public.mdfe ALTER COLUMN tp_emit SET DEFAULT 2;

UPDATE public.mdfe
SET status = 'pendente',
    tp_emit = 2,
    payload_entrada = jsonb_set(payload_entrada, '{tp_emit}', '2'::jsonb),
    erro_processamento = NULL,
    motivo_retorno = NULL,
    tentativas = 0
WHERE status = 'rejeitada'
  AND motivo_retorno LIKE '%698%';

INSERT INTO public.fila_processamento_mdfe (mdfe_id, prioridade, tentativas, proximo_processamento)
SELECT m.id, 5, 0, now()
FROM public.mdfe m
WHERE m.status = 'pendente'
  AND NOT EXISTS (
    SELECT 1 FROM public.fila_processamento_mdfe f
    WHERE f.mdfe_id = m.id AND f.tentativas < f.max_tentativas
  );