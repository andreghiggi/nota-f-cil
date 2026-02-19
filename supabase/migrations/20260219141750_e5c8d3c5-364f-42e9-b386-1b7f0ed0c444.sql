
-- Add column to store the fiscal API key for each company
ALTER TABLE public.empresas ADD COLUMN api_key_fiscal TEXT;

-- Add unique constraint to prevent duplicate keys
ALTER TABLE public.empresas ADD CONSTRAINT empresas_api_key_fiscal_unique UNIQUE (api_key_fiscal);
