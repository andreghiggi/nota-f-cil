DO $$
DECLARE
  v_empresa uuid := '91cb3c52-40d9-486a-b5cd-5eccd23a0b83';
  v_nfe uuid := gen_random_uuid();
  v_numero text;
BEGIN
  -- Flip empresa Marcelo para homologação (TEST ONLY)
  UPDATE public.empresas SET ambiente='homologacao' WHERE id=v_empresa;

  -- Garante série NF-e/001 com numero_atual=0
  INSERT INTO public.series_fiscais (empresa_id, tipo, serie, numero_atual, ativo)
  VALUES (v_empresa, 'nfe', '001', 0, true)
  ON CONFLICT DO NOTHING;

  -- Próximo número
  v_numero := public.gerar_numero_nfe(v_empresa, '001');

  -- Cria NF-e de teste em homologação
  INSERT INTO public.nfe (
    id, empresa_id, numero, serie, status, ambiente,
    valor_total, valor_produtos, payload_entrada,
    natureza_operacao, finalidade, modalidade_frete,
    dest_cpf_cnpj, dest_nome, dest_uf, dest_codigo_municipio, dest_municipio,
    dest_bairro, dest_logradouro, dest_numero, dest_cep,
    id_dest, ind_final, ind_pres, tp_nf
  ) VALUES (
    v_nfe, v_empresa, v_numero, '001', 'pendente', 'homologacao',
    10.00, 10.00, '{"teste":true}'::jsonb,
    'VENDA TESTE HOMOLOGACAO', '1', '9',
    '99999999999', 'NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL',
    'RS', '4309407', 'GUAPORE',
    'CENTRO', 'RUA TESTE', '100', '95700000',
    1, 1, 1, 1
  );

  INSERT INTO public.nfe_itens (
    nfe_id, numero_item, codigo_produto, descricao, ncm, cfop, unidade,
    quantidade, valor_unitario, valor_total,
    csosn, aliquota_icms, base_calculo_icms, valor_icms,
    cst_pis, aliquota_pis, base_calculo_pis, valor_pis,
    cst_cofins, aliquota_cofins, base_calculo_cofins, valor_cofins,
    cean, cean_trib
  ) VALUES (
    v_nfe, 1, 'TESTE001', 'PRODUTO TESTE HOMOLOGACAO', '22011000', '5102', 'UN',
    1, 10.00, 10.00,
    '102', 0, 10.00, 0,
    '49', 0, 10.00, 0,
    '49', 0, 10.00, 0,
    'SEM', 'SEM'
  );

  RAISE NOTICE 'NFe teste criada: id=% numero=%', v_nfe, v_numero;
END $$;