-- Webhooks Bon Appetit (ComandaTech) para todas as empresas ativas.
-- Idempotente: 1 webhook Bon Appetit por empresa. Reativa e zera falhas se já existir.
-- Substitua :secret pelo valor de BON_APPETIT_WEBHOOK_SECRET antes de executar.

BEGIN;

-- 1) Reativar/atualizar os que já existem para a URL destino
UPDATE public.webhooks
SET nome = 'Bon Appetit - ComandaTech',
    ativo = true,
    falhas_consecutivas = 0,
    eventos = ARRAY['nfce.autorizada','nfce.rejeitada','nfce.cancelada','nfce.denegada'],
    secret = :'secret',
    updated_at = now()
WHERE url = 'https://iwmrtxdzlkasuzutxvhh.supabase.co/functions/v1/nfce-webhook';

-- 2) Criar para as empresas ativas que ainda não possuem
INSERT INTO public.webhooks (empresa_id, nome, url, eventos, secret, ativo, falhas_consecutivas)
SELECT e.id,
       'Bon Appetit - ComandaTech',
       'https://iwmrtxdzlkasuzutxvhh.supabase.co/functions/v1/nfce-webhook',
       ARRAY['nfce.autorizada','nfce.rejeitada','nfce.cancelada','nfce.denegada'],
       :'secret',
       true,
       0
FROM public.empresas e
WHERE e.ativo = true
  AND NOT EXISTS (
    SELECT 1 FROM public.webhooks w
    WHERE w.empresa_id = e.id
      AND w.url = 'https://iwmrtxdzlkasuzutxvhh.supabase.co/functions/v1/nfce-webhook'
  );

-- 3) Índice único que impede duplicidade de webhook Bon Appetit por empresa
CREATE UNIQUE INDEX IF NOT EXISTS webhooks_empresa_url_unico
  ON public.webhooks (empresa_id, url);

COMMIT;

-- Conferência
SELECT count(*) FILTER (WHERE ativo) AS webhooks_ativos_bonappetit
FROM public.webhooks
WHERE url = 'https://iwmrtxdzlkasuzutxvhh.supabase.co/functions/v1/nfce-webhook';
