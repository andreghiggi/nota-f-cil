import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

// Gera token no formato ff_<48 chars> e retorna { plain, hash, prefix }
async function gerarToken() {
  const bytes = new Uint8Array(36)
  crypto.getRandomValues(bytes)
  const b64 = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '')
    .replace(/\//g, '')
    .replace(/=/g, '')
    .slice(0, 48)
  const plain = `ff_${b64}`
  const hashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(plain))
  const hash = Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return { plain, hash, prefix: plain.slice(0, 12) }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const token = req.headers.get('x-migration-token') ||
                  req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    const expected = Deno.env.get('MIGRATION_TOKEN')

    if (!expected || !token || token !== expected) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const url = new URL(req.url)
    // ?regenerate=1 => cria um novo token por empresa e devolve o valor em claro (só aparece agora)
    // ?regenerate=1&empresa_id=xxx => regenera só uma empresa
    // ?fix_permissions=1 => atualiza tokens com permissões pontilhadas para o formato legado das APIs
    const regenerate = url.searchParams.get('regenerate') === '1'
    const fixPermissions = url.searchParams.get('fix_permissions') === '1'
    const empresaFilter = url.searchParams.get('empresa_id')
    const cnpjFilter = (url.searchParams.get('cnpj') || '').replace(/\D/g, '')

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const PERMISSOES_LEGADO = [
      'emitir_nfe', 'emitir_nfce', 'emitir_mdfe', 'emitir_cte', 'emitir_nfse',
      'emitir', 'consultar', 'cancelar', 'inutilizar', 'manifestar', 'gerenciar',
      'reprocessar',
    ]

    if (fixPermissions) {
      let tokensQuery = supabase
        .from('tokens_api')
        .select('id, empresa_id, token_prefix, permissoes, status')
        .eq('status', 'ativo')
      if (empresaFilter) tokensQuery = tokensQuery.eq('empresa_id', empresaFilter)

      const { data: tokens, error: eTok } = await tokensQuery
      if (eTok) throw eTok

      let empresaIdsFilter: Set<string> | null = null
      if (cnpjFilter) {
        const { data: emps, error: eEmp } = await supabase
          .from('empresas')
          .select('id, cnpj')
          .eq('cnpj', cnpjFilter)
        if (eEmp) throw eEmp
        empresaIdsFilter = new Set((emps ?? []).map((e: any) => e.id))
      }

      const atualizados: any[] = []
      for (const t of tokens ?? []) {
        if (empresaIdsFilter && !empresaIdsFilter.has(t.empresa_id)) continue
        const current = Array.isArray(t.permissoes) ? t.permissoes : []
        const hasDotted = current.some((p: string) => typeof p === 'string' && p.includes('.'))
        const missingLegacy = PERMISSOES_LEGADO.some((p) => !current.includes(p))
        if (!hasDotted && !missingLegacy) continue

        const merged = Array.from(new Set([...current, ...PERMISSOES_LEGADO]))
        const { error: eUp } = await supabase
          .from('tokens_api')
          .update({ permissoes: merged })
          .eq('id', t.id)
        if (eUp) {
          atualizados.push({ id: t.id, prefix: t.token_prefix, erro: eUp.message })
        } else {
          atualizados.push({ id: t.id, prefix: t.token_prefix, permissoes: merged })
        }
      }

      return new Response(
        JSON.stringify({
          modo: 'fix_permissions',
          atualizados: atualizados.length,
          tokens: atualizados,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    let empresasQuery = supabase
      .from('empresas')
      .select('id, razao_social, nome_fantasia, cnpj, cpf, tipo_pessoa, inscricao_estadual, uf, municipio, codigo_municipio, ambiente, regime_tributario, ativo, created_at')
      .order('razao_social', { ascending: true })

    if (empresaFilter) empresasQuery = empresasQuery.eq('id', empresaFilter)
    if (cnpjFilter) empresasQuery = empresasQuery.eq('cnpj', cnpjFilter)

    const { data: empresas, error: e1 } = await empresasQuery
    if (e1) throw e1

    const { data: tokensExistentes, error: e2 } = await supabase
      .from('tokens_api')
      .select('id, empresa_id, nome, token_prefix, status, permissoes, ultimo_uso, expires_at, created_at')
    if (e2) throw e2

    const byEmpresa = new Map<string, any[]>()
    for (const t of tokensExistentes ?? []) {
      const arr = byEmpresa.get(t.empresa_id) ?? []
      arr.push(t)
      byEmpresa.set(t.empresa_id, arr)
    }

    const result: any[] = []
    for (const e of empresas ?? []) {
      const item: any = {
        ...e,
        tokens_existentes: byEmpresa.get(e.id) ?? [],
      }

      if (regenerate) {
        const { plain, hash, prefix } = await gerarToken()
        const { data: novo, error: eIns } = await supabase
          .from('tokens_api')
          .insert({
            empresa_id: e.id,
            nome: `Migração ${new Date().toISOString().slice(0, 10)}`,
            token_hash: hash,
            token_prefix: prefix,
            status: 'ativo',
            permissoes: [
              // Formato legado exigido por nfe-api / nfce-api / mdfe-api / management-api
              'emitir_nfe', 'emitir_nfce', 'emitir_mdfe', 'emitir_cte', 'emitir_nfse',
              'emitir', 'consultar', 'cancelar', 'inutilizar', 'manifestar', 'gerenciar',
              'reprocessar',
            ],
          })
          .select('id, nome, token_prefix, permissoes, created_at')
          .single()
        if (eIns) {
          item.token_novo_erro = eIns.message
        } else {
          item.token_novo = {
            id: novo!.id,
            nome: novo!.nome,
            prefix: novo!.token_prefix,
            token_plain: plain, // VISÍVEL APENAS AGORA
            permissoes: novo!.permissoes,
            aviso: 'Copie este token agora. Ele não poderá ser recuperado depois.',
          }
        }
      }

      result.push(item)
    }

    return new Response(
      JSON.stringify({
        modo: regenerate ? 'regenerar' : 'listar',
        total_empresas: result.length,
        aviso: regenerate
          ? 'Novos tokens foram criados. Os valores em claro só aparecem nesta resposta — salve o JSON.'
          : 'Tokens existentes têm apenas hash — o valor original não é recuperável. Use ?regenerate=1 para criar novos.',
        empresas: result,
      }, null, 2),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('migration-export error', err)
    return new Response(JSON.stringify({ error: String((err as Error)?.message ?? err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
