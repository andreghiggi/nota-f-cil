-- 1) Campos NFS-e no cadastro da empresa
ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS nfse_ativo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS inscricao_municipal text,
  ADD COLUMN IF NOT EXISTS serie_nfse text NOT NULL DEFAULT '1',
  ADD COLUMN IF NOT EXISTS numero_nfse_atual integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS nfse_op_simples smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS nfse_reg_esp smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS nfse_incentivo_cultural boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS nfse_incluir_ibscbs boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS nfse_aliquota_padrao numeric,
  ADD COLUMN IF NOT EXISTS nfse_ctribnac_padrao text,
  ADD COLUMN IF NOT EXISTS nfse_cnbs_padrao text;

-- 2) series_fiscais aceita 'nfse'
ALTER TABLE public.series_fiscais DROP CONSTRAINT IF EXISTS series_fiscais_tipo_check;
ALTER TABLE public.series_fiscais ADD CONSTRAINT series_fiscais_tipo_check
  CHECK (tipo = ANY (ARRAY['nfe'::text, 'nfce'::text, 'mdfe'::text, 'nfse'::text]));

-- 3) Tabela nfse
CREATE TABLE IF NOT EXISTS public.nfse (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  token_api_id uuid,
  numero_dps integer NOT NULL,
  serie text NOT NULL DEFAULT '1',
  status public.nfce_status NOT NULL DEFAULT 'pendente',
  ambiente public.ambiente_sefaz NOT NULL DEFAULT 'homologacao',
  data_emissao timestamptz NOT NULL DEFAULT now(),
  chave_acesso text,
  numero_nfse text,
  codigo_verificacao text,
  protocolo text,
  codigo_retorno text,
  motivo_retorno text,
  tomador_documento text,
  tomador_nome text,
  tomador_email text,
  tomador_im text,
  discriminacao text,
  c_trib_nac text,
  c_nbs text,
  c_trib_mun text,
  codigo_municipio_prestacao text,
  valor_servicos numeric NOT NULL DEFAULT 0,
  valor_deducoes numeric NOT NULL DEFAULT 0,
  aliquota_iss numeric,
  valor_iss numeric,
  iss_retido smallint NOT NULL DEFAULT 1,
  xml_nfse text,
  xml_retorno text,
  payload_entrada jsonb NOT NULL DEFAULT '{}'::jsonb,
  resposta jsonb,
  external_id text,
  erro_processamento text,
  data_cancelamento timestamptz,
  justificativa_cancelamento text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.nfse TO authenticated;
GRANT ALL ON public.nfse TO service_role;

ALTER TABLE public.nfse ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios gerenciam NFS-e das suas empresas"
ON public.nfse FOR ALL TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.empresas e WHERE e.id = nfse.empresa_id AND e.user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.empresas e WHERE e.id = nfse.empresa_id AND e.user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);

CREATE INDEX IF NOT EXISTS idx_nfse_empresa ON public.nfse(empresa_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_nfse_chave ON public.nfse(chave_acesso);

CREATE TRIGGER update_nfse_updated_at
BEFORE UPDATE ON public.nfse
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) Numeração NFS-e (DPS)
CREATE OR REPLACE FUNCTION public.gerar_numero_nfse(p_empresa_id uuid, p_serie text DEFAULT '1'::text)
RETURNS integer
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