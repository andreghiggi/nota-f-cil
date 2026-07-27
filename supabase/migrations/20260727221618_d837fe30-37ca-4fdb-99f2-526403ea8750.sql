UPDATE public.nfce
   SET status = 'inutilizada',
       codigo_retorno = '102',
       motivo_retorno = 'Inutilizada SEFAZ: NFC-e nao consta na base de dados da SEFAZ',
       updated_at = now()
 WHERE empresa_id = '91cb3c52-40d9-486a-b5cd-5eccd23a0b83'
   AND serie = '001'
   AND numero IN ('000005309','000005311','000005327');