UPDATE public.dfe_recebidas
SET numero_nfe = COALESCE(NULLIF(numero_nfe,''), (substring(chave_acesso, 26, 9))::int::text),
    serie      = COALESCE(NULLIF(serie,''),      (substring(chave_acesso, 23, 3))::int::text)
WHERE length(chave_acesso)=44
  AND (numero_nfe IS NULL OR numero_nfe='' OR serie IS NULL OR serie='');