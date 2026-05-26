DROP TRIGGER IF EXISTS trg_sync_empresa_series_padrao ON public.empresas;
CREATE TRIGGER trg_sync_empresa_series_padrao
  AFTER INSERT ON public.empresas
  FOR EACH ROW EXECUTE FUNCTION public.sync_empresa_series_padrao();