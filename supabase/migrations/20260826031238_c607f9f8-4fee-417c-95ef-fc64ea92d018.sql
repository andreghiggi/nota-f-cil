CREATE INDEX IF NOT EXISTS idx_nfce_itens_nfce ON public.nfce_itens (nfce_id);
CREATE INDEX IF NOT EXISTS idx_nfe_itens_nfe ON public.nfe_itens (nfe_id);
CREATE INDEX IF NOT EXISTS idx_nfce_eventos_nfce ON public.nfce_eventos (nfce_id);
CREATE INDEX IF NOT EXISTS idx_nfe_eventos_nfe ON public.nfe_eventos (nfe_id);

CREATE INDEX IF NOT EXISTS idx_nfce_emp_data ON public.nfce (empresa_id, data_emissao DESC);
CREATE INDEX IF NOT EXISTS idx_nfe_emp_data ON public.nfe (empresa_id, data_emissao DESC);
CREATE INDEX IF NOT EXISTS idx_mdfe_emp_data ON public.mdfe (empresa_id, data_emissao DESC);
CREATE INDEX IF NOT EXISTS idx_nfse_emp_data ON public.nfse (empresa_id, data_emissao DESC);

CREATE INDEX IF NOT EXISTS idx_nfe_data_emissao ON public.nfe (data_emissao DESC);
CREATE INDEX IF NOT EXISTS idx_mdfe_data_emissao ON public.mdfe (data_emissao DESC);
CREATE INDEX IF NOT EXISTS idx_nfse_data_emissao ON public.nfse (data_emissao DESC);

CREATE INDEX IF NOT EXISTS idx_mdfe_created_ambiente ON public.mdfe (created_at DESC, ambiente);
CREATE INDEX IF NOT EXISTS idx_nfse_created_ambiente ON public.nfse (created_at DESC, ambiente);
CREATE INDEX IF NOT EXISTS idx_mdfe_external_id ON public.mdfe (external_id);
CREATE INDEX IF NOT EXISTS idx_nfse_external_id ON public.nfse (external_id);
CREATE INDEX IF NOT EXISTS idx_nfse_status ON public.nfse (status);

CREATE INDEX IF NOT EXISTS idx_logs_empresa_created ON public.logs_fiscais (empresa_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_nfe_pendentes ON public.nfe (status, created_at) WHERE status IN ('pendente','processando');
CREATE INDEX IF NOT EXISTS idx_nfce_pendentes ON public.nfce (status, created_at) WHERE status IN ('pendente','processando');

ANALYZE public.nfce;
ANALYZE public.nfe;
ANALYZE public.nfce_itens;
ANALYZE public.nfe_itens;