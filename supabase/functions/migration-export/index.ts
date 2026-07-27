import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

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

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: empresas, error: e1 } = await supabase
      .from('empresas')
      .select('id, razao_social, nome_fantasia, cnpj, cpf, tipo_pessoa, inscricao_estadual, uf, municipio, codigo_municipio, ambiente, regime_tributario, ativo, created_at')
      .order('razao_social', { ascending: true })

    if (e1) throw e1

    const { data: tokens, error: e2 } = await supabase
      .from('tokens_api')
      .select('id, empresa_id, nome, token_hash, token_prefix, status, permissoes, ultimo_uso, expires_at, created_at')

    if (e2) throw e2

    const byEmpresa = new Map<string, any[]>()
    for (const t of tokens ?? []) {
      const arr = byEmpresa.get(t.empresa_id) ?? []
      arr.push(t)
      byEmpresa.set(t.empresa_id, arr)
    }

    const result = (empresas ?? []).map((e) => ({
      ...e,
      tokens_api: byEmpresa.get(e.id) ?? [],
    }))

    return new Response(
      JSON.stringify({
        total_empresas: result.length,
        total_tokens: tokens?.length ?? 0,
        note: 'token_hash é o hash armazenado (não o valor original). token_prefix é os primeiros caracteres visíveis. Tokens originais não são recuperáveis — para migração, importe o hash como está e o ERP continuará autenticando com o mesmo token que já possui.',
        empresas: result,
      }),
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
