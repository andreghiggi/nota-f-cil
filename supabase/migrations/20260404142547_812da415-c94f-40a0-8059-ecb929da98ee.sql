
-- =====================================================
-- Reforma Tributária IBS/CBS/IS - Campos na NF-e
-- NT 2025.002-RTC v1.35
-- =====================================================

-- =====================================================
-- 1. TABELA nfe_itens - Campos IBS/CBS/IS por item
-- =====================================================

-- Grupo UB - IBS e CBS
ALTER TABLE public.nfe_itens ADD COLUMN IF NOT EXISTS cst_ibs_cbs text;
ALTER TABLE public.nfe_itens ADD COLUMN IF NOT EXISTS c_class_trib text;
ALTER TABLE public.nfe_itens ADD COLUMN IF NOT EXISTS vbc_ibs_cbs numeric DEFAULT 0;

-- IBS UF
ALTER TABLE public.nfe_itens ADD COLUMN IF NOT EXISTS aliquota_ibs_uf numeric DEFAULT 0;
ALTER TABLE public.nfe_itens ADD COLUMN IF NOT EXISTS valor_ibs_uf numeric DEFAULT 0;
ALTER TABLE public.nfe_itens ADD COLUMN IF NOT EXISTS p_red_aliq_ibs_uf numeric DEFAULT 0;
ALTER TABLE public.nfe_itens ADD COLUMN IF NOT EXISTS p_aliq_efet_ibs_uf numeric DEFAULT 0;
ALTER TABLE public.nfe_itens ADD COLUMN IF NOT EXISTS valor_dif_ibs_uf numeric DEFAULT 0;
ALTER TABLE public.nfe_itens ADD COLUMN IF NOT EXISTS valor_dev_trib_ibs_uf numeric DEFAULT 0;

-- IBS Municipal
ALTER TABLE public.nfe_itens ADD COLUMN IF NOT EXISTS aliquota_ibs_mun numeric DEFAULT 0;
ALTER TABLE public.nfe_itens ADD COLUMN IF NOT EXISTS valor_ibs_mun numeric DEFAULT 0;
ALTER TABLE public.nfe_itens ADD COLUMN IF NOT EXISTS p_red_aliq_ibs_mun numeric DEFAULT 0;
ALTER TABLE public.nfe_itens ADD COLUMN IF NOT EXISTS p_aliq_efet_ibs_mun numeric DEFAULT 0;
ALTER TABLE public.nfe_itens ADD COLUMN IF NOT EXISTS valor_dif_ibs_mun numeric DEFAULT 0;
ALTER TABLE public.nfe_itens ADD COLUMN IF NOT EXISTS valor_dev_trib_ibs_mun numeric DEFAULT 0;

-- CBS
ALTER TABLE public.nfe_itens ADD COLUMN IF NOT EXISTS aliquota_cbs numeric DEFAULT 0;
ALTER TABLE public.nfe_itens ADD COLUMN IF NOT EXISTS valor_cbs numeric DEFAULT 0;
ALTER TABLE public.nfe_itens ADD COLUMN IF NOT EXISTS p_red_aliq_cbs numeric DEFAULT 0;
ALTER TABLE public.nfe_itens ADD COLUMN IF NOT EXISTS p_aliq_efet_cbs numeric DEFAULT 0;
ALTER TABLE public.nfe_itens ADD COLUMN IF NOT EXISTS valor_dif_cbs numeric DEFAULT 0;
ALTER TABLE public.nfe_itens ADD COLUMN IF NOT EXISTS valor_dev_trib_cbs numeric DEFAULT 0;

-- Imposto Seletivo
ALTER TABLE public.nfe_itens ADD COLUMN IF NOT EXISTS cst_is text;
ALTER TABLE public.nfe_itens ADD COLUMN IF NOT EXISTS c_class_trib_is text;
ALTER TABLE public.nfe_itens ADD COLUMN IF NOT EXISTS vbc_is numeric DEFAULT 0;
ALTER TABLE public.nfe_itens ADD COLUMN IF NOT EXISTS aliquota_is numeric DEFAULT 0;
ALTER TABLE public.nfe_itens ADD COLUMN IF NOT EXISTS valor_is numeric DEFAULT 0;

-- Indicador de doação
ALTER TABLE public.nfe_itens ADD COLUMN IF NOT EXISTS ind_doacao smallint;

-- Indicador bem móvel usado
ALTER TABLE public.nfe_itens ADD COLUMN IF NOT EXISTS ind_bem_movel_usado smallint;

-- =====================================================
-- 2. TABELA nfe - Campos de identificação e totais
-- =====================================================

-- Grupo B - Identificação
ALTER TABLE public.nfe ADD COLUMN IF NOT EXISTS d_prev_entrega date;
ALTER TABLE public.nfe ADD COLUMN IF NOT EXISTS c_mun_fg_ibs text;
ALTER TABLE public.nfe ADD COLUMN IF NOT EXISTS tp_nf_debito text;
ALTER TABLE public.nfe ADD COLUMN IF NOT EXISTS tp_nf_credito text;
ALTER TABLE public.nfe ADD COLUMN IF NOT EXISTS ind_intermed smallint;
ALTER TABLE public.nfe ADD COLUMN IF NOT EXISTS tp_ente_gov smallint;
ALTER TABLE public.nfe ADD COLUMN IF NOT EXISTS tp_oper_gov smallint;
ALTER TABLE public.nfe ADD COLUMN IF NOT EXISTS p_redutor_gov numeric DEFAULT 0;

-- Grupo W03 - Totais IBS/CBS/IS
ALTER TABLE public.nfe ADD COLUMN IF NOT EXISTS valor_ibs_uf_total numeric DEFAULT 0;
ALTER TABLE public.nfe ADD COLUMN IF NOT EXISTS valor_ibs_mun_total numeric DEFAULT 0;
ALTER TABLE public.nfe ADD COLUMN IF NOT EXISTS valor_cbs_total numeric DEFAULT 0;
ALTER TABLE public.nfe ADD COLUMN IF NOT EXISTS valor_is_total numeric DEFAULT 0;

-- Totais diferimento e devolução
ALTER TABLE public.nfe ADD COLUMN IF NOT EXISTS valor_dif_ibs_uf_total numeric DEFAULT 0;
ALTER TABLE public.nfe ADD COLUMN IF NOT EXISTS valor_dif_ibs_mun_total numeric DEFAULT 0;
ALTER TABLE public.nfe ADD COLUMN IF NOT EXISTS valor_dif_cbs_total numeric DEFAULT 0;
ALTER TABLE public.nfe ADD COLUMN IF NOT EXISTS valor_dev_trib_ibs_uf_total numeric DEFAULT 0;
ALTER TABLE public.nfe ADD COLUMN IF NOT EXISTS valor_dev_trib_ibs_mun_total numeric DEFAULT 0;
ALTER TABLE public.nfe ADD COLUMN IF NOT EXISTS valor_dev_trib_cbs_total numeric DEFAULT 0;

-- Totais monofásico
ALTER TABLE public.nfe ADD COLUMN IF NOT EXISTS valor_ibs_mono_total numeric DEFAULT 0;
ALTER TABLE public.nfe ADD COLUMN IF NOT EXISTS valor_cbs_mono_total numeric DEFAULT 0;
