UPDATE public.mdfe
SET status = 'pendente',
    erro_processamento = NULL,
    motivo_retorno = NULL,
    codigo_retorno = NULL,
    processado_em = NULL,
    tentativas = 0
WHERE id IN ('268014f2-be10-40ee-9831-e223ba8051d6','bbeca90b-d3ad-48a7-a7f1-c758b399b06e');