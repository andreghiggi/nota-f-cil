-- Create webhooks table
CREATE TABLE public.webhooks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  url TEXT NOT NULL,
  secret TEXT NOT NULL,
  eventos TEXT[] NOT NULL DEFAULT ARRAY['nfce.autorizada', 'nfce.rejeitada', 'nfce.cancelada'],
  ativo BOOLEAN NOT NULL DEFAULT true,
  ultimo_envio TIMESTAMP WITH TIME ZONE,
  ultimo_status INTEGER,
  falhas_consecutivas INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.webhooks ENABLE ROW LEVEL SECURITY;

-- RLS policy for webhooks
CREATE POLICY "Users can manage webhooks via empresa"
ON public.webhooks
FOR ALL
USING (EXISTS (
  SELECT 1 FROM empresas
  WHERE empresas.id = webhooks.empresa_id
  AND empresas.user_id = auth.uid()
));

-- Create webhook logs table
CREATE TABLE public.webhook_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  webhook_id UUID NOT NULL REFERENCES public.webhooks(id) ON DELETE CASCADE,
  nfce_id UUID REFERENCES public.nfce(id) ON DELETE SET NULL,
  evento TEXT NOT NULL,
  payload JSONB NOT NULL,
  status_code INTEGER,
  response_body TEXT,
  duracao_ms INTEGER,
  sucesso BOOLEAN NOT NULL DEFAULT false,
  erro TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

-- RLS policy for webhook logs
CREATE POLICY "Users can view webhook logs via webhook"
ON public.webhook_logs
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM webhooks w
  JOIN empresas e ON e.id = w.empresa_id
  WHERE w.id = webhook_logs.webhook_id
  AND e.user_id = auth.uid()
));

-- Create index for faster queries
CREATE INDEX idx_webhooks_empresa_id ON public.webhooks(empresa_id);
CREATE INDEX idx_webhooks_ativo ON public.webhooks(ativo) WHERE ativo = true;
CREATE INDEX idx_webhook_logs_webhook_id ON public.webhook_logs(webhook_id);
CREATE INDEX idx_webhook_logs_created_at ON public.webhook_logs(created_at DESC);

-- Trigger for updated_at
CREATE TRIGGER update_webhooks_updated_at
BEFORE UPDATE ON public.webhooks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();