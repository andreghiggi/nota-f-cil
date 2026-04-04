-- Add base_calculo and FCP/ICMS_ST fields to nfe_itens
ALTER TABLE public.nfe_itens
  ADD COLUMN IF NOT EXISTS base_calculo_icms numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS aliquota_fcp numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_fcp numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS base_calculo_icms_st numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS aliquota_icms_st numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mva_icms_st numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_icms_st numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS base_calculo_pis numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS base_calculo_cofins numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS base_calculo_ipi numeric DEFAULT 0;
