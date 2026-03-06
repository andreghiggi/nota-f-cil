
-- Add NF-e fields to empresas
ALTER TABLE public.empresas 
ADD COLUMN IF NOT EXISTS numero_nfe_atual integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS serie_nfe text NOT NULL DEFAULT '001';

-- Create gerar_numero_nfe function
CREATE OR REPLACE FUNCTION public.gerar_numero_nfe(p_empresa_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_numero INTEGER;
BEGIN
  UPDATE public.empresas
  SET numero_nfe_atual = numero_nfe_atual + 1
  WHERE id = p_empresa_id
  RETURNING numero_nfe_atual INTO v_numero;
  RETURN LPAD(v_numero::TEXT, 9, '0');
END;
$$;

-- Create nfe table (mirrors nfce)
CREATE TABLE public.nfe (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id),
  token_api_id uuid REFERENCES public.tokens_api(id),
  numero text NOT NULL,
  serie text NOT NULL,
  status public.nfce_status NOT NULL DEFAULT 'pendente',
  ambiente public.ambiente_sefaz NOT NULL,
  data_emissao timestamptz NOT NULL DEFAULT now(),
  valor_total numeric NOT NULL,
  valor_produtos numeric DEFAULT 0,
  valor_desconto numeric DEFAULT 0,
  valor_frete numeric DEFAULT 0,
  valor_seguro numeric DEFAULT 0,
  valor_outras_despesas numeric DEFAULT 0,
  valor_icms numeric DEFAULT 0,
  valor_ipi numeric DEFAULT 0,
  valor_pis numeric DEFAULT 0,
  valor_cofins numeric DEFAULT 0,
  chave_acesso text,
  xml_envio text,
  xml_retorno text,
  protocolo text,
  codigo_retorno text,
  motivo_retorno text,
  data_autorizacao timestamptz,
  erro_processamento text,
  external_id text,
  tentativas integer NOT NULL DEFAULT 0,
  processado_em timestamptz,
  payload_entrada jsonb NOT NULL,
  -- NF-e specific fields
  natureza_operacao text NOT NULL DEFAULT 'VENDA',
  finalidade text NOT NULL DEFAULT '1', -- 1=Normal, 2=Complementar, 3=Ajuste, 4=Devolução
  modalidade_frete text NOT NULL DEFAULT '9', -- 0=Emitente, 1=Destinatário, 9=Sem frete
  -- Destinatário
  dest_cpf_cnpj text,
  dest_nome text,
  dest_ie text,
  dest_email text,
  dest_logradouro text,
  dest_numero text,
  dest_complemento text,
  dest_bairro text,
  dest_municipio text,
  dest_codigo_municipio text,
  dest_uf text,
  dest_cep text,
  dest_telefone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create nfe_itens table
CREATE TABLE public.nfe_itens (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nfe_id uuid NOT NULL REFERENCES public.nfe(id),
  numero_item integer NOT NULL,
  codigo_produto text NOT NULL,
  descricao text NOT NULL,
  ncm text,
  cfop text NOT NULL,
  unidade text NOT NULL,
  quantidade numeric NOT NULL,
  valor_unitario numeric NOT NULL,
  valor_total numeric NOT NULL,
  cst_icms text,
  csosn text,
  aliquota_icms numeric DEFAULT 0,
  valor_icms numeric DEFAULT 0,
  cst_ipi text,
  aliquota_ipi numeric DEFAULT 0,
  valor_ipi numeric DEFAULT 0,
  cst_pis text,
  aliquota_pis numeric DEFAULT 0,
  valor_pis numeric DEFAULT 0,
  cst_cofins text,
  aliquota_cofins numeric DEFAULT 0,
  valor_cofins numeric DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create nfe_eventos table
CREATE TABLE public.nfe_eventos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nfe_id uuid NOT NULL REFERENCES public.nfe(id),
  tipo_evento text NOT NULL,
  sequencia integer NOT NULL DEFAULT 1,
  data_evento timestamptz NOT NULL DEFAULT now(),
  protocolo text,
  justificativa text,
  xml_evento text,
  xml_retorno text,
  codigo_retorno text,
  motivo_retorno text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS for nfe
ALTER TABLE public.nfe ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view nfe via empresa" ON public.nfe FOR SELECT
  USING (EXISTS (SELECT 1 FROM empresas WHERE empresas.id = nfe.empresa_id AND empresas.user_id = auth.uid()));
CREATE POLICY "Users can insert nfe via empresa" ON public.nfe FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM empresas WHERE empresas.id = nfe.empresa_id AND empresas.user_id = auth.uid()));

-- RLS for nfe_itens
ALTER TABLE public.nfe_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage nfe_itens via nfe" ON public.nfe_itens FOR ALL
  USING (EXISTS (SELECT 1 FROM nfe n JOIN empresas e ON e.id = n.empresa_id WHERE n.id = nfe_itens.nfe_id AND e.user_id = auth.uid()));

-- RLS for nfe_eventos
ALTER TABLE public.nfe_eventos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage nfe_eventos via nfe" ON public.nfe_eventos FOR ALL
  USING (EXISTS (SELECT 1 FROM nfe n JOIN empresas e ON e.id = n.empresa_id WHERE n.id = nfe_eventos.nfe_id AND e.user_id = auth.uid()));

-- Create fila_processamento_nfe
CREATE TABLE public.fila_processamento_nfe (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nfe_id uuid NOT NULL REFERENCES public.nfe(id),
  prioridade integer NOT NULL DEFAULT 5,
  tentativas integer NOT NULL DEFAULT 0,
  max_tentativas integer NOT NULL DEFAULT 3,
  proximo_processamento timestamptz NOT NULL DEFAULT now(),
  erro_ultimo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(nfe_id)
);

ALTER TABLE public.fila_processamento_nfe ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view fila nfe via nfe" ON public.fila_processamento_nfe FOR SELECT
  USING (EXISTS (SELECT 1 FROM nfe n JOIN empresas e ON e.id = n.empresa_id WHERE n.id = fila_processamento_nfe.nfe_id AND e.user_id = auth.uid()));
