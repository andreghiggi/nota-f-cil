UPDATE public.nfce
SET status = 'autorizada',
    chave_acesso = '43260736490106000168650010000053281326397257',
    codigo_retorno = '100',
    motivo_retorno = 'Autorizado o uso da NF-e (recuperado via duplicidade 539 — chave já autorizada na SEFAZ)',
    data_autorizacao = COALESCE(data_autorizacao, now()),
    erro_processamento = NULL,
    updated_at = now()
WHERE id = '6ea1c09a-adfd-49e4-8bdb-edcea8e42db6'
  AND numero = '000005328';