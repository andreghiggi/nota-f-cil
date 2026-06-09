-- Reforma tributária: IBS/CBS agora é padrão para todas as empresas.
-- Motivo: api2/sped-nfe já aceita o grupo UB (homologação validou). Manter como opt-in
-- causou emissões em produção sem <IBSCBS> (ex.: BASALTEAR).

ALTER TABLE public.empresas ALTER COLUMN enviar_ibs_cbs SET DEFAULT true;
UPDATE public.empresas SET enviar_ibs_cbs = true WHERE enviar_ibs_cbs IS DISTINCT FROM true;