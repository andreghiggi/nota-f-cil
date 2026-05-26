
-- Permitir DELETE (somente status seguros) nas tabelas fiscais
CREATE POLICY "Users can delete unprocessed nfe"
ON public.nfe FOR DELETE
USING (
  status IN ('pendente','rejeitada','denegada')
  AND EXISTS (SELECT 1 FROM public.empresas e WHERE e.id = nfe.empresa_id AND e.user_id = auth.uid())
);

CREATE POLICY "Users can delete unprocessed nfce"
ON public.nfce FOR DELETE
USING (
  status IN ('pendente','rejeitada','denegada')
  AND EXISTS (SELECT 1 FROM public.empresas e WHERE e.id = nfce.empresa_id AND e.user_id = auth.uid())
);

CREATE POLICY "Users can delete unprocessed mdfe"
ON public.mdfe FOR DELETE
USING (
  status IN ('pendente','rejeitada','denegada')
  AND EXISTS (SELECT 1 FROM public.empresas e WHERE e.id = mdfe.empresa_id AND e.user_id = auth.uid())
);

-- Função única que exclui o documento e devolve a numeração quando possível
CREATE OR REPLACE FUNCTION public.excluir_documento_nao_processado(
  p_tipo text,
  p_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa uuid;
  v_numero integer;
  v_serie text;
  v_status text;
  v_user uuid := auth.uid();
  v_owner uuid;
  v_rollback boolean := false;
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
  IF v_owner IS DISTINCT FROM v_user THEN
    RAISE EXCEPTION 'sem permissão';
  END IF;

  IF v_status NOT IN ('pendente','rejeitada','denegada') THEN
    RAISE EXCEPTION 'documento status=% não pode ser excluído', v_status;
  END IF;

  -- Devolve a numeração se este é o último número emitido da série
  UPDATE public.series_fiscais
     SET numero_atual = numero_atual - 1, updated_at = now()
   WHERE empresa_id = v_empresa
     AND tipo = p_tipo
     AND serie = v_serie
     AND numero_atual = v_numero
  RETURNING true INTO v_rollback;

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
    'numeracao_devolvida', COALESCE(v_rollback, false)
  );
END;
$$;
