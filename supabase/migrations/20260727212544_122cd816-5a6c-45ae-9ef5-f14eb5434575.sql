UPDATE public.nfce
   SET payload_entrada = jsonb_set(
         payload_entrada,
         '{itens}',
         (
           SELECT jsonb_agg(
             CASE WHEN item->>'ncm' = '22010000'
                  THEN jsonb_set(item, '{ncm}', '"22011000"'::jsonb)
                  ELSE item END
           )
           FROM jsonb_array_elements(payload_entrada->'itens') item
         )
       ),
       status = 'pendente',
       tentativas = 0,
       erro_processamento = NULL,
       motivo_retorno = NULL,
       codigo_retorno = NULL,
       updated_at = now()
 WHERE id IN ('9f795779-ea06-4885-8d0f-ee734304ab96','1a71e071-9be3-4344-b5ac-7a06db2f53f1');