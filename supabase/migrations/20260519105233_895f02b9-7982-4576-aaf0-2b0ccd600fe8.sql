
-- 1) Backfill: Basaltear serie 002 NF-e continuando de 16131
INSERT INTO public.series_fiscais (empresa_id, tipo, serie, numero_atual, ativo)
VALUES ('4c37e0fe-39d5-4f30-bbc3-5261e051f207', 'nfe', '002', 16131, true)
ON CONFLICT DO NOTHING;

-- 2) Função para consultar próximo número (sem incrementar)
CREATE OR REPLACE FUNCTION public.proximo_numero_fiscal(
  p_empresa_id uuid,
  p_tipo text,
  p_serie text
)
RETURNS TABLE(serie text, ultimo_numero integer, proximo_numero integer, ativo boolean)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT s.serie, s.numero_atual, s.numero_atual + 1, s.ativo
  FROM public.series_fiscais s
  WHERE s.empresa_id = p_empresa_id
    AND s.tipo = p_tipo
    AND s.serie = p_serie
  LIMIT 1;
END;
$$;

-- 3) Trigger: garante que a série padrão da empresa exista em series_fiscais
CREATE OR REPLACE FUNCTION public.sync_empresa_series_padrao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.serie_nfe IS NOT NULL AND NEW.serie_nfe <> '' THEN
    INSERT INTO public.series_fiscais (empresa_id, tipo, serie, numero_atual, ativo)
    VALUES (NEW.id, 'nfe', NEW.serie_nfe, COALESCE(NEW.numero_nfe_atual, 0), true)
    ON CONFLICT DO NOTHING;
  END IF;

  IF NEW.serie_nfce IS NOT NULL AND NEW.serie_nfce <> '' THEN
    INSERT INTO public.series_fiscais (empresa_id, tipo, serie, numero_atual, ativo)
    VALUES (NEW.id, 'nfce', NEW.serie_nfce, COALESCE(NEW.numero_nfce_atual, 0), true)
    ON CONFLICT DO NOTHING;
  END IF;

  IF NEW.serie_mdfe IS NOT NULL AND NEW.serie_mdfe <> '' THEN
    INSERT INTO public.series_fiscais (empresa_id, tipo, serie, numero_atual, ativo)
    VALUES (NEW.id, 'mdfe', NEW.serie_mdfe, COALESCE(NEW.numero_mdfe_atual, 0), true)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_empresa_series_padrao ON public.empresas;
CREATE TRIGGER trg_sync_empresa_series_padrao
AFTER INSERT OR UPDATE OF serie_nfe, serie_nfce, serie_mdfe ON public.empresas
FOR EACH ROW
EXECUTE FUNCTION public.sync_empresa_series_padrao();

-- Garante unicidade (necessário para o ON CONFLICT acima funcionar de forma confiável)
CREATE UNIQUE INDEX IF NOT EXISTS series_fiscais_empresa_tipo_serie_key
ON public.series_fiscais (empresa_id, tipo, serie);
