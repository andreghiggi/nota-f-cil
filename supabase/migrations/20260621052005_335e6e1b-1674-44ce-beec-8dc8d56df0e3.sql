
CREATE TABLE public.dfe_recebidas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  chave_acesso text NOT NULL,
  nsu bigint NOT NULL,
  schema text,
  tipo text NOT NULL DEFAULT 'resumo',
  cnpj_emitente text,
  nome_emitente text,
  ie_emitente text,
  numero_nfe text,
  serie text,
  data_emissao timestamptz,
  valor_total numeric(15,2),
  tp_nf integer,
  situacao_nfe text,
  digest_value text,
  status_manifestacao text NOT NULL DEFAULT 'pendente',
  data_manifestacao timestamptz,
  xml_resumo text,
  xml_completo text,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, chave_acesso)
);
CREATE INDEX idx_dfe_recebidas_empresa ON public.dfe_recebidas(empresa_id, created_at DESC);
CREATE INDEX idx_dfe_recebidas_status ON public.dfe_recebidas(empresa_id, status_manifestacao);
CREATE INDEX idx_dfe_recebidas_nsu ON public.dfe_recebidas(empresa_id, nsu);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dfe_recebidas TO authenticated;
GRANT ALL ON public.dfe_recebidas TO service_role;
ALTER TABLE public.dfe_recebidas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages dfe_recebidas"
  ON public.dfe_recebidas FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.empresas e WHERE e.id = dfe_recebidas.empresa_id AND e.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.empresas e WHERE e.id = dfe_recebidas.empresa_id AND e.user_id = auth.uid()));

CREATE TABLE public.dfe_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dfe_id uuid REFERENCES public.dfe_recebidas(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  chave_acesso text NOT NULL,
  tp_evento text NOT NULL,
  justificativa text,
  protocolo text,
  codigo_retorno text,
  motivo_retorno text,
  xml_envio text,
  xml_retorno text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_dfe_eventos_dfe ON public.dfe_eventos(dfe_id, created_at DESC);
CREATE INDEX idx_dfe_eventos_empresa ON public.dfe_eventos(empresa_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dfe_eventos TO authenticated;
GRANT ALL ON public.dfe_eventos TO service_role;
ALTER TABLE public.dfe_eventos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages dfe_eventos"
  ON public.dfe_eventos FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.empresas e WHERE e.id = dfe_eventos.empresa_id AND e.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.empresas e WHERE e.id = dfe_eventos.empresa_id AND e.user_id = auth.uid()));

CREATE TABLE public.dfe_distribuicao_controle (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL UNIQUE REFERENCES public.empresas(id) ON DELETE CASCADE,
  ultimo_nsu bigint NOT NULL DEFAULT 0,
  max_nsu bigint NOT NULL DEFAULT 0,
  ultima_consulta timestamptz,
  ativo boolean NOT NULL DEFAULT true,
  intervalo_minutos integer NOT NULL DEFAULT 15,
  ultimo_erro text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dfe_distribuicao_controle TO authenticated;
GRANT ALL ON public.dfe_distribuicao_controle TO service_role;
ALTER TABLE public.dfe_distribuicao_controle ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages dfe_distribuicao_controle"
  ON public.dfe_distribuicao_controle FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.empresas e WHERE e.id = dfe_distribuicao_controle.empresa_id AND e.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.empresas e WHERE e.id = dfe_distribuicao_controle.empresa_id AND e.user_id = auth.uid()));

CREATE TRIGGER trg_dfe_recebidas_updated BEFORE UPDATE ON public.dfe_recebidas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_dfe_dist_ctrl_updated BEFORE UPDATE ON public.dfe_distribuicao_controle
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
