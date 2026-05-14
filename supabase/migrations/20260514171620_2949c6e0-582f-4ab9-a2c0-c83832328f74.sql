
ALTER TABLE public.mdfe
  ADD COLUMN IF NOT EXISTS tp_emit smallint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS seguros jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.mdfe.tp_emit IS '1=Carga Própria, 2=Transportador de Cargas';
COMMENT ON COLUMN public.mdfe.seguros IS 'Array de seguros: [{resp_seg, cnpj_resp|cpf_resp, seguradora_nome, seguradora_cnpj, n_apolice, n_averbacoes:[]}]';
