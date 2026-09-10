-- =====================================================================
-- Multi-parceiro com isolamento total  (aplicar no banco da VPS)
-- psql "$DATABASE_URL" -f db/vps/2026-09-10-parceiros-isolamento.sql
--
-- 100% aditivo: nenhuma política existente é removida. As regras abaixo
-- são PERMISSIVAS e somam-se (OR) às atuais, então nenhuma empresa da i9
-- perde acesso, nenhum token muda e nenhuma URL é alterada.
-- =====================================================================

BEGIN;

-- 1. Tabelas de parceiro -----------------------------------------------
CREATE TABLE IF NOT EXISTS public.parceiros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  slug text NOT NULL UNIQUE,
  documento text,
  email_contato text,
  chave_hash text,
  chave_prefix text,
  status text NOT NULL DEFAULT 'ativo',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.parceiros TO authenticated;
GRANT ALL ON public.parceiros TO service_role;
ALTER TABLE public.parceiros ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.parceiro_usuarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parceiro_id uuid NOT NULL REFERENCES public.parceiros(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  papel text NOT NULL DEFAULT 'membro',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (parceiro_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.parceiro_usuarios TO authenticated;
GRANT ALL ON public.parceiro_usuarios TO service_role;
ALTER TABLE public.parceiro_usuarios ENABLE ROW LEVEL SECURITY;

-- 2. Vínculo das empresas ----------------------------------------------
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS parceiro_id uuid REFERENCES public.parceiros(id);
CREATE INDEX IF NOT EXISTS idx_empresas_parceiro ON public.empresas(parceiro_id);

INSERT INTO public.parceiros (nome, slug)
SELECT 'i9 Tec Info', 'i9'
WHERE NOT EXISTS (SELECT 1 FROM public.parceiros WHERE slug = 'i9');

-- Backfill: toda empresa existente vai para a i9 (nada fica órfão)
UPDATE public.empresas
   SET parceiro_id = (SELECT id FROM public.parceiros WHERE slug = 'i9')
 WHERE parceiro_id IS NULL;

-- Usuários atuais (donos de empresa + admins) entram no parceiro i9
INSERT INTO public.parceiro_usuarios (parceiro_id, user_id, papel)
SELECT (SELECT id FROM public.parceiros WHERE slug = 'i9'), e.user_id, 'admin'
  FROM (SELECT DISTINCT user_id FROM public.empresas WHERE user_id IS NOT NULL) e
ON CONFLICT (parceiro_id, user_id) DO NOTHING;

INSERT INTO public.parceiro_usuarios (parceiro_id, user_id, papel)
SELECT (SELECT id FROM public.parceiros WHERE slug = 'i9'), ur.user_id, 'admin'
  FROM public.user_roles ur WHERE ur.role = 'admin'
ON CONFLICT (parceiro_id, user_id) DO NOTHING;

-- 3. Funções de apoio (security definer, sem recursão) -----------------
CREATE OR REPLACE FUNCTION public.parceiro_do_usuario(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT parceiro_id FROM public.parceiro_usuarios WHERE user_id = _user_id LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.usuario_ve_empresa(_empresa_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.empresas e
     WHERE e.id = _empresa_id
       AND (
         e.user_id = auth.uid()
         OR (e.parceiro_id IS NOT NULL AND e.parceiro_id = public.parceiro_do_usuario(auth.uid()))
         OR public.has_role(auth.uid(), 'admin')
       )
  )
$$;

-- Valida a chave do parceiro (sha256 hex) — usada pelas Edge Functions
CREATE OR REPLACE FUNCTION public.validar_chave_parceiro(_chave_hash text)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.parceiros
   WHERE chave_hash = _chave_hash AND status = 'ativo' LIMIT 1
$$;

-- 4. RLS das tabelas de parceiro ---------------------------------------
DROP POLICY IF EXISTS "parceiro_membro_le" ON public.parceiros;
CREATE POLICY "parceiro_membro_le" ON public.parceiros
  FOR SELECT TO authenticated
  USING (id = public.parceiro_do_usuario(auth.uid()) OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "parceiro_admin_gerencia" ON public.parceiros;
CREATE POLICY "parceiro_admin_gerencia" ON public.parceiros
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "parceiro_usuarios_le" ON public.parceiro_usuarios;
CREATE POLICY "parceiro_usuarios_le" ON public.parceiro_usuarios
  FOR SELECT TO authenticated
  USING (user_id = auth.uid()
         OR parceiro_id = public.parceiro_do_usuario(auth.uid())
         OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "parceiro_usuarios_admin" ON public.parceiro_usuarios;
CREATE POLICY "parceiro_usuarios_admin" ON public.parceiro_usuarios
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 5. Leitura por parceiro nas tabelas ligadas à empresa (aditivo) ------
DROP POLICY IF EXISTS "empresas_por_parceiro" ON public.empresas;
CREATE POLICY "empresas_por_parceiro" ON public.empresas
  FOR SELECT TO authenticated
  USING (parceiro_id IS NOT NULL AND parceiro_id = public.parceiro_do_usuario(auth.uid()));

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'certificados_digitais','tokens_api','series_fiscais','configuracoes_fiscais',
    'nfe','nfce','mdfe','cte','nfse','dfe_recebidas','logs_fiscais','webhooks',
    'fila_processamento','fila_processamento_nfe','fila_processamento_cte',
    'fila_processamento_mdfe','fila_processamento_nfse'
  ]
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema='public' AND table_name=t AND column_name='empresa_id'
    ) THEN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t||'_por_parceiro', t);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.usuario_ve_empresa(empresa_id))',
        t||'_por_parceiro', t);
    END IF;
  END LOOP;
END $$;

COMMIT;

-- 6. Conferência pós-aplicação -----------------------------------------
-- SELECT count(*) FILTER (WHERE parceiro_id IS NULL) AS orfas, count(*) AS total FROM public.empresas;
-- SELECT p.nome, count(e.id) FROM public.parceiros p LEFT JOIN public.empresas e ON e.parceiro_id=p.id GROUP BY 1;
