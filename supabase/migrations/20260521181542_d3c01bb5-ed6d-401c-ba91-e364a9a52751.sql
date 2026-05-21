
-- Responsável Técnico padrão por empresa (obrigatório RS)
ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS resp_tec_cnpj text,
  ADD COLUMN IF NOT EXISTS resp_tec_contato text,
  ADD COLUMN IF NOT EXISTS resp_tec_email text,
  ADD COLUMN IF NOT EXISTS resp_tec_fone text;

-- NF-e: campos de ide, infAdic, entrega, transporte e respTec por nota
ALTER TABLE public.nfe
  ADD COLUMN IF NOT EXISTS dh_sai_ent timestamptz,
  ADD COLUMN IF NOT EXISTS id_dest smallint,            -- 1 interna, 2 interestadual, 3 exterior
  ADD COLUMN IF NOT EXISTS ind_final smallint,          -- 0/1
  ADD COLUMN IF NOT EXISTS ind_pres smallint,           -- 0..9
  ADD COLUMN IF NOT EXISTS tp_nf smallint DEFAULT 1,    -- 0 entrada, 1 saída
  ADD COLUMN IF NOT EXISTS inf_cpl text,
  ADD COLUMN IF NOT EXISTS inf_ad_fisco text,
  ADD COLUMN IF NOT EXISTS entrega jsonb,               -- endereço entrega diferente
  ADD COLUMN IF NOT EXISTS transporte jsonb,            -- transp + veicTransp + vol
  ADD COLUMN IF NOT EXISTS resp_tec jsonb;              -- override do RT da empresa

-- Itens: códigos de barras, exceção TIPI, enquadramento IPI, CEST, fabricante
ALTER TABLE public.nfe_itens
  ADD COLUMN IF NOT EXISTS cean text,
  ADD COLUMN IF NOT EXISTS cean_trib text,
  ADD COLUMN IF NOT EXISTS ex_tipi text,
  ADD COLUMN IF NOT EXISTS c_enq_ipi text,              -- enquadramento IPI (ex.: 999)
  ADD COLUMN IF NOT EXISTS cest text,
  ADD COLUMN IF NOT EXISTS cnpj_fab text,
  ADD COLUMN IF NOT EXISTS ind_escala text,             -- S/N (Simples Nacional)
  ADD COLUMN IF NOT EXISTS inf_ad_prod text;
