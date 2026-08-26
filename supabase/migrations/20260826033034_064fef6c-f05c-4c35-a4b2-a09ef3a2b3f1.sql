-- 1) Campos de série/numeração no cadastro da empresa
ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS serie_cte text NOT NULL DEFAULT '1',
  ADD COLUMN IF NOT EXISTS numero_cte_atual integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS serie_cteos text NOT NULL DEFAULT '1',
  ADD COLUMN IF NOT EXISTS numero_cteos_atual integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cte_ativo boolean NOT NULL DEFAULT false;

-- 2) Tabela principal
CREATE TABLE IF NOT EXISTS public.cte (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  token_api_id uuid REFERENCES public.tokens_api(id),
  modelo smallint NOT NULL DEFAULT 57,
  numero text NOT NULL,
  serie text NOT NULL,
  status public.nfce_status NOT NULL DEFAULT 'pendente',
  ambiente public.ambiente_sefaz NOT NULL DEFAULT 'homologacao',
  data_emissao timestamptz NOT NULL DEFAULT now(),
  tp_cte smallint NOT NULL DEFAULT 0,
  tp_serv smallint NOT NULL DEFAULT 0,
  mod_tomador smallint,
  cfop text,
  natureza_operacao text,
  uf_ini text,
  uf_fim text,
  municipio_ini text,
  municipio_fim text,
  codigo_municipio_ini text,
  codigo_municipio_fim text,
  tomador_documento text,
  tomador_nome text,
  remetente_documento text,
  remetente_nome text,
  destinatario_documento text,
  destinatario_nome text,
  expedidor_documento text,
  expedidor_nome text,
  recebedor_documento text,
  recebedor_nome text,
  valor_total numeric NOT NULL DEFAULT 0,
  valor_receber numeric,
  valor_carga numeric,
  produto_predominante text,
  peso_bruto numeric,
  cst_icms text,
  base_calculo_icms numeric,
  aliquota_icms numeric,
  valor_icms numeric,
  rntrc text,
  info_adicional text,
  chave_acesso text,
  protocolo text,
  codigo_retorno text,
  motivo_retorno text,
  xml_envio text,
  xml_retorno text,
  data_autorizacao timestamptz,
  data_cancelamento timestamptz,
  protocolo_cancelamento text,
  external_id text,
  erro_processamento text,
  tentativas integer NOT NULL DEFAULT 0,
  processado_em timestamptz,
  payload_entrada jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cte TO authenticated;
GRANT ALL ON public.cte TO service_role;
ALTER TABLE public.cte ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cte_select_own_or_admin" ON public.cte FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (SELECT 1 FROM public.empresas e WHERE e.id = cte.empresa_id AND e.user_id = auth.uid())
);
CREATE POLICY "cte_insert_own_or_admin" ON public.cte FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (SELECT 1 FROM public.empresas e WHERE e.id = cte.empresa_id AND e.user_id = auth.uid())
);
CREATE POLICY "cte_update_own_or_admin" ON public.cte FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (SELECT 1 FROM public.empresas e WHERE e.id = cte.empresa_id AND e.user_id = auth.uid())
);
CREATE POLICY "cte_delete_own_or_admin" ON public.cte FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (SELECT 1 FROM public.empresas e WHERE e.id = cte.empresa_id AND e.user_id = auth.uid())
);

CREATE INDEX IF NOT EXISTS idx_cte_empresa_data ON public.cte (empresa_id, data_emissao DESC);
CREATE INDEX IF NOT EXISTS idx_cte_status ON public.cte (status);
CREATE INDEX IF NOT EXISTS idx_cte_chave ON public.cte (chave_acesso);
CREATE INDEX IF NOT EXISTS idx_cte_external ON public.cte (external_id);
CREATE INDEX IF NOT EXISTS idx_cte_modelo ON public.cte (modelo);

CREATE TRIGGER update_cte_updated_at BEFORE UPDATE ON public.cte
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Documentos transportados
CREATE TABLE IF NOT EXISTS public.cte_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cte_id uuid NOT NULL REFERENCES public.cte(id) ON DELETE CASCADE,
  tipo text NOT NULL DEFAULT 'nfe',
  chave text,
  numero text,
  serie text,
  valor numeric,
  peso numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cte_documentos TO authenticated;
GRANT ALL ON public.cte_documentos TO service_role;
ALTER TABLE public.cte_documentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cte_documentos_select" ON public.cte_documentos FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.cte c JOIN public.empresas e ON e.id = c.empresa_id
  WHERE c.id = cte_documentos.cte_id AND (e.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));
CREATE POLICY "cte_documentos_manage" ON public.cte_documentos FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.cte c JOIN public.empresas e ON e.id = c.empresa_id
  WHERE c.id = cte_documentos.cte_id AND (e.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))))
WITH CHECK (EXISTS (SELECT 1 FROM public.cte c JOIN public.empresas e ON e.id = c.empresa_id
  WHERE c.id = cte_documentos.cte_id AND (e.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));
CREATE INDEX IF NOT EXISTS idx_cte_documentos_cte ON public.cte_documentos (cte_id);

-- 4) Eventos
CREATE TABLE IF NOT EXISTS public.cte_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cte_id uuid NOT NULL REFERENCES public.cte(id) ON DELETE CASCADE,
  tipo_evento text NOT NULL,
  sequencia integer NOT NULL DEFAULT 1,
  data_evento timestamptz NOT NULL DEFAULT now(),
  protocolo text,
  justificativa text,
  codigo_retorno text,
  motivo_retorno text,
  xml_evento text,
  xml_retorno text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cte_eventos TO authenticated;
GRANT ALL ON public.cte_eventos TO service_role;
ALTER TABLE public.cte_eventos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cte_eventos_select" ON public.cte_eventos FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.cte c JOIN public.empresas e ON e.id = c.empresa_id
  WHERE c.id = cte_eventos.cte_id AND (e.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));
CREATE POLICY "cte_eventos_manage" ON public.cte_eventos FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.cte c JOIN public.empresas e ON e.id = c.empresa_id
  WHERE c.id = cte_eventos.cte_id AND (e.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))))
WITH CHECK (EXISTS (SELECT 1 FROM public.cte c JOIN public.empresas e ON e.id = c.empresa_id
  WHERE c.id = cte_eventos.cte_id AND (e.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));
CREATE INDEX IF NOT EXISTS idx_cte_eventos_cte ON public.cte_eventos (cte_id);

-- 5) Fila de processamento
CREATE TABLE IF NOT EXISTS public.fila_processamento_cte (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cte_id uuid NOT NULL REFERENCES public.cte(id) ON DELETE CASCADE,
  prioridade integer NOT NULL DEFAULT 5,
  tentativas integer NOT NULL DEFAULT 0,
  max_tentativas integer NOT NULL DEFAULT 3,
  proximo_processamento timestamptz NOT NULL DEFAULT now(),
  erro_ultimo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.fila_processamento_cte TO authenticated;
GRANT ALL ON public.fila_processamento_cte TO service_role;
ALTER TABLE public.fila_processamento_cte ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fila_cte_select" ON public.fila_processamento_cte FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.cte c JOIN public.empresas e ON e.id = c.empresa_id
  WHERE c.id = fila_processamento_cte.cte_id AND (e.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));
CREATE INDEX IF NOT EXISTS idx_fila_cte_prox ON public.fila_processamento_cte (proximo_processamento);
CREATE TRIGGER update_fila_cte_updated_at BEFORE UPDATE ON public.fila_processamento_cte
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6) Numeração por série (mesmo padrão dos demais modelos)
CREATE OR REPLACE FUNCTION public.gerar_numero_cte(p_empresa_id uuid, p_tipo text, p_serie text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_numero integer;
  v_tipo text := lower(coalesce(p_tipo, 'cte'));
BEGIN
  IF v_tipo NOT IN ('cte', 'cteos') THEN
    RAISE EXCEPTION 'Tipo invalido para gerar_numero_cte: %', p_tipo;
  END IF;

  -- reaproveita numero liberado (rejeitado/inutilizado), se houver
  SELECT numero INTO v_numero
  FROM public.series_numeros_liberados
  WHERE empresa_id = p_empresa_id AND tipo = v_tipo AND serie = p_serie AND consumed_at IS NULL
  ORDER BY numero ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_numero IS NOT NULL THEN
    UPDATE public.series_numeros_liberados
    SET consumed_at = now()
    WHERE empresa_id = p_empresa_id AND tipo = v_tipo AND serie = p_serie AND numero = v_numero AND consumed_at IS NULL;
    RETURN lpad(v_numero::text, 9, '0');
  END IF;

  UPDATE public.series_fiscais
  SET numero_atual = numero_atual + 1, updated_at = now()
  WHERE empresa_id = p_empresa_id AND tipo = v_tipo AND serie = p_serie AND ativo = true
  RETURNING numero_atual INTO v_numero;

  IF v_numero IS NULL THEN
    RAISE EXCEPTION 'Serie % nao configurada/ativa para % nesta empresa', p_serie, v_tipo;
  END IF;

  RETURN lpad(v_numero::text, 9, '0');
END;
$$;

-- 7) Devolucao de numero ao pool em rejeicao/inutilizacao
CREATE OR REPLACE FUNCTION public.trg_pool_numero_status_cte()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tipo text;
BEGIN
  v_tipo := CASE WHEN NEW.modelo = 67 THEN 'cteos' ELSE 'cte' END;

  IF NEW.status IN ('rejeitada', 'inutilizada') AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    PERFORM public.pool_numero_sync(
      NEW.empresa_id, v_tipo, NEW.serie, NEW.numero::integer,
      (NEW.status = 'rejeitada'), NEW.status::text, NEW.id
    );
  ELSIF NEW.status = 'autorizada' AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    PERFORM public.pool_numero_sync(
      NEW.empresa_id, v_tipo, NEW.serie, NEW.numero::integer,
      false, 'autorizada', NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cte_pool_numero
AFTER UPDATE OF status ON public.cte
FOR EACH ROW EXECUTE FUNCTION public.trg_pool_numero_status_cte();