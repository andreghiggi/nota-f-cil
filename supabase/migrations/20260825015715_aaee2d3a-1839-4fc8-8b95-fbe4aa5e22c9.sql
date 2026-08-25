CREATE INDEX IF NOT EXISTS idx_nfe_empresa_created ON public.nfe (empresa_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_nfe_status ON public.nfe (status);
CREATE INDEX IF NOT EXISTS idx_nfe_chave_acesso ON public.nfe (chave_acesso);
CREATE INDEX IF NOT EXISTS idx_nfe_external_id ON public.nfe (external_id);
CREATE INDEX IF NOT EXISTS idx_nfe_created_ambiente ON public.nfe (created_at DESC, ambiente);
CREATE INDEX IF NOT EXISTS idx_nfce_empresa_created ON public.nfce (empresa_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_nfce_created_ambiente ON public.nfce (created_at DESC, ambiente);
CREATE INDEX IF NOT EXISTS idx_nfce_empresa_status ON public.nfce (empresa_id, status);

SELECT cron.alter_job(2, schedule => '*/2 * * * *');
SELECT cron.alter_job(3, schedule => '1-59/2 * * * *');
SELECT cron.alter_job(5, schedule => '*/5 * * * *');
