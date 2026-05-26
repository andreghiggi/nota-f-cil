
ALTER TABLE public.nfe_itens
  ADD COLUMN IF NOT EXISTS p_red_bc numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS p_red_bc_st numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS p_diferimento numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mod_bc text,
  ADD COLUMN IF NOT EXISTS mod_bc_st text,
  ADD COLUMN IF NOT EXISTS motivo_desoneracao text,
  ADD COLUMN IF NOT EXISTS valor_icms_desonerado numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_icms_op numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_icms_dif numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS p_cred_sn numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_cred_icms_sn numeric DEFAULT 0;

ALTER TABLE public.nfce_itens
  ADD COLUMN IF NOT EXISTS p_red_bc numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mod_bc text,
  ADD COLUMN IF NOT EXISTS p_cred_sn numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_cred_icms_sn numeric DEFAULT 0;
