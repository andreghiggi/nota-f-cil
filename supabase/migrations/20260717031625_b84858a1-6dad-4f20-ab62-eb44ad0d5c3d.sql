
-- 1) NFC-e: sem auto-insert; usa série ativa existente
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
  IF NOT EXISTS (
    SELECT 1 FROM public.series_fiscais
    WHERE empresa_id = p_empresa_id AND tipo = 'nfce' AND serie = p_serie AND ativo = true
  ) THEN
    SELECT serie INTO v_serie_efetiva
      FROM public.series_fiscais
     WHERE empresa_id = p_empresa_id AND tipo = 'nfce' AND ativo = true
     ORDER BY numero_atual DESC
     LIMIT 1;
    IF v_serie_efetiva IS NULL THEN
      RAISE EXCEPTION 'Nenhuma serie NFC-e ativa cadastrada para a empresa. Cadastre uma serie antes de emitir.'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  UPDATE public.series_fiscais
     SET numero_atual = numero_atual + 1, updated_at = now()
   WHERE empresa_id = p_empresa_id AND tipo = 'nfce' AND serie = v_serie_efetiva AND ativo = true
  RETURNING numero_atual INTO v_numero;

  IF v_numero IS NULL THEN
    RAISE EXCEPTION 'Falha ao gerar numero NFC-e: serie % nao pode ser atualizada.', v_serie_efetiva
      USING ERRCODE = 'P0001';
  END IF;

  RETURN LPAD(v_numero::TEXT, 9, '0');
END;
$function$;

-- 2) NF-e: sem auto-insert
CREATE OR REPLACE FUNCTION public.gerar_numero_nfe(p_empresa_id uuid, p_serie text DEFAULT '001'::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_numero INTEGER;
  v_serie_efetiva TEXT := p_serie;
  v_liberado_id UUID;
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
    IF v_serie_efetiva IS NULL THEN
      RAISE EXCEPTION 'Nenhuma serie NF-e ativa cadastrada para a empresa. Cadastre uma serie antes de emitir.'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- consome do pool de liberados
  SELECT id, numero INTO v_liberado_id, v_numero
    FROM public.series_numeros_liberados
   WHERE empresa_id = p_empresa_id AND tipo = 'nfe' AND serie = v_serie_efetiva
   ORDER BY numero ASC
   LIMIT 1;

  IF v_liberado_id IS NOT NULL THEN
    DELETE FROM public.series_numeros_liberados WHERE id = v_liberado_id;
    RETURN LPAD(v_numero::TEXT, 9, '0');
  END IF;

  UPDATE public.series_fiscais
     SET numero_atual = numero_atual + 1, updated_at = now()
   WHERE empresa_id = p_empresa_id AND tipo = 'nfe' AND serie = v_serie_efetiva AND ativo = true
  RETURNING numero_atual INTO v_numero;

  IF v_numero IS NULL THEN
    RAISE EXCEPTION 'Falha ao gerar numero NF-e: serie % nao pode ser atualizada.', v_serie_efetiva
      USING ERRCODE = 'P0001';
  END IF;

  RETURN LPAD(v_numero::TEXT, 9, '0');
END;
$function$;

-- 3) MDF-e: sem auto-insert
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
    IF v_serie_efetiva IS NULL THEN
      RAISE EXCEPTION 'Nenhuma serie MDF-e ativa cadastrada para a empresa. Cadastre uma serie antes de emitir.'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  UPDATE public.series_fiscais
     SET numero_atual = numero_atual + 1, updated_at = now()
   WHERE empresa_id = p_empresa_id AND tipo = 'mdfe' AND serie = v_serie_efetiva AND ativo = true
  RETURNING numero_atual INTO v_numero;

  IF v_numero IS NULL THEN
    RAISE EXCEPTION 'Falha ao gerar numero MDF-e: serie % nao pode ser atualizada.', v_serie_efetiva
      USING ERRCODE = 'P0001';
  END IF;

  RETURN LPAD(v_numero::TEXT, 9, '0');
END;
$function$;

-- 4) Consolidação da série fantasma 001 do Roni: transfere o numero_atual para a 005
-- (que era a série que o usuário realmente cadastrou) e desativa a 001.
DO $$
DECLARE
  v_emp UUID;
  v_max INTEGER;
BEGIN
  SELECT id INTO v_emp FROM public.empresas WHERE cnpj = '05755981000109' LIMIT 1;
  IF v_emp IS NULL THEN RETURN; END IF;

  SELECT COALESCE(MAX(numero_atual), 0) INTO v_max
    FROM public.series_fiscais
   WHERE empresa_id = v_emp AND tipo = 'nfce' AND serie IN ('001','005');

  UPDATE public.series_fiscais
     SET numero_atual = GREATEST(numero_atual, v_max), updated_at = now()
   WHERE empresa_id = v_emp AND tipo = 'nfce' AND serie = '005';

  UPDATE public.series_fiscais
     SET ativo = false, updated_at = now()
   WHERE empresa_id = v_emp AND tipo = 'nfce' AND serie = '001';

  UPDATE public.empresas
     SET serie_nfce = '005'
   WHERE id = v_emp;
END $$;
