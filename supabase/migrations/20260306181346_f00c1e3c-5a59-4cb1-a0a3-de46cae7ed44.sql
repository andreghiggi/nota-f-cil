
-- Tabela de séries fiscais (NF-e e NFC-e) com múltiplas séries por empresa
CREATE TABLE public.series_fiscais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('nfe', 'nfce')),
  serie text NOT NULL,
  numero_atual integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, tipo, serie)
);

-- RLS
ALTER TABLE public.series_fiscais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage series via empresa"
ON public.series_fiscais
FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.empresas
  WHERE empresas.id = series_fiscais.empresa_id
  AND empresas.user_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.empresas
  WHERE empresas.id = series_fiscais.empresa_id
  AND empresas.user_id = auth.uid()
));

-- Migrar dados existentes das empresas para a nova tabela
INSERT INTO public.series_fiscais (empresa_id, tipo, serie, numero_atual)
SELECT id, 'nfe', serie_nfe, numero_nfe_atual FROM public.empresas;

INSERT INTO public.series_fiscais (empresa_id, tipo, serie, numero_atual)
SELECT id, 'nfce', serie_nfce, numero_nfce_atual FROM public.empresas;

-- Atualizar função gerar_numero_nfe para usar nova tabela
CREATE OR REPLACE FUNCTION public.gerar_numero_nfe(p_empresa_id uuid, p_serie text DEFAULT '001')
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_numero INTEGER;
BEGIN
  UPDATE public.series_fiscais
  SET numero_atual = numero_atual + 1, updated_at = now()
  WHERE empresa_id = p_empresa_id AND tipo = 'nfe' AND serie = p_serie AND ativo = true
  RETURNING numero_atual INTO v_numero;
  
  IF v_numero IS NULL THEN
    -- Auto-create series if not exists
    INSERT INTO public.series_fiscais (empresa_id, tipo, serie, numero_atual)
    VALUES (p_empresa_id, 'nfe', p_serie, 1)
    RETURNING numero_atual INTO v_numero;
  END IF;
  
  RETURN LPAD(v_numero::TEXT, 9, '0');
END;
$$;

-- Atualizar função gerar_numero_nfce para usar nova tabela
CREATE OR REPLACE FUNCTION public.gerar_numero_nfce(p_empresa_id uuid, p_serie text DEFAULT '001')
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_numero INTEGER;
BEGIN
  UPDATE public.series_fiscais
  SET numero_atual = numero_atual + 1, updated_at = now()
  WHERE empresa_id = p_empresa_id AND tipo = 'nfce' AND serie = p_serie AND ativo = true
  RETURNING numero_atual INTO v_numero;
  
  IF v_numero IS NULL THEN
    INSERT INTO public.series_fiscais (empresa_id, tipo, serie, numero_atual)
    VALUES (p_empresa_id, 'nfce', p_serie, 1)
    RETURNING numero_atual INTO v_numero;
  END IF;
  
  RETURN LPAD(v_numero::TEXT, 9, '0');
END;
$$;
