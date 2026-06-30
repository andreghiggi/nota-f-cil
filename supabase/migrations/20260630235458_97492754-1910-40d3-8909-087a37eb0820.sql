
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin','user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Admin pode ver/editar/excluir todas as empresas
DROP POLICY IF EXISTS "Admins can view all empresas" ON public.empresas;
CREATE POLICY "Admins can view all empresas" ON public.empresas FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update all empresas" ON public.empresas;
CREATE POLICY "Admins can update all empresas" ON public.empresas FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete all empresas" ON public.empresas;
CREATE POLICY "Admins can delete all empresas" ON public.empresas FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Atribui admin ao usuário principal
INSERT INTO public.user_roles (user_id, role)
VALUES ('2a858ec9-e044-4a7f-8f55-b75a28b07c56','admin')
ON CONFLICT DO NOTHING;
