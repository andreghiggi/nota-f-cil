
-- 1. Tabela de números liberados (apenas NF-e por enquanto)
CREATE TABLE IF NOT EXISTS public.series_numeros_liberados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL DEFAULT 'nfe',
  serie TEXT NOT NULL,
  numero INTEGER NOT NULL,
  motivo TEXT,
  origem_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  consumed_at TIMESTAMPTZ,
  UNIQUE (empresa_id, tipo, serie, numero)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.series_numeros_liberados TO authenticated;
GRANT ALL ON public.series_numeros_liberados TO service_role;

ALTER TABLE public.series_numeros_liberados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários veem números liberados das próprias empresas"
ON public.series_numeros_liberados FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.empresas e
    WHERE e.id = series_numeros_liberados.empresa_id AND e.user_id = auth.uid()
  )
);

CREATE POLICY "Service role gerencia números liberados"
ON public.series_numeros_liberados FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_series_liberados_lookup
ON public.series_numeros_liberados (empresa_id, tipo, serie, consumed_at, numero);

-- 2. Atualiza excluir_documento_nao_processado: além de tentar recuar o contador,
--    grava o número em series_numeros_liberados quando NF-e (para reuso).
CREATE OR REPLACE FUNCTION public.excluir_documento_nao_processado(p_tipo text, p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_empresa uuid;
  v_numero integer;
  v_serie text;
  v_status text;
  v_user uuid := auth.uid();
  v_owner uuid;
  v_rollback boolean := false;
  v_liberado boolean := false;
BEGIN
  IF p_tipo NOT IN ('nfe','nfce','mdfe') THEN
    RAISE EXCEPTION 'tipo inválido';
  END IF;

  IF p_tipo = 'nfe' THEN
    SELECT empresa_id, numero::int, serie, status::text INTO v_empresa, v_numero, v_serie, v_status
      FROM public.nfe WHERE id = p_id;
  ELSIF p_tipo = 'nfce' THEN
    SELECT empresa_id, numero::int, serie, status::text INTO v_empresa, v_numero, v_serie, v_status
      FROM public.nfce WHERE id = p_id;
  ELSE
    SELECT empresa_id, numero::int, serie, status::text INTO v_empresa, v_numero, v_serie, v_status
      FROM public.mdfe WHERE id = p_id;
  END IF;

  IF v_empresa IS NULL THEN
    RAISE EXCEPTION 'documento não encontrado';
  END IF;

  SELECT user_id INTO v_owner FROM public.empresas WHERE id = v_empresa;
  IF v_user IS NOT NULL AND v_owner IS DISTINCT FROM v_user THEN
    RAISE EXCEPTION 'sem permissão';
  END IF;

  IF v_status NOT IN ('pendente','rejeitada','denegada','erro') THEN
    RAISE EXCEPTION 'documento status=% não pode ser excluído', v_status;
  END IF;

  -- Tenta recuar o contador se este é exatamente o último número emitido
  UPDATE public.series_fiscais
     SET numero_atual = numero_atual - 1, updated_at = now()
   WHERE empresa_id = v_empresa
     AND tipo = p_tipo
     AND serie = v_serie
     AND numero_atual = v_numero
  RETURNING true INTO v_rollback;

  -- Se não foi possível recuar (não era o último) e é NF-e, registra como liberado para reuso
  IF p_tipo = 'nfe' AND COALESCE(v_rollback, false) = false AND v_numero IS NOT NULL AND v_numero > 0 THEN
    INSERT INTO public.series_numeros_liberados (empresa_id, tipo, serie, numero, motivo, origem_id)
    VALUES (v_empresa, 'nfe', v_serie, v_numero, 'exclusao_status_' || v_status, p_id)
    ON CONFLICT (empresa_id, tipo, serie, numero) DO NOTHING;
    v_liberado := true;
  END IF;

  IF p_tipo = 'nfe' THEN
    DELETE FROM public.fila_processamento_nfe WHERE nfe_id = p_id;
    DELETE FROM public.nfe_itens WHERE nfe_id = p_id;
    DELETE FROM public.nfe_eventos WHERE nfe_id = p_id;
    DELETE FROM public.nfe WHERE id = p_id;
  ELSIF p_tipo = 'nfce' THEN
    DELETE FROM public.fila_processamento WHERE nfce_id = p_id;
    DELETE FROM public.nfce_itens WHERE nfce_id = p_id;
    DELETE FROM public.nfce_eventos WHERE nfce_id = p_id;
    DELETE FROM public.nfce WHERE id = p_id;
  ELSE
    DELETE FROM public.fila_processamento_mdfe WHERE mdfe_id = p_id;
    DELETE FROM public.mdfe_documentos WHERE mdfe_id = p_id;
    DELETE FROM public.mdfe_eventos WHERE mdfe_id = p_id;
    DELETE FROM public.mdfe WHERE id = p_id;
  END IF;

  RETURN jsonb_build_object(
    'sucesso', true,
    'tipo', p_tipo,
    'numero', v_numero,
    'serie', v_serie,
    'numeracao_devolvida', COALESCE(v_rollback, false),
    'numero_liberado_para_reuso', v_liberado
  );
END;
$function$;

-- 3. Atualiza gerar_numero_nfe para consumir primeiro um número liberado (apenas NF-e)
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
    v_serie_efetiva := COALESCE(v_serie_efetiva, p_serie);
  END IF;

  -- 1º) consome do pool de liberados, se houver
  SELECT id, numero INTO v_liberado_id, v_numero
    FROM public.series_numeros_liberados
   WHERE empresa_id = p_empresa_id
     AND tipo = 'nfe'
     AND serie = v_serie_efetiva
     AND consumed_at IS NULL
   ORDER BY numero ASC
   LIMIT 1
   FOR UPDATE SKIP LOCKED;

  IF v_liberado_id IS NOT NULL THEN
    DELETE FROM public.series_numeros_liberados WHERE id = v_liberado_id;
    RETURN LPAD(v_numero::TEXT, 9, '0');
  END IF;

  -- 2º) incrementa o contador normal
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
