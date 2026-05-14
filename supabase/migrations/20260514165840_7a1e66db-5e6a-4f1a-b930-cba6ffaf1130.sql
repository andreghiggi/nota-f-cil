UPDATE public.mdfe
SET status = 'rejeitada',
    erro_processamento = 'PHP fatal: Class "Auth" not found em mdfe_routes.php:18 (api2.agilizeerp.com.br). Necessário corrigir o include/use da classe Auth no arquivo mdfe_routes.php da VPS.',
    motivo_retorno = 'Fatal error PHP na API fiscal — endpoint /mdfe/emitir',
    codigo_retorno = 'PHP_FATAL',
    processado_em = COALESCE(processado_em, now())
WHERE status = 'processando'
  AND chave_acesso IS NULL
  AND protocolo IS NULL;

-- Reseta numeração da série MDF-e para reemitir com mesmo número após fix
UPDATE public.series_fiscais
SET numero_atual = GREATEST(numero_atual - 2, 0)
WHERE tipo = 'mdfe'
  AND empresa_id = (SELECT empresa_id FROM public.mdfe WHERE id = '268014f2-be10-40ee-9831-e223ba8051d6');