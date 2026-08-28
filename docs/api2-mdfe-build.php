<?php
// ============================================================================
// MDF-e (modelo 58) — montagem do XML 3.00 modal rodoviário a partir de JSON
// Arquivo: /var/www/fiscal-api/src/mdfe_build.php  (fora da webroot)
// Usado por POST /mdfe/emitir quando o cliente NÃO envia xml/xml_base64.
// ============================================================================

use NFePHP\MDFe\Make as MDFeMake;

if (!function_exists('fiscal_mdfe_fmt_dh')) {
    function fiscal_mdfe_fmt_dh($v): string
    {
        if (empty($v)) {
            return (new DateTime('now', new DateTimeZone('America/Sao_Paulo')))->format('Y-m-d\TH:i:sP');
        }
        try {
            $s = (string)$v;
            if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $s)) {
                $s .= 'T12:00:00-03:00';
            }
            $dt = new DateTime($s);
            $dt->setTimezone(new DateTimeZone('America/Sao_Paulo'));
            return $dt->format('Y-m-d\TH:i:sP');
        } catch (\Throwable $e) {
            return (new DateTime('now', new DateTimeZone('America/Sao_Paulo')))->format('Y-m-d\TH:i:sP');
        }
    }
}

if (!function_exists('fiscal_mdfe_cuf')) {
    function fiscal_mdfe_cuf(?string $uf): int
    {
        $map = ['AC'=>12,'AL'=>27,'AP'=>16,'AM'=>13,'BA'=>29,'CE'=>23,'DF'=>53,'ES'=>32,'GO'=>52,
                'MA'=>21,'MT'=>51,'MS'=>50,'MG'=>31,'PA'=>15,'PB'=>25,'PR'=>41,'PE'=>26,'PI'=>22,
                'RJ'=>33,'RN'=>24,'RS'=>43,'RO'=>11,'RR'=>14,'SC'=>42,'SP'=>35,'SE'=>28,'TO'=>17];
        return $map[strtoupper((string)$uf)] ?? 43;
    }
}

if (!function_exists('fiscal_mdfe_pick')) {
    function fiscal_mdfe_pick(array $src, array $keys, $default = null)
    {
        foreach ($keys as $k) {
            if (isset($src[$k]) && $src[$k] !== '' && $src[$k] !== null) {
                return $src[$k];
            }
        }
        return $default;
    }
}

if (!function_exists('fiscal_mdfe_build_xml')) {
    /**
     * Monta o XML do MDF-e (3.00, modal rodoviário) a partir do payload JSON.
     *
     * @param array        $empresa registro da tabela empresas (api2)
     * @param object|array $mdfe    bloco "mdfe" do payload
     */
    function fiscal_mdfe_build_xml(array $empresa, $mdfe): string
    {
        $m = json_decode(json_encode($mdfe), true);
        if (!is_array($m)) {
            throw new RuntimeException('Payload do MDF-e inválido');
        }

        $ufEmit = strtoupper((string)($empresa['siglaUF'] ?? $empresa['uf'] ?? 'RS'));
        $ufIni  = strtoupper((string)fiscal_mdfe_pick($m, ['uf_ini', 'UFIni'], $ufEmit));
        $ufFim  = strtoupper((string)fiscal_mdfe_pick($m, ['uf_fim', 'UFFim'], $ufIni));

        $serie = (int)fiscal_mdfe_pick($m, ['serie'], 1);
        $nMDF  = (int)preg_replace('/\D/', '', (string)fiscal_mdfe_pick($m, ['numero', 'nMDF'], '0'));
        if ($nMDF <= 0) {
            throw new RuntimeException('Número do MDF-e não informado');
        }

        $documentos = fiscal_mdfe_pick($m, ['documentos', 'docs'], []);
        if (!is_array($documentos) || count($documentos) === 0) {
            throw new RuntimeException('documentos[] é obrigatório (mín. 1 NF-e ou CT-e)');
        }

        $veic = fiscal_mdfe_pick($m, ['veiculo', 'veic_tracao', 'veicTracao'], []);
        if (!is_array($veic) || empty($veic['placa'])) {
            throw new RuntimeException('veiculo.placa é obrigatório');
        }

        // condutores: aceita condutor {} ou condutores []
        $condutores = fiscal_mdfe_pick($m, ['condutores'], null);
        if (!is_array($condutores) || count($condutores) === 0) {
            $c = fiscal_mdfe_pick($m, ['condutor'], null);
            $condutores = is_array($c) ? [$c] : [];
        }
        if (count($condutores) === 0) {
            throw new RuntimeException('Informe ao menos um condutor');
        }

        $make = new MDFeMake();

        // ------------------------------------------------------------------ ide
        $make->tagide((object)[
            'cUF'      => fiscal_mdfe_cuf($ufEmit),
            'tpAmb'    => (int)$empresa['tpAmb'],
            'tpEmit'   => (int)fiscal_mdfe_pick($m, ['tp_emit', 'tpEmit'], 2),
            'tpTransp' => fiscal_mdfe_pick($m, ['tp_transp', 'tpTransp'], null),
            'mod'      => '58',
            'serie'    => $serie,
            'nMDF'     => $nMDF,
            'cMDF'     => str_pad((string)random_int(0, 99999999), 8, '0', STR_PAD_LEFT),
            'cDV'      => '0',
            'modal'    => 1,
            'dhEmi'    => fiscal_mdfe_fmt_dh(fiscal_mdfe_pick($m, ['data_emissao', 'dh_emi', 'dhEmi'], null)),
            'tpEmis'   => (int)fiscal_mdfe_pick($m, ['tp_emis', 'tpEmis'], 1),
            'procEmi'  => 0,
            'verProc'  => 'FiscalFlow 1.0',
            'UFIni'    => $ufIni,
            'UFFim'    => $ufFim,
            'dhIniViagem' => fiscal_mdfe_fmt_dh(fiscal_mdfe_pick($m, ['dh_ini_viagem', 'data_inicio_viagem', 'dhIniViagem'], null)),
        ]);

        // percurso
        $percurso = fiscal_mdfe_pick($m, ['uf_percurso', 'percurso'], []);
        if (is_array($percurso)) {
            foreach ($percurso as $uf) {
                $uf = strtoupper(trim((string)(is_array($uf) ? ($uf['uf'] ?? '') : $uf)));
                if ($uf !== '' && $uf !== $ufIni && $uf !== $ufFim) {
                    $make->taginfPercurso((object)['UFPer' => $uf]);
                }
            }
        }

        // municípios de carregamento
        $munCarrega = fiscal_mdfe_pick($m, ['municipios_carregamento', 'mun_carrega'], []);
        $listaCarrega = [];
        if (is_array($munCarrega)) {
            foreach ($munCarrega as $mc) {
                if (!is_array($mc)) continue;
                $cod = preg_replace('/\D/', '', (string)fiscal_mdfe_pick($mc, ['codigo', 'c_mun', 'cMunCarrega', 'codigo_municipio'], ''));
                $nom = (string)fiscal_mdfe_pick($mc, ['nome', 'x_mun', 'xMunCarrega', 'municipio'], '');
                if ($cod !== '' && $nom !== '') $listaCarrega[] = [$cod, $nom];
            }
        }
        if (count($listaCarrega) === 0) {
            $listaCarrega[] = [
                preg_replace('/\D/', '', (string)($empresa['cMun'] ?? '')),
                (string)($empresa['xMun'] ?? ''),
            ];
        }
        foreach ($listaCarrega as [$cod, $nom]) {
            $make->taginfMunCarrega((object)['cMunCarrega' => $cod, 'xMunCarrega' => $nom]);
        }

        // ----------------------------------------------------------------- emit
        $isPF = (($empresa['tipo_pessoa'] ?? 'PJ') === 'PF');
        $emitObj = [
            'IE'    => preg_replace('/\D/', '', (string)($empresa['ie'] ?? '')),
            'xNome' => (string)$empresa['razao_social'],
            'xFant' => $empresa['nome_fantasia'] ?? null,
        ];
        if ($isPF && !empty($empresa['cpf'])) {
            $emitObj['CPF'] = preg_replace('/\D/', '', (string)$empresa['cpf']);
        } else {
            $emitObj['CNPJ'] = preg_replace('/\D/', '', (string)$empresa['cnpj']);
        }
        $make->tagemit((object)$emitObj);
        $make->tagenderEmit((object)[
            'xLgr'    => (string)$empresa['logradouro'],
            'nro'     => (string)$empresa['numero'],
            'xCpl'    => null,
            'xBairro' => (string)$empresa['bairro'],
            'cMun'    => preg_replace('/\D/', '', (string)$empresa['cMun']),
            'xMun'    => (string)$empresa['xMun'],
            'CEP'     => preg_replace('/\D/', '', (string)$empresa['cep']),
            'UF'      => $ufEmit,
        ]);

        // ---------------------------------------------------------------- rodo
        $rntrc = preg_replace('/\D/', '', (string)fiscal_mdfe_pick($m, ['rntrc'], (string)($veic['rntrc'] ?? '')));
        if ($rntrc !== '') {
            $make->taginfANTT((object)['RNTRC' => $rntrc]);
        }

        // CIOT (opcional)
        $ciots = fiscal_mdfe_pick($m, ['ciot', 'ciots'], []);
        if (is_array($ciots)) {
            foreach ($ciots as $c) {
                if (!is_array($c) || empty($c['codigo'])) continue;
                $make->taginfCIOT((object)[
                    'CIOT' => preg_replace('/\D/', '', (string)$c['codigo']),
                    'CNPJ' => isset($c['cnpj']) ? preg_replace('/\D/', '', (string)$c['cnpj']) : null,
                    'CPF'  => isset($c['cpf']) ? preg_replace('/\D/', '', (string)$c['cpf']) : null,
                ]);
            }
        }

        // seguros
        $seguros = fiscal_mdfe_pick($m, ['seguros'], []);
        if (is_array($seguros)) {
            foreach ($seguros as $seg) {
                if (!is_array($seg)) continue;
                $segObj = (object)[
                    'respSeg' => (string)fiscal_mdfe_pick($seg, ['resp_seg', 'respSeg'], '1'),
                    'CNPJ'    => isset($seg['cnpj_resp']) ? preg_replace('/\D/', '', (string)$seg['cnpj_resp']) : null,
                    'CPF'     => isset($seg['cpf_resp']) ? preg_replace('/\D/', '', (string)$seg['cpf_resp']) : null,
                    'nApol'   => fiscal_mdfe_pick($seg, ['n_apolice', 'nApol'], null),
                    'nAver'   => (isset($seg['n_averbacoes']) && is_array($seg['n_averbacoes'])) ? $seg['n_averbacoes'] : null,
                    'infSeg'  => null,
                ];
                if (!empty($seg['seguradora_nome'])) {
                    $segObj->infSeg = (object)[
                        'xSeg' => $seg['seguradora_nome'],
                        'CNPJ' => isset($seg['seguradora_cnpj']) ? preg_replace('/\D/', '', (string)$seg['seguradora_cnpj']) : null,
                    ];
                }
                $make->tagseg($segObj);
            }
        }

        // veículo de tração + condutores
        $condTags = [];
        foreach (array_slice($condutores, 0, 10) as $c) {
            $nome = (string)fiscal_mdfe_pick((array)$c, ['nome', 'xNome'], '');
            $cpf  = preg_replace('/\D/', '', (string)fiscal_mdfe_pick((array)$c, ['cpf', 'CPF'], ''));
            if ($nome === '' || $cpf === '') continue;
            $condTags[] = (object)['xNome' => mb_substr($nome, 0, 60), 'CPF' => $cpf];
        }
        if (count($condTags) === 0) {
            throw new RuntimeException('Condutor inválido: informe nome e CPF');
        }

        $make->tagveicTracao((object)[
            'cInt'    => '001',
            'placa'   => strtoupper(preg_replace('/[^A-Z0-9]/i', '', (string)$veic['placa'])),
            'RENAVAM' => isset($veic['renavam']) ? preg_replace('/\D/', '', (string)$veic['renavam']) : null,
            'tara'    => (int)fiscal_mdfe_pick($veic, ['tara'], 0),
            'capKG'   => (int)fiscal_mdfe_pick($veic, ['cap_kg', 'capKG'], 0),
            'capM3'   => (int)fiscal_mdfe_pick($veic, ['cap_m3', 'capM3'], 0),
            'tpRod'   => (string)fiscal_mdfe_pick($veic, ['tipo_rodado', 'tpRod'], '06'),
            'tpCar'   => (string)fiscal_mdfe_pick($veic, ['tipo_carroceria', 'tpCar'], '02'),
            'UF'      => strtoupper((string)fiscal_mdfe_pick($veic, ['uf', 'uf_placa', 'UF'], $ufIni)),
            'condutor' => $condTags,
        ]);

        // reboques
        $reboques = fiscal_mdfe_pick($m, ['reboques', 'veic_reboque'], []);
        if (is_array($reboques)) {
            $i = 1;
            foreach (array_slice($reboques, 0, 3) as $r) {
                if (!is_array($r) || empty($r['placa'])) continue;
                $i++;
                $make->tagveicReboque((object)[
                    'cInt'    => str_pad((string)$i, 3, '0', STR_PAD_LEFT),
                    'placa'   => strtoupper(preg_replace('/[^A-Z0-9]/i', '', (string)$r['placa'])),
                    'RENAVAM' => isset($r['renavam']) ? preg_replace('/\D/', '', (string)$r['renavam']) : null,
                    'tara'    => (int)fiscal_mdfe_pick($r, ['tara'], 0),
                    'capKG'   => (int)fiscal_mdfe_pick($r, ['cap_kg', 'capKG'], 0),
                    'capM3'   => (int)fiscal_mdfe_pick($r, ['cap_m3', 'capM3'], 0),
                    'tpCar'   => (string)fiscal_mdfe_pick($r, ['tipo_carroceria', 'tpCar'], '02'),
                    'UF'      => strtoupper((string)fiscal_mdfe_pick($r, ['uf', 'UF'], $ufIni)),
                ]);
            }
        }

        // ------------------------------------------------------- documentos
        $munDescargaFallback = fiscal_mdfe_pick($m, ['municipios_descarregamento', 'mun_descarga'], []);
        $fbCod = ''; $fbNom = '';
        if (is_array($munDescargaFallback) && count($munDescargaFallback) > 0 && is_array($munDescargaFallback[0])) {
            $fbCod = preg_replace('/\D/', '', (string)fiscal_mdfe_pick($munDescargaFallback[0], ['codigo', 'c_mun', 'cMunDescarga', 'codigo_municipio'], ''));
            $fbNom = (string)fiscal_mdfe_pick($munDescargaFallback[0], ['nome', 'x_mun', 'xMunDescarga', 'municipio'], '');
        }

        $grupos = [];
        $qNFe = 0; $qCTe = 0;
        foreach ($documentos as $d) {
            $d = (array)$d;
            $chave = preg_replace('/\D/', '', (string)fiscal_mdfe_pick($d, ['chave', 'chNFe', 'chCTe'], ''));
            if (strlen($chave) !== 44) {
                throw new RuntimeException('Documento com chave inválida (44 dígitos): ' . $chave);
            }
            $cod = preg_replace('/\D/', '', (string)fiscal_mdfe_pick($d, ['c_mun_descarga', 'cMunDescarga', 'codigo_municipio_descarga'], $fbCod));
            $nom = (string)fiscal_mdfe_pick($d, ['x_mun_descarga', 'xMunDescarga', 'municipio_descarga'], $fbNom);
            if ($cod === '' || $nom === '') {
                throw new RuntimeException('Documento sem município de descarga (c_mun_descarga/x_mun_descarga)');
            }
            $tipo = strtolower((string)fiscal_mdfe_pick($d, ['tipo'], substr($chave, 20, 2) === '57' ? 'cte' : 'nfe'));
            $grupos[$cod . '|' . $nom][] = ['tipo' => $tipo, 'chave' => $chave];
            if ($tipo === 'cte') { $qCTe++; } else { $qNFe++; }
        }

        foreach ($grupos as $key => $docs) {
            [$cod, $nom] = explode('|', $key, 2);
            $make->taginfMunDescarga((object)['cMunDescarga' => $cod, 'xMunDescarga' => $nom]);
            foreach ($docs as $d) {
                if ($d['tipo'] === 'cte') {
                    $make->taginfCTe((object)['cMunDescarga' => $cod, 'chCTe' => $d['chave']]);
                } else {
                    $make->taginfNFe((object)['cMunDescarga' => $cod, 'chNFe' => $d['chave']]);
                }
            }
        }

        // ------------------------------------------------- produto predominante
        $totais = (array)fiscal_mdfe_pick($m, ['totais'], []);
        $prodPred = (object)[
            'tpCarga' => (string)fiscal_mdfe_pick($m, ['tipo_carga', 'tpCarga'], '05'),
            'xProd'   => mb_substr((string)fiscal_mdfe_pick($m, ['produto_predominante', 'xProd'], 'CARGA GERAL'), 0, 120) ?: 'CARGA GERAL',
            'cEAN'    => 'SEM GTIN',
            'NCM'     => '00000000',
        ];
        if (count($documentos) === 1) {
            $cepCar = preg_replace('/\D/', '', (string)fiscal_mdfe_pick($m, ['cep_carregamento'], (string)($empresa['cep'] ?? '')));
            $cepDes = preg_replace('/\D/', '', (string)fiscal_mdfe_pick($m, ['cep_descarregamento'], (string)($empresa['cep'] ?? '')));
            $prodPred->infLotacao = (object)[
                'infLocalCarrega'    => (object)['CEP' => $cepCar],
                'infLocalDescarrega' => (object)['CEP' => $cepDes],
            ];
        }
        $make->tagprodPred($prodPred);

        // ------------------------------------------------------------- totais
        $make->tagtot((object)[
            'qCTe'   => $qCTe,
            'qNFe'   => $qNFe,
            'qMDFe'  => 0,
            'vCarga' => number_format((float)fiscal_mdfe_pick($totais, ['valor_carga', 'vCarga'], 0), 2, '.', ''),
            'cUnid'  => (string)fiscal_mdfe_pick($totais, ['unidade_peso', 'cUnid'], '01'),
            'qCarga' => number_format((float)fiscal_mdfe_pick($totais, ['peso_bruto', 'qCarga'], 0), 4, '.', ''),
        ]);

        // lacres
        $lacres = fiscal_mdfe_pick($m, ['lacres'], []);
        if (is_array($lacres)) {
            foreach ($lacres as $l) {
                $num = is_array($l) ? ($l['numero'] ?? '') : $l;
                if ($num !== '') $make->taglacres((object)['nLacre' => (string)$num]);
            }
        }

        $infoAdic = (string)fiscal_mdfe_pick($m, ['info_adicional', 'infCpl'], '');
        if ($infoAdic !== '') {
            $make->taginfAdic((object)['infCpl' => mb_substr($infoAdic, 0, 5000)]);
        }

        $xml = $make->getXML();
        if (!$xml) {
            throw new RuntimeException('Erro ao montar XML MDF-e: ' . implode('; ', $make->getErrors() ?: ['desconhecido']));
        }
        return $xml;
    }
}
