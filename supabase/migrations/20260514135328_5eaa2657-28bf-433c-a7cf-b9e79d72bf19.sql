
-- Empresas: campos MDF-e
ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS serie_mdfe text NOT NULL DEFAULT '1',
  ADD COLUMN IF NOT EXISTS numero_mdfe_atual integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rntrc text;

-- Tabela MDF-e
CREATE TABLE IF NOT EXISTS public.mdfe (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  token_api_id uuid,
  numero text NOT NULL,
  serie text NOT NULL DEFAULT '1',
  modal smallint NOT NULL DEFAULT 1, -- 1=rodoviario, 2=aereo, 3=aquaviario, 4=ferroviario
  status nfce_status NOT NULL DEFAULT 'pendente',
  ambiente ambiente_sefaz NOT NULL,
  data_emissao timestamptz NOT NULL DEFAULT now(),
  uf_ini text NOT NULL,
  uf_fim text NOT NULL,
  uf_percurso text[] DEFAULT '{}',
  -- Veículo
  placa text,
  uf_placa text,
  tara integer,
  cap_kg integer,
  cap_m3 integer,
  rntrc text,
  -- Condutor (principal)
  condutor_nome text,
  condutor_cpf text,
  -- Totais
  valor_carga numeric(15,2) DEFAULT 0,
  peso_bruto numeric(15,4) DEFAULT 0,
  unidade_peso smallint DEFAULT 1, -- 1=KG, 2=TON
  qtd_documentos integer DEFAULT 0,
  -- Carga
  produto_predominante text,
  cep_carregamento text,
  cep_descarregamento text,
  info_adicional text,
  -- Retorno SEFAZ
  chave_acesso text,
  protocolo text,
  xml_envio text,
  xml_retorno text,
  codigo_retorno text,
  motivo_retorno text,
  data_autorizacao timestamptz,
  data_encerramento timestamptz,
  data_cancelamento timestamptz,
  protocolo_encerramento text,
  protocolo_cancelamento text,
  external_id text,
  erro_processamento text,
  tentativas integer NOT NULL DEFAULT 0,
  processado_em timestamptz,
  payload_entrada jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mdfe_empresa ON public.mdfe(empresa_id);
CREATE INDEX IF NOT EXISTS idx_mdfe_status ON public.mdfe(status);
CREATE INDEX IF NOT EXISTS idx_mdfe_chave ON public.mdfe(chave_acesso);

ALTER TABLE public.mdfe ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view mdfe via empresa" ON public.mdfe
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.empresas e WHERE e.id = mdfe.empresa_id AND e.user_id = auth.uid()));
CREATE POLICY "Users can insert mdfe via empresa" ON public.mdfe
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.empresas e WHERE e.id = mdfe.empresa_id AND e.user_id = auth.uid()));

CREATE TRIGGER trg_mdfe_updated BEFORE UPDATE ON public.mdfe
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Documentos vinculados (NF-e / CT-e)
CREATE TABLE IF NOT EXISTS public.mdfe_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mdfe_id uuid NOT NULL REFERENCES public.mdfe(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('nfe','cte')),
  chave text NOT NULL,
  c_mun_descarga text NOT NULL,
  x_mun_descarga text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mdfe_doc_mdfe ON public.mdfe_documentos(mdfe_id);

ALTER TABLE public.mdfe_documentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage mdfe_documentos via mdfe" ON public.mdfe_documentos
  FOR ALL USING (EXISTS (SELECT 1 FROM public.mdfe m JOIN public.empresas e ON e.id = m.empresa_id WHERE m.id = mdfe_documentos.mdfe_id AND e.user_id = auth.uid()));

-- Eventos
CREATE TABLE IF NOT EXISTS public.mdfe_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mdfe_id uuid NOT NULL REFERENCES public.mdfe(id) ON DELETE CASCADE,
  tipo_evento text NOT NULL, -- encerramento | cancelamento | inclusao_condutor | inclusao_dfe
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
CREATE INDEX IF NOT EXISTS idx_mdfe_eventos_mdfe ON public.mdfe_eventos(mdfe_id);

ALTER TABLE public.mdfe_eventos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage mdfe_eventos via mdfe" ON public.mdfe_eventos
  FOR ALL USING (EXISTS (SELECT 1 FROM public.mdfe m JOIN public.empresas e ON e.id = m.empresa_id WHERE m.id = mdfe_eventos.mdfe_id AND e.user_id = auth.uid()));

-- Fila de processamento
CREATE TABLE IF NOT EXISTS public.fila_processamento_mdfe (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mdfe_id uuid NOT NULL REFERENCES public.mdfe(id) ON DELETE CASCADE,
  prioridade integer NOT NULL DEFAULT 5,
  tentativas integer NOT NULL DEFAULT 0,
  max_tentativas integer NOT NULL DEFAULT 3,
  proximo_processamento timestamptz NOT NULL DEFAULT now(),
  erro_ultimo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.fila_processamento_mdfe ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view fila mdfe via mdfe" ON public.fila_processamento_mdfe
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.mdfe m JOIN public.empresas e ON e.id = m.empresa_id WHERE m.id = fila_processamento_mdfe.mdfe_id AND e.user_id = auth.uid()));

-- RPC para gerar número
CREATE OR REPLACE FUNCTION public.gerar_numero_mdfe(p_empresa_id uuid, p_serie text DEFAULT '1')
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_numero INTEGER;
BEGIN
  UPDATE public.series_fiscais
  SET numero_atual = numero_atual + 1, updated_at = now()
  WHERE empresa_id = p_empresa_id AND tipo = 'mdfe' AND serie = p_serie AND ativo = true
  RETURNING numero_atual INTO v_numero;

  IF v_numero IS NULL THEN
    INSERT INTO public.series_fiscais (empresa_id, tipo, serie, numero_atual)
    VALUES (p_empresa_id, 'mdfe', p_serie, 1)
    RETURNING numero_atual INTO v_numero;
  END IF;

  RETURN LPAD(v_numero::TEXT, 9, '0');
END;
$$;
