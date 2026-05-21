DELETE FROM public.nfe_itens WHERE nfe_id='742c524c-6101-4a74-ae8e-c2dfaa9c1919';
DELETE FROM public.nfe_eventos WHERE nfe_id='742c524c-6101-4a74-ae8e-c2dfaa9c1919';
DELETE FROM public.fila_processamento_nfe WHERE nfe_id='742c524c-6101-4a74-ae8e-c2dfaa9c1919';
DELETE FROM public.nfe WHERE id='742c524c-6101-4a74-ae8e-c2dfaa9c1919';
UPDATE public.series_fiscais SET numero_atual=0 WHERE empresa_id='91cb3c52-40d9-486a-b5cd-5eccd23a0b83' AND tipo='nfe' AND serie='001';
UPDATE public.empresas SET ambiente='producao' WHERE id='91cb3c52-40d9-486a-b5cd-5eccd23a0b83';