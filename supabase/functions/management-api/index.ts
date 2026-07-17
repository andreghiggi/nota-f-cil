import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** NF-e: série canônica em 3 dígitos — "1", "001" e "0001" → "001" (Basalteare usa 001). */
function normalizeSerieFiscal(serie: string | null | undefined): string {
  const t = String(serie ?? '').trim();
  if (!t) return '001';
  if (/^\d+$/.test(t)) return String(parseInt(t, 10)).padStart(3, '0');
  return t;
}

function formatNumeroNfe(numero: number): string {
  if (!Number.isFinite(numero) || numero <= 0) return '';
  return String(numero).padStart(9, '0');
}

function serieAliases(serie: string): string[] {
  const t = String(serie).trim();
  const canon = normalizeSerieFiscal(t);
  const set = new Set<string>([t, canon]);
  if (/^\d+$/.test(canon)) {
    const n = parseInt(canon, 10);
    for (const width of [1, 2, 3, 4]) {
      set.add(String(n).padStart(width, '0'));
    }
  }
  return [...set];
}

async function resolveUltimoNumeroSerie(
  supabase: ReturnType<typeof createClient>,
  empresaId: string,
  tipo: string,
  serieInput: string,
): Promise<{ canon: string; ultimo: number; ativo: boolean }> {
  const canon = normalizeSerieFiscal(serieInput);
  const aliases = serieAliases(serieInput);

  const { data: nfes } = await supabase
    .from('nfe')
    .select('numero, serie')
    .eq('empresa_id', empresaId)
    .in('serie', aliases)
    .in('status', ['autorizada', 'autorizado', 'cancelada']);

  let maxNfe = 0;
  for (const row of nfes || []) {
    const n = parseInt(String(row.numero || '').replace(/\D/g, '') || '0', 10);
    if (n > maxNfe) maxNfe = n;
  }

  const { data: rows } = await supabase
    .from('series_fiscais')
    .select('id, serie, numero_atual, ativo')
    .eq('empresa_id', empresaId)
    .eq('tipo', tipo)
    .in('serie', aliases);

  let maxSerie = 0;
  let ativo = false;
  for (const row of rows || []) {
    maxSerie = Math.max(maxSerie, row.numero_atual ?? 0);
    if (row.ativo) ativo = true;
  }

  const ultimo = Math.max(maxNfe, maxSerie);

  if (ultimo > 0) {
    const { data: canonRow } = await supabase
      .from('series_fiscais')
      .select('id, numero_atual, ativo')
      .eq('empresa_id', empresaId)
      .eq('tipo', tipo)
      .eq('serie', canon)
      .maybeSingle();

    if (!canonRow) {
      // Nunca criamos série automaticamente. Apenas reflete o último número
      // consolidado com base nas notas existentes.
    } else if ((canonRow.numero_atual ?? 0) < ultimo || !canonRow.ativo) {
      await supabase
        .from('series_fiscais')
        .update({
          numero_atual: Math.max(canonRow.numero_atual ?? 0, ultimo),
          ativo: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', canonRow.id);
      ativo = true;
    }

    for (const alias of aliases) {
      if (alias === canon) continue;
      const { data: aliasRow } = await supabase
        .from('series_fiscais')
        .select('id, numero_atual')
        .eq('empresa_id', empresaId)
        .eq('tipo', tipo)
        .eq('serie', alias)
        .maybeSingle();
      if (aliasRow && (aliasRow.numero_atual ?? 0) < ultimo) {
        await supabase
          .from('series_fiscais')
          .update({ numero_atual: ultimo, updated_at: new Date().toISOString() })
          .eq('id', aliasRow.id);
      }
    }
  }

  return { canon, ultimo, ativo };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Health check
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const route = pathParts.slice(1).join('/');
    if (!route || route === 'health') {
      return jsonResponse({ status: 'ok', service: 'management-api', timestamp: new Date().toISOString() });
    }
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    // pathParts[0] = 'management-api', pathParts[1+] = route
    const route = pathParts.slice(1).join('/');
    const method = req.method;

    // ===== Auth: validate API token =====
    const apiKey = req.headers.get('x-api-key') || req.headers.get('authorization')?.replace('Bearer ', '');

    if (!apiKey) {
      return jsonResponse({ success: false, error: 'Token de API obrigatório.' }, 401);
    }

    const tokenHash = await hashToken(apiKey);
    const { data: tokenData, error: tokenError } = await supabase
      .rpc('validar_token_api', { p_token_hash: tokenHash });

    if (tokenError || !tokenData || tokenData.length === 0) {
      return jsonResponse({ success: false, error: 'Token inválido ou expirado.' }, 401);
    }

    const { token_id, empresa_id, permissoes, ambiente } = tokenData[0];

    // Update last usage
    await supabase
      .from('tokens_api')
      .update({ ultimo_uso: new Date().toISOString(), ip_ultimo_uso: req.headers.get('x-forwarded-for') || 'unknown' })
      .eq('id', token_id);

    // =====================================================================
    // GET /certificado/status
    // =====================================================================
    if (method === 'GET' && route === 'certificado/status') {
      const { data: cert, error: certError } = await supabase
        .from('certificados_digitais')
        .select('*')
        .eq('empresa_id', empresa_id)
        .maybeSingle();

      if (certError || !cert) {
        return jsonResponse({ success: false, error: 'Nenhum certificado encontrado para este CNPJ.' }, 404);
      }

      const { data: empresa } = await supabase
        .from('empresas')
        .select('razao_social, cnpj, cpf, tipo_pessoa')
        .eq('id', empresa_id)
        .single();

      const vencimento = new Date(cert.data_vencimento);
      const hoje = new Date();
      const diasRestantes = Math.ceil((vencimento.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));

      let status = 'ativo';
      if (diasRestantes <= 0) status = 'expirado';
      else if (diasRestantes <= 30) status = 'proximo_vencimento';

      return jsonResponse({
        success: true,
        data: {
          titular: empresa?.razao_social || cert.cnpj_certificado || '',
          cnpj: empresa?.tipo_pessoa === 'PF' ? empresa?.cpf : empresa?.cnpj,
          validade: vencimento.toISOString(),
          expira_em: cert.data_vencimento,
          dias_restantes: diasRestantes,
          status,
        },
      });
    }

    // =====================================================================
    // POST /certificado/upload
    // =====================================================================
    if (method === 'POST' && route === 'certificado/upload') {
      const body = await req.json();
      const { certificado_base64, senha } = body;

      if (!certificado_base64 || !senha) {
        return jsonResponse({ success: false, error: 'Campos certificado_base64 e senha são obrigatórios.' }, 400);
      }

      // Validate by trying to decode base64
      let pfxBytes: Uint8Array;
      try {
        const binary = atob(certificado_base64);
        pfxBytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          pfxBytes[i] = binary.charCodeAt(i);
        }
        if (pfxBytes.length < 100) {
          throw new Error('too small');
        }
      } catch {
        return jsonResponse({ success: false, error: 'Arquivo de certificado inválido ou corrompido.' }, 400);
      }

      // Get empresa info
      const { data: empresa } = await supabase
        .from('empresas')
        .select('razao_social, cnpj, cpf, tipo_pessoa')
        .eq('id', empresa_id)
        .single();

      const doc = empresa?.tipo_pessoa === 'PF' ? empresa?.cpf : empresa?.cnpj;
      const docClean = (doc || '').replace(/\D/g, '');

      // Upload to storage
      const storagePath = `${empresa_id}/${docClean}_${Date.now()}.pfx`;
      const pfxBuffer = pfxBytes.buffer.slice(pfxBytes.byteOffset, pfxBytes.byteOffset + pfxBytes.byteLength);

      const { error: uploadError } = await supabase.storage
        .from('certificados')
        .upload(storagePath, pfxBuffer, { contentType: 'application/x-pkcs12', upsert: true });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        return jsonResponse({ success: false, error: 'Erro ao armazenar certificado.' }, 500);
      }

      // Encode password as base64 for storage (matching existing pattern)
      const senhaHash = btoa(senha);

      // Default expiry 1 year from now (will be updated when validated)
      const defaultExpiry = new Date();
      defaultExpiry.setFullYear(defaultExpiry.getFullYear() + 1);

      // Check if certificate already exists for this empresa
      const { data: existingCert } = await supabase
        .from('certificados_digitais')
        .select('id')
        .eq('empresa_id', empresa_id)
        .maybeSingle();

      let certResult;
      if (existingCert) {
        const { data, error } = await supabase
          .from('certificados_digitais')
          .update({
            arquivo_path: storagePath,
            senha_hash: senhaHash,
            cnpj_certificado: docClean,
            status: 'valido',
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingCert.id)
          .select()
          .single();
        certResult = { data, error };
      } else {
        const { data, error } = await supabase
          .from('certificados_digitais')
          .insert({
            empresa_id,
            tipo: 'A1',
            arquivo_path: storagePath,
            senha_hash: senhaHash,
            cnpj_certificado: docClean,
            data_vencimento: defaultExpiry.toISOString().split('T')[0],
            status: 'valido',
          })
          .select()
          .single();
        certResult = { data, error };
      }

      if (certResult.error) {
        return jsonResponse({ success: false, error: 'Erro ao salvar certificado.' }, 500);
      }

      // Try to validate via fiscal API
      try {
        await supabase.functions.invoke('validate-certificate', {
          body: { empresa_id },
        });
      } catch {
        // Non-critical, continue
      }

      // Re-fetch to get validated data
      const { data: updatedCert } = await supabase
        .from('certificados_digitais')
        .select('*')
        .eq('empresa_id', empresa_id)
        .single();

      const vencimento = new Date(updatedCert?.data_vencimento || defaultExpiry);
      const diasRestantes = Math.ceil((vencimento.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

      return jsonResponse({
        success: true,
        data: {
          titular: empresa?.razao_social || '',
          cnpj: doc,
          validade: vencimento.toISOString(),
          dias_restantes: diasRestantes,
          message: 'Certificado instalado com sucesso.',
        },
      });
    }

    // =====================================================================
    // GET /series
    // =====================================================================
    if (method === 'GET' && route === 'series') {
      const { data: series, error } = await supabase
        .from('series_fiscais')
        .select('serie, tipo, numero_atual, ativo')
        .eq('empresa_id', empresa_id)
        .order('tipo')
        .order('serie');

      if (error) {
        return jsonResponse({ success: false, error: 'Erro ao listar séries.' }, 500);
      }

      const { data: empDef } = await supabase
        .from('empresas')
        .select('serie_nfe, serie_nfce, serie_mdfe')
        .eq('id', empresa_id)
        .single();

      const tipoToModelo = (t: string) => t === 'nfe' ? '55' : t === 'nfce' ? '65' : '58';

      const modeloFiltro = url.searchParams.get('modelo') || '';
      const byCanon = new Map<string, {
        tipo: string;
        ultimo: number;
        ativa: boolean;
      }>();

      for (const s of series || []) {
        const mod = tipoToModelo(s.tipo);
        if (modeloFiltro && mod !== modeloFiltro) continue;
        const canon = normalizeSerieFiscal(s.serie);
        const cur = byCanon.get(`${s.tipo}:${canon}`);
        const num = s.numero_atual ?? 0;
        if (!cur || num > cur.ultimo) {
          byCanon.set(`${s.tipo}:${canon}`, {
            tipo: s.tipo,
            ultimo: num,
            ativa: !!s.ativo,
          });
        } else if (cur && s.ativo) {
          cur.ativa = true;
        }
      }

      // Fallback: se a "série padrão" da empresa NÃO existir em series_fiscais ativas,
      // usar a primeira série ATIVA existente. Aplicado somente para NF-e (modelo 55)
      // para não alterar comportamento de NFC-e/MDF-e em produção.
      const seriesAtivasPorTipo = (tipo: string) =>
        (series || [])
          .filter((s) => s.tipo === tipo && s.ativo)
          .map((s) => normalizeSerieFiscal(s.serie));

      const resolvePadrao = (tipo: 'nfe' | 'nfce' | 'mdfe', legacy: string | null | undefined) => {
        const canon = normalizeSerieFiscal(legacy || '001');
        if (tipo !== 'nfe') return canon; // NFC-e/MDF-e: mantém comportamento atual
        const ativas = seriesAtivasPorTipo('nfe');
        if (ativas.includes(canon)) return canon;
        return ativas[0] || canon; // fallback para 1ª série NF-e ativa
      };

      const padraoNfe = resolvePadrao('nfe', empDef?.serie_nfe);
      const padraoNfce = normalizeSerieFiscal(empDef?.serie_nfce || '001');
      const padraoMdfe = normalizeSerieFiscal(empDef?.serie_mdfe || '001');


      const mapped: Array<Record<string, unknown>> = [];
      for (const [key, val] of byCanon.entries()) {
        const canon = key.split(':')[1] || key;
        const resolved = await resolveUltimoNumeroSerie(supabase, empresa_id, val.tipo, canon);
        const proximo = resolved.ultimo + 1;
        mapped.push({
          serie: resolved.canon,
          modelo: tipoToModelo(val.tipo),
          tipo: val.tipo,
          ultimo_numero: resolved.ultimo,
          ultimo_numero_formatado: formatNumeroNfe(resolved.ultimo),
          proximo_numero: proximo,
          proximo_numero_formatado: formatNumeroNfe(proximo),
          ativa: resolved.ativo || val.ativa,
          padrao_empresa:
            (val.tipo === 'nfe' && resolved.canon === padraoNfe)
            || (val.tipo === 'nfce' && resolved.canon === padraoNfce)
            || (val.tipo === 'mdfe' && resolved.canon === padraoMdfe),
        });
      }

      mapped.sort((a, b) => String(a.serie).localeCompare(String(b.serie), undefined, { numeric: true }));

      return jsonResponse({
        success: true,
        data: mapped,
        padroes: {
          nfe: padraoNfe,
          nfce: padraoNfce,
          mdfe: padraoMdfe,
        },
      });
    }

    // =====================================================================
    // GET /proximo-numero?modelo=55&serie=002
    //   - modelo: 55 (NF-e) | 65 (NFC-e) | 58 (MDF-e). Default: 55
    //   - serie: opcional. Se omitida, usa a série padrão da empresa.
    // Retorna o próximo número SEM incrementar (consulta).
    // =====================================================================
    if (method === 'GET' && route === 'proximo-numero') {
      const modelo = url.searchParams.get('modelo') || '55';
      const tipo = modelo === '65' ? 'nfce' : modelo === '58' ? 'mdfe' : 'nfe';
      let serie = url.searchParams.get('serie');

      if (!serie) {
        const { data: emp } = await supabase
          .from('empresas')
          .select('serie_nfe, serie_nfce, serie_mdfe')
          .eq('id', empresa_id)
          .single();
        serie = tipo === 'nfe' ? emp?.serie_nfe
              : tipo === 'nfce' ? emp?.serie_nfce
              : emp?.serie_mdfe;

        // Fallback NF-e: se a série padrão da empresa não estiver ativa em series_fiscais,
        // usar a primeira série NF-e ativa. (Não altera NFC-e/MDF-e.)
        if (tipo === 'nfe') {
          const { data: ativasRows } = await supabase
            .from('series_fiscais')
            .select('serie')
            .eq('empresa_id', empresa_id)
            .eq('tipo', 'nfe')
            .eq('ativo', true);
          const ativas = (ativasRows || []).map((r: any) => normalizeSerieFiscal(r.serie));
          const canon = normalizeSerieFiscal(serie || '');
          if (!canon || !ativas.includes(canon)) {
            serie = ativas[0] || serie;
          }
        }

        if (!serie) {
          return jsonResponse({ success: false, error: 'Série padrão não configurada para a empresa.' }, 400);
        }
      }


      const resolved = await resolveUltimoNumeroSerie(supabase, empresa_id, tipo, serie);
      const proximo = resolved.ultimo + 1;
      return jsonResponse({
        success: true,
        data: {
          modelo,
          tipo,
          serie: resolved.canon,
          ultimo_numero: resolved.ultimo,
          ultimo_numero_formatado: formatNumeroNfe(resolved.ultimo),
          proximo_numero: proximo,
          proximo_numero_formatado: formatNumeroNfe(proximo),
          ativa: resolved.ativo,
          existe: resolved.ultimo > 0,
        },
      });
    }

    // =====================================================================
    // POST /series  { serie, modelo, ativa?, ultimo_numero? }
    // =====================================================================
    if (method === 'POST' && route === 'series') {
      const body = await req.json();
      const { serie: serieRaw, modelo, ativa, ultimo_numero } = body;

      if (!serieRaw || !modelo) {
        return jsonResponse({ success: false, error: 'Campos serie e modelo são obrigatórios.' }, 400);
      }

      const serie = normalizeSerieFiscal(serieRaw);

      const tipo = modelo === '55' ? 'nfe' : modelo === '65' ? 'nfce' : modelo === '58' ? 'mdfe' : null;
      if (!tipo) {
        return jsonResponse({ success: false, error: 'Modelo inválido. Use 55, 65 ou 58.' }, 400);
      }

      const { data: existingRows } = await supabase
        .from('series_fiscais')
        .select('id, numero_atual, serie')
        .eq('empresa_id', empresa_id)
        .eq('tipo', tipo)
        .in('serie', serieAliases(serie));

      const existing = (existingRows || []).find((r) => normalizeSerieFiscal(r.serie) === serie)
        || (existingRows || [])[0];

      const patch: any = { updated_at: new Date().toISOString() };
      if (ativa !== undefined) patch.ativo = ativa;
      if (ultimo_numero !== undefined && ultimo_numero !== null) {
        const n = parseInt(String(ultimo_numero), 10);
        if (Number.isNaN(n) || n < 0) {
          return jsonResponse({ success: false, error: 'ultimo_numero inválido.' }, 400);
        }
        patch.numero_atual = n;
      }

      let result;
      if (existing) {
        const { data, error } = await supabase
          .from('series_fiscais')
          .update(patch)
          .eq('id', existing.id)
          .select()
          .single();
        result = { data, error };
      } else {
        const { data, error } = await supabase
          .from('series_fiscais')
          .insert({
            empresa_id,
            tipo,
            serie,
            numero_atual: patch.numero_atual ?? 0,
            ativo: ativa !== undefined ? ativa : true,
          })
          .select()
          .single();
        result = { data, error };
      }

      if (result.error) {
        return jsonResponse({ success: false, error: 'Erro ao criar/atualizar série.' }, 500);
      }

      return jsonResponse({
        success: true,
        data: {
          serie: result.data.serie,
          modelo,
          tipo,
          ultimo_numero: result.data.numero_atual,
          proximo_numero: result.data.numero_atual + 1,
          ativa: result.data.ativo,
        },
      });
    }

    // =====================================================================
    // GET /ambiente
    // =====================================================================
    if (method === 'GET' && route === 'ambiente') {
      const { data: empresa } = await supabase
        .from('empresas')
        .select('ambiente')
        .eq('id', empresa_id)
        .single();

      return jsonResponse({
        success: true,
        data: { ambiente: empresa?.ambiente || 'homologacao' },
      });
    }

    // =====================================================================
    // POST /ambiente
    // =====================================================================
    if (method === 'POST' && route === 'ambiente') {
      const body = await req.json();
      const { ambiente: novoAmbiente } = body;

      if (!novoAmbiente || !['homologacao', 'producao'].includes(novoAmbiente)) {
        return jsonResponse({ success: false, error: 'Ambiente deve ser "homologacao" ou "producao".' }, 400);
      }

      const { error } = await supabase
        .from('empresas')
        .update({ ambiente: novoAmbiente, updated_at: new Date().toISOString() })
        .eq('id', empresa_id);

      if (error) {
        return jsonResponse({ success: false, error: 'Erro ao alterar ambiente.' }, 500);
      }

      // Re-register on fiscal API with new environment
      try {
        await supabase.functions.invoke('fiscal-api', {
          body: { action: 'register_empresa', empresa_id },
        });
      } catch {
        // Non-critical
      }

      return jsonResponse({
        success: true,
        data: { ambiente: novoAmbiente },
      });
    }

    // =====================================================================
    // POST /tokens — Create API token from ERP
    // =====================================================================
    if (method === 'POST' && route === 'tokens') {
      // Only tokens with 'gerenciar' permission can create new tokens
      if (!permissoes.includes('gerenciar') && !permissoes.includes('admin')) {
        return jsonResponse({
          success: false,
          error: 'Permissão negada. O token deve ter permissão "gerenciar" ou "admin".',
        }, 403);
      }

      const body = await req.json();
      const { nome, permissoes: novasPermissoes, expires_at } = body;

      if (!nome) {
        return jsonResponse({ success: false, error: 'Campo nome é obrigatório.' }, 400);
      }

      const permissoesValidas = ['emitir_nfce', 'emitir_nfe', 'emitir_mdfe', 'emitir', 'consultar', 'consultar_dfe', 'manifestar_dfe', 'cancelar', 'reprocessar', 'gerenciar', 'admin'];
      const permissoesFinais = (novasPermissoes || ['emitir_nfce', 'emitir_nfe', 'consultar', 'consultar_dfe', 'manifestar_dfe']).filter(
        (p: string) => permissoesValidas.includes(p)
      );

      // Generate token
      const token = `nfce_${crypto.randomUUID().replace(/-/g, '')}`;
      const tokenPrefix = token.substring(0, 12);
      const newTokenHash = await hashToken(token);

      const insertData: any = {
        empresa_id,
        nome,
        token_hash: newTokenHash,
        token_prefix: tokenPrefix,
        permissoes: permissoesFinais,
        status: 'ativo',
      };

      if (expires_at) {
        insertData.expires_at = expires_at;
      }

      const { data: newToken, error } = await supabase
        .from('tokens_api')
        .insert(insertData)
        .select('id, nome, token_prefix, permissoes, status, created_at, expires_at')
        .single();

      if (error) {
        return jsonResponse({ success: false, error: 'Erro ao criar token.', details: error.message }, 500);
      }

      return jsonResponse({
        success: true,
        data: {
          ...newToken,
          token: token, // Full token — only shown once
          message: 'Token criado com sucesso. Guarde-o em local seguro, ele não será exibido novamente.',
        },
      }, 201);
    }

    // =====================================================================
    // GET /tokens — List tokens
    // =====================================================================
    if (method === 'GET' && route === 'tokens') {
      if (!permissoes.includes('gerenciar') && !permissoes.includes('admin') && !permissoes.includes('consultar')) {
        return jsonResponse({ success: false, error: 'Permissão negada.' }, 403);
      }

      const { data: tokens, error } = await supabase
        .from('tokens_api')
        .select('id, nome, token_prefix, status, permissoes, created_at, expires_at, ultimo_uso')
        .eq('empresa_id', empresa_id)
        .order('created_at', { ascending: false });

      if (error) {
        return jsonResponse({ success: false, error: 'Erro ao listar tokens.' }, 500);
      }

      return jsonResponse({ success: true, data: tokens });
    }

    // =====================================================================
    // DELETE /tokens/:id — Revoke token
    // =====================================================================
    if (method === 'DELETE' && route.startsWith('tokens/')) {
      if (!permissoes.includes('gerenciar') && !permissoes.includes('admin')) {
        return jsonResponse({ success: false, error: 'Permissão negada.' }, 403);
      }

      const targetTokenId = route.split('/')[1];

      const { error } = await supabase
        .from('tokens_api')
        .update({ status: 'revogado' })
        .eq('id', targetTokenId)
        .eq('empresa_id', empresa_id);

      if (error) {
        return jsonResponse({ success: false, error: 'Erro ao revogar token.' }, 500);
      }

      return jsonResponse({ success: true, data: { id: targetTokenId, status: 'revogado' } });
    }

    return jsonResponse({ success: false, error: 'Endpoint não encontrado.' }, 404);
  } catch (error: any) {
    console.error('Management API error:', error);
    return jsonResponse({ success: false, error: 'Erro interno do servidor.' }, 500);
  }
});
