-- Enum para status da NFC-e
CREATE TYPE public.nfce_status AS ENUM (
  'pendente',
  'processando', 
  'autorizada',
  'rejeitada',
  'cancelada',
  'denegada',
  'contingencia'
);

-- Enum para ambiente SEFAZ
CREATE TYPE public.ambiente_sefaz AS ENUM ('homologacao', 'producao');

-- Enum para regime tributário
CREATE TYPE public.regime_tributario AS ENUM ('simples_nacional', 'lucro_presumido', 'lucro_real');

-- Enum para status do certificado
CREATE TYPE public.certificado_status AS ENUM ('valido', 'expirando', 'expirado', 'pendente');

-- Enum para status do token API
CREATE TYPE public.token_status AS ENUM ('ativo', 'inativo', 'revogado');

-- Tabela de empresas
CREATE TABLE public.empresas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  razao_social TEXT NOT NULL,
  nome_fantasia TEXT,
  cnpj TEXT NOT NULL UNIQUE,
  inscricao_estadual TEXT,
  uf TEXT NOT NULL CHECK (length(uf) = 2),
  municipio TEXT NOT NULL,
  codigo_municipio TEXT,
  regime_tributario regime_tributario NOT NULL DEFAULT 'simples_nacional',
  ambiente ambiente_sefaz NOT NULL DEFAULT 'homologacao',
  serie_nfce TEXT NOT NULL DEFAULT '001',
  numero_nfce_atual INTEGER NOT NULL DEFAULT 0,
  csc_id TEXT,
  csc_token TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de certificados digitais
CREATE TABLE public.certificados_digitais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'A1',
  emissor TEXT,
  data_emissao DATE,
  data_vencimento DATE NOT NULL,
  status certificado_status NOT NULL DEFAULT 'pendente',
  arquivo_path TEXT,
  senha_hash TEXT,
  cnpj_certificado TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(empresa_id)
);

-- Tabela de tokens API para integração com ERPs
CREATE TABLE public.tokens_api (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE NOT NULL,
  nome TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  token_prefix TEXT NOT NULL,
  status token_status NOT NULL DEFAULT 'ativo',
  permissoes TEXT[] NOT NULL DEFAULT ARRAY['emitir', 'consultar'],
  ultimo_uso TIMESTAMPTZ,
  ip_ultimo_uso TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela principal de NFC-e
CREATE TABLE public.nfce (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE NOT NULL,
  token_api_id UUID REFERENCES public.tokens_api(id),
  
  -- Identificação
  numero TEXT NOT NULL,
  serie TEXT NOT NULL,
  chave_acesso TEXT UNIQUE,
  
  -- Status
  status nfce_status NOT NULL DEFAULT 'pendente',
  ambiente ambiente_sefaz NOT NULL,
  
  -- Dados do documento
  data_emissao TIMESTAMPTZ NOT NULL DEFAULT now(),
  valor_total DECIMAL(15,2) NOT NULL,
  valor_produtos DECIMAL(15,2),
  valor_desconto DECIMAL(15,2) DEFAULT 0,
  valor_frete DECIMAL(15,2) DEFAULT 0,
  
  -- Impostos
  valor_icms DECIMAL(15,2) DEFAULT 0,
  valor_pis DECIMAL(15,2) DEFAULT 0,
  valor_cofins DECIMAL(15,2) DEFAULT 0,
  
  -- Dados brutos
  payload_entrada JSONB NOT NULL,
  xml_envio TEXT,
  xml_retorno TEXT,
  
  -- Retorno SEFAZ
  protocolo TEXT,
  codigo_retorno TEXT,
  motivo_retorno TEXT,
  data_autorizacao TIMESTAMPTZ,
  
  -- QR Code
  qrcode_url TEXT,
  
  -- Controle
  tentativas INTEGER NOT NULL DEFAULT 0,
  processado_em TIMESTAMPTZ,
  erro_processamento TEXT,
  external_id TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de itens da NFC-e
CREATE TABLE public.nfce_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nfce_id UUID REFERENCES public.nfce(id) ON DELETE CASCADE NOT NULL,
  numero_item INTEGER NOT NULL,
  codigo_produto TEXT NOT NULL,
  descricao TEXT NOT NULL,
  ncm TEXT,
  cfop TEXT NOT NULL,
  unidade TEXT NOT NULL,
  quantidade DECIMAL(15,4) NOT NULL,
  valor_unitario DECIMAL(15,4) NOT NULL,
  valor_total DECIMAL(15,2) NOT NULL,
  
  -- Impostos do item
  cst_icms TEXT,
  csosn TEXT,
  aliquota_icms DECIMAL(5,2) DEFAULT 0,
  valor_icms DECIMAL(15,2) DEFAULT 0,
  
  cst_pis TEXT,
  aliquota_pis DECIMAL(5,2) DEFAULT 0,
  valor_pis DECIMAL(15,2) DEFAULT 0,
  
  cst_cofins TEXT,
  aliquota_cofins DECIMAL(5,2) DEFAULT 0,
  valor_cofins DECIMAL(15,2) DEFAULT 0,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de eventos fiscais (cancelamentos, etc)
CREATE TABLE public.nfce_eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nfce_id UUID REFERENCES public.nfce(id) ON DELETE CASCADE NOT NULL,
  tipo_evento TEXT NOT NULL,
  sequencia INTEGER NOT NULL DEFAULT 1,
  data_evento TIMESTAMPTZ NOT NULL DEFAULT now(),
  protocolo TEXT,
  justificativa TEXT,
  xml_evento TEXT,
  xml_retorno TEXT,
  codigo_retorno TEXT,
  motivo_retorno TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de fila de processamento
CREATE TABLE public.fila_processamento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nfce_id UUID REFERENCES public.nfce(id) ON DELETE CASCADE NOT NULL UNIQUE,
  prioridade INTEGER NOT NULL DEFAULT 5,
  tentativas INTEGER NOT NULL DEFAULT 0,
  max_tentativas INTEGER NOT NULL DEFAULT 3,
  proximo_processamento TIMESTAMPTZ NOT NULL DEFAULT now(),
  erro_ultimo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de logs fiscais
CREATE TABLE public.logs_fiscais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
  nfce_id UUID REFERENCES public.nfce(id) ON DELETE SET NULL,
  token_api_id UUID REFERENCES public.tokens_api(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL,
  categoria TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  detalhes JSONB,
  ip_origem TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de configurações fiscais (CFOP, CST, alíquotas)
CREATE TABLE public.configuracoes_fiscais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE NOT NULL,
  tipo TEXT NOT NULL,
  codigo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  dados JSONB,
  vigencia_inicio DATE,
  vigencia_fim DATE,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(empresa_id, tipo, codigo)
);

-- Índices para performance
CREATE INDEX idx_nfce_empresa_id ON public.nfce(empresa_id);
CREATE INDEX idx_nfce_status ON public.nfce(status);
CREATE INDEX idx_nfce_chave_acesso ON public.nfce(chave_acesso);
CREATE INDEX idx_nfce_data_emissao ON public.nfce(data_emissao);
CREATE INDEX idx_nfce_external_id ON public.nfce(external_id);
CREATE INDEX idx_tokens_api_token_hash ON public.tokens_api(token_hash);
CREATE INDEX idx_tokens_api_empresa_id ON public.tokens_api(empresa_id);
CREATE INDEX idx_fila_proximo ON public.fila_processamento(proximo_processamento) WHERE tentativas < max_tentativas;
CREATE INDEX idx_logs_empresa_id ON public.logs_fiscais(empresa_id);
CREATE INDEX idx_logs_created_at ON public.logs_fiscais(created_at);

-- Habilitar RLS
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificados_digitais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tokens_api ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nfce ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nfce_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nfce_eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fila_processamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs_fiscais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracoes_fiscais ENABLE ROW LEVEL SECURITY;

-- RLS Policies para empresas
CREATE POLICY "Users can view own empresas" ON public.empresas
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own empresas" ON public.empresas
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own empresas" ON public.empresas
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own empresas" ON public.empresas
  FOR DELETE USING (auth.uid() = user_id);

-- RLS para certificados (via empresa)
CREATE POLICY "Users can manage certificates via empresa" ON public.certificados_digitais
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.empresas WHERE id = empresa_id AND user_id = auth.uid())
  );

-- RLS para tokens API (via empresa)
CREATE POLICY "Users can manage tokens via empresa" ON public.tokens_api
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.empresas WHERE id = empresa_id AND user_id = auth.uid())
  );

-- RLS para NFC-e (via empresa)
CREATE POLICY "Users can view nfce via empresa" ON public.nfce
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.empresas WHERE id = empresa_id AND user_id = auth.uid())
  );
CREATE POLICY "Users can insert nfce via empresa" ON public.nfce
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.empresas WHERE id = empresa_id AND user_id = auth.uid())
  );

-- RLS para itens NFC-e
CREATE POLICY "Users can manage nfce_itens via nfce" ON public.nfce_itens
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.nfce n
      JOIN public.empresas e ON e.id = n.empresa_id
      WHERE n.id = nfce_id AND e.user_id = auth.uid()
    )
  );

-- RLS para eventos NFC-e
CREATE POLICY "Users can manage nfce_eventos via nfce" ON public.nfce_eventos
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.nfce n
      JOIN public.empresas e ON e.id = n.empresa_id
      WHERE n.id = nfce_id AND e.user_id = auth.uid()
    )
  );

-- RLS para fila (via nfce)
CREATE POLICY "Users can view fila via nfce" ON public.fila_processamento
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.nfce n
      JOIN public.empresas e ON e.id = n.empresa_id
      WHERE n.id = nfce_id AND e.user_id = auth.uid()
    )
  );

-- RLS para logs (via empresa)
CREATE POLICY "Users can view logs via empresa" ON public.logs_fiscais
  FOR SELECT USING (
    empresa_id IS NULL OR EXISTS (SELECT 1 FROM public.empresas WHERE id = empresa_id AND user_id = auth.uid())
  );

-- RLS para configurações fiscais
CREATE POLICY "Users can manage configs via empresa" ON public.configuracoes_fiscais
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.empresas WHERE id = empresa_id AND user_id = auth.uid())
  );

-- Function para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers para updated_at
CREATE TRIGGER update_empresas_updated_at BEFORE UPDATE ON public.empresas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_certificados_updated_at BEFORE UPDATE ON public.certificados_digitais
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_tokens_updated_at BEFORE UPDATE ON public.tokens_api
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_nfce_updated_at BEFORE UPDATE ON public.nfce
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_fila_updated_at BEFORE UPDATE ON public.fila_processamento
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_configs_updated_at BEFORE UPDATE ON public.configuracoes_fiscais
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function para gerar próximo número NFC-e
CREATE OR REPLACE FUNCTION public.gerar_numero_nfce(p_empresa_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_numero INTEGER;
BEGIN
  UPDATE public.empresas
  SET numero_nfce_atual = numero_nfce_atual + 1
  WHERE id = p_empresa_id
  RETURNING numero_nfce_atual INTO v_numero;
  
  RETURN LPAD(v_numero::TEXT, 9, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function para validar token API (usada pelas edge functions)
CREATE OR REPLACE FUNCTION public.validar_token_api(p_token_hash TEXT)
RETURNS TABLE(
  token_id UUID,
  empresa_id UUID,
  permissoes TEXT[],
  ambiente ambiente_sefaz
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id,
    t.empresa_id,
    t.permissoes,
    e.ambiente
  FROM public.tokens_api t
  JOIN public.empresas e ON e.id = t.empresa_id
  WHERE t.token_hash = p_token_hash
    AND t.status = 'ativo'
    AND e.ativo = true
    AND (t.expires_at IS NULL OR t.expires_at > now());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function para registrar log
CREATE OR REPLACE FUNCTION public.registrar_log(
  p_empresa_id UUID,
  p_nfce_id UUID,
  p_token_api_id UUID,
  p_tipo TEXT,
  p_categoria TEXT,
  p_mensagem TEXT,
  p_detalhes JSONB DEFAULT NULL,
  p_ip_origem TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO public.logs_fiscais (empresa_id, nfce_id, token_api_id, tipo, categoria, mensagem, detalhes, ip_origem)
  VALUES (p_empresa_id, p_nfce_id, p_token_api_id, p_tipo, p_categoria, p_mensagem, p_detalhes, p_ip_origem)
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;