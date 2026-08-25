-- Função utilitária: devolve/remove número do pool de reuso
CREATE OR REPLACE FUNCTION public.pool_numero_sync(
  p_empresa_id uuid, p_tipo text, p_serie text, p_numero integer,
  p_devolver boolean, p_motivo text, p_origem_id uuid
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_empresa_id IS NULL OR p_numero IS NULL OR p_numero <= 0 THEN RETURN; END IF;
  IF p_devolver THEN
    INSERT INTO public.series_numeros_liberados (empresa_id, tipo, serie, numero, motivo, origem_id)
    VALUES (p_empresa_id, p_tipo, p_serie, p_numero, p_motivo, p_origem_id)
    ON CONFLICT (empresa_id, tipo, serie, numero) DO NOTHING;
  ELSE
    DELETE FROM public.series_numeros_liberados
     WHERE empresa_id = p_empresa_id AND tipo = p_tipo AND serie = p_serie AND numero = p_numero;
  END IF;
END;
$$;

-- Trigger genérico para nfe/nfce/mdfe (coluna numero text)
CREATE OR REPLACE FUNCTION public.trg_pool_numero_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tipo text := TG_ARGV[0];
  v_num integer;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  BEGIN
    v_num := (regexp_replace(NEW.numero::text, '\D', '', 'g'))::integer;
  EXCEPTION WHEN others THEN RETURN NEW;
  END;

  IF NEW.status::text = 'rejeitada' THEN
    PERFORM public.pool_numero_sync(NEW.empresa_id, v_tipo, NEW.serie::text, v_num, true, 'rejeicao_' || v_tipo, NEW.id);
  ELSIF NEW.status::text IN ('autorizada','cancelada','inutilizada','contingencia','processando') THEN
    PERFORM public.pool_numero_sync(NEW.empresa_id, v_tipo, NEW.serie::text, v_num, false, NULL, NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger para nfse (numero_dps integer)
CREATE OR REPLACE FUNCTION public.trg_pool_numero_status_nfse()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  IF NEW.status::text = 'rejeitada' THEN
    PERFORM public.pool_numero_sync(NEW.empresa_id, 'nfse', NEW.serie::text, NEW.numero_dps, true, 'rejeicao_nfse', NEW.id);
  ELSIF NEW.status::text IN ('autorizada','cancelada','inutilizada','processando') THEN
    PERFORM public.pool_numero_sync(NEW.empresa_id, 'nfse', NEW.serie::text, NEW.numero_dps, false, NULL, NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pool_numero_nfe ON public.nfe;
CREATE TRIGGER trg_pool_numero_nfe AFTER UPDATE OF status ON public.nfe
  FOR EACH ROW EXECUTE FUNCTION public.trg_pool_numero_status('nfe');

DROP TRIGGER IF EXISTS trg_pool_numero_nfce ON public.nfce;
CREATE TRIGGER trg_pool_numero_nfce AFTER UPDATE OF status ON public.nfce
  FOR EACH ROW EXECUTE FUNCTION public.trg_pool_numero_status('nfce');

DROP TRIGGER IF EXISTS trg_pool_numero_mdfe ON public.mdfe;
CREATE TRIGGER trg_pool_numero_mdfe AFTER UPDATE OF status ON public.mdfe
  FOR EACH ROW EXECUTE FUNCTION public.trg_pool_numero_status('mdfe');

DROP TRIGGER IF EXISTS trg_pool_numero_nfse ON public.nfse;
CREATE TRIGGER trg_pool_numero_nfse AFTER UPDATE OF status ON public.nfse
  FOR EACH ROW EXECUTE FUNCTION public.trg_pool_numero_status_nfse();

-- NFS-e passa a consumir do pool
CREATE OR REPLACE FUNCTION public.gerar_numero_nfse(p_empresa_id uuid, p_serie text DEFAULT '1'::text)
 RETURNS integer
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
    WHERE empresa_id = p_empresa_id AND tipo = 'nfse' AND serie = p_serie AND ativo = true
  ) THEN
    SELECT serie INTO v_serie_efetiva
      FROM public.series_fiscais
     WHERE empresa_id = p_empresa_id AND tipo = 'nfse' AND ativo = true
     ORDER BY numero_atual DESC
     LIMIT 1;
    IF v_serie_efetiva IS NULL THEN
      RAISE EXCEPTION 'Nenhuma serie NFS-e ativa cadastrada para a empresa. Cadastre uma serie antes de emitir.'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  SELECT id, numero INTO v_liberado_id, v_numero
    FROM public.series_numeros_liberados
   WHERE empresa_id = p_empresa_id AND tipo = 'nfse' AND serie = v_serie_efetiva
   ORDER BY numero ASC
   LIMIT 1;

  IF v_liberado_id IS NOT NULL THEN
    DELETE FROM public.series_numeros_liberados WHERE id = v_liberado_id;
    RETURN v_numero;
  END IF;

  UPDATE public.series_fiscais
     SET numero_atual = numero_atual + 1, updated_at = now()
   WHERE empresa_id = p_empresa_id AND tipo = 'nfse' AND serie = v_serie_efetiva AND ativo = true
  RETURNING numero_atual INTO v_numero;

  IF v_numero IS NULL THEN
    RAISE EXCEPTION 'Falha ao gerar numero NFS-e: serie % nao pode ser atualizada.', v_serie_efetiva
      USING ERRCODE = 'P0001';
  END IF;

  RETURN v_numero;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.pool_numero_sync(uuid, text, text, integer, boolean, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_pool_numero_status() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_pool_numero_status_nfse() FROM PUBLIC, anon, authenticated;