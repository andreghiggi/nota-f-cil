
-- Add tipo_pessoa column to empresas (PF = pessoa física / produtor rural, PJ = pessoa jurídica)
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS tipo_pessoa text NOT NULL DEFAULT 'PJ';

-- Add cpf column for pessoa física (produtor rural)
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS cpf text NULL;

-- Make cnpj nullable (produtor rural PF não tem CNPJ)
ALTER TABLE public.empresas ALTER COLUMN cnpj DROP NOT NULL;
