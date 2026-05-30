
-- 1) Remove trigger que auto-criava série padrão (sobrescrevia escolha do usuário)
DROP TRIGGER IF EXISTS trg_sync_empresa_series_padrao ON public.empresas;
DROP FUNCTION IF EXISTS public.sync_empresa_series_padrao();

-- 2) gerar_numero_nfce com fallback para série ativa
CREATE OR REPLACE FUNCTION public.gerar_numero_nfce(p_empresa_id uuid, p_serie text DEFAULT '001'::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_numero INTEGER;
  v_serie_efetiva TEXT := p_serie;
BEGIN
  -- Se a série solicitada não existe ou está inativa, usa a única série ativa da empresa
  IF NOT EXISTS (
    SELECT 1 FROM public.series_fiscais
    WHERE empresa_id = p_empresa_id AND tipo = 'nfce' AND serie = p_serie AND ativo = true
  ) THEN
    SELECT serie INTO v_serie_efetiva
      FROM public.series_fiscais
     WHERE empresa_id = p_empresa_id AND tipo = 'nfce' AND ativo = true
     ORDER BY numero_atual DESC
     LIMIT 1;
    v_serie_efetiva := COALESCE(v_serie_efetiva, p_serie);
  END IF;

  UPDATE public.series_fiscais
  SET numero_atual = numero_atual + 1, updated_at = now()
  WHERE empresa_id = p_empresa_id AND tipo = 'nfce' AND serie = v_serie_efetiva AND ativo = true
  RETURNING numero_atual INTO v_numero;

  IF v_numero IS NULL THEN
    INSERT INTO public.series_fiscais (empresa_id, tipo, serie, numero_atual, ativo)
    VALUES (p_empresa_id, 'nfce', v_serie_efetiva, 1, true)
    RETURNING numero_atual INTO v_numero;
  END IF;

  RETURN LPAD(v_numero::TEXT, 9, '0');
END;
$function$;

-- 3) gerar_numero_nfe com fallback
CREATE OR REPLACE FUNCTION public.gerar_numero_nfe(p_empresa_id uuid, p_serie text DEFAULT '001'::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_numero INTEGER;
  v_serie_efetiva TEXT := p_serie;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.series_fiscais
    WHERE empresa_id = p_empresa_id AND tipo = 'nfe' AND serie = p_serie AND ativo = true
  ) THEN
    SELECT serie INTO v_serie_efetiva
      FROM public.series_fiscais
     WHERE empresa_id = p_empresa_id AND tipo = 'nfe' AND ativo = true
     ORDER BY numero_atual DESC
     LIMIT 1;
    v_serie_efetiva := COALESCE(v_serie_efetiva, p_serie);
  END IF;

  UPDATE public.series_fiscais
  SET numero_atual = numero_atual + 1, updated_at = now()
  WHERE empresa_id = p_empresa_id AND tipo = 'nfe' AND serie = v_serie_efetiva AND ativo = true
  RETURNING numero_atual INTO v_numero;

  IF v_numero IS NULL THEN
    INSERT INTO public.series_fiscais (empresa_id, tipo, serie, numero_atual, ativo)
    VALUES (p_empresa_id, 'nfe', v_serie_efetiva, 1, true)
    RETURNING numero_atual INTO v_numero;
  END IF;

  RETURN LPAD(v_numero::TEXT, 9, '0');
END;
$function$;

-- 4) gerar_numero_mdfe com fallback
CREATE OR REPLACE FUNCTION public.gerar_numero_mdfe(p_empresa_id uuid, p_serie text DEFAULT '1'::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_numero INTEGER;
  v_serie_efetiva TEXT := p_serie;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.series_fiscais
    WHERE empresa_id = p_empresa_id AND tipo = 'mdfe' AND serie = p_serie AND ativo = true
  ) THEN
    SELECT serie INTO v_serie_efetiva
      FROM public.series_fiscais
     WHERE empresa_id = p_empresa_id AND tipo = 'mdfe' AND ativo = true
     ORDER BY numero_atual DESC
     LIMIT 1;
    v_serie_efetiva := COALESCE(v_serie_efetiva, p_serie);
  END IF;

  UPDATE public.series_fiscais
  SET numero_atual = numero_atual + 1, updated_at = now()
  WHERE empresa_id = p_empresa_id AND tipo = 'mdfe' AND serie = v_serie_efetiva AND ativo = true
  RETURNING numero_atual INTO v_numero;

  IF v_numero IS NULL THEN
    INSERT INTO public.series_fiscais (empresa_id, tipo, serie, numero_atual, ativo)
    VALUES (p_empresa_id, 'mdfe', v_serie_efetiva, 1, true)
    RETURNING numero_atual INTO v_numero;
  END IF;

  RETURN LPAD(v_numero::TEXT, 9, '0');
END;
$function$;

-- 5) Sincroniza campo empresas.serie_nfce com a série ativa de Margen
UPDATE public.empresas
   SET serie_nfce = '003', numero_nfce_atual = 11545, updated_at = now()
 WHERE id = '12abef19-af89-435b-ba61-cbda9b5a4df9';
