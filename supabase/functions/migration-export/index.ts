import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import postgres from 'npm:postgres@3.4.4'

const PROJECT_REF = 'vdzkhealunurfgrujekg'

const TABLES = [
  'empresas',
  'certificados_digitais',
  'tokens_api',
  'user_roles',
  'nfce',
  'nfce_itens',
  'nfce_eventos',
  'nfe',
  'nfe_itens',
  'nfe_eventos',
  'mdfe',
  'mdfe_documentos',
  'mdfe_eventos',
  'cte',
  'cte_documentos',
  'cte_eventos',
  'nfse',
  'series_fiscais',
  'series_numeros_liberados',
  'configuracoes_fiscais',
  'dfe_recebidas',
  'dfe_eventos',
  'dfe_distribuicao_controle',
  'logs_fiscais',
  'fila_processamento',
  'fila_processamento_nfe',
  'fila_processamento_mdfe',
  'fila_processamento_cte',
  'fila_processamento_nfse',
  'nfce_contingencia_queue',
  'job_runs',
  'job_locks',
  'job_circuit',
  'webhooks',
  'webhook_logs',
]

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // ---- Auth (somente header x-migration-token) ----
  const token =
    req.headers.get('x-migration-token') ||
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  const expected = Deno.env.get('MIGRATION_TOKEN')
  if (!expected || !token || token !== expected) {
    return json({ error: 'unauthorized' }, 401)
  }

  const url = new URL(req.url)
  const mode = url.searchParams.get('mode')
  const resource = url.searchParams.get('resource')
  const table = url.searchParams.get('table')
  const offset = Math.max(0, parseInt(url.searchParams.get('offset') ?? '0', 10) || 0)
  const limit = Math.min(2000, Math.max(1, parseInt(url.searchParams.get('limit') ?? '500', 10) || 500))

  // ---- ping (rápido, sem tocar no banco) ----
  if (mode === 'ping' || (!resource && !table)) {
    return json({ ok: true, project: PROJECT_REF, tables: TABLES })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  try {
    // ---- export de tabela paginado ----
    if (table) {
      if (!TABLES.includes(table)) {
        return json({ error: 'table_not_allowed', table, tables: TABLES }, 400)
      }
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .range(offset, offset + limit - 1)
      if (error) throw error
      const rows = data ?? []
      return json({ table, offset, limit, rows, has_more: rows.length === limit })
    }

    // ---- auth.users + auth.identities (com hash de senha) ----
    if (resource === 'auth-users') {
      const dbUrl = Deno.env.get('SUPABASE_DB_URL')
      if (!dbUrl) return json({ error: 'db_unavailable' }, 503)
      const sql = postgres(dbUrl, { prepare: false, max: 1, idle_timeout: 5 })
      try {
        const users = await sql`
          SELECT id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
                 invited_at, confirmation_sent_at, recovery_sent_at, last_sign_in_at,
                 raw_app_meta_data, raw_user_meta_data, is_super_admin, is_sso_user,
                 phone, phone_confirmed_at, banned_until, deleted_at,
                 created_at, updated_at
            FROM auth.users
           ORDER BY created_at
           LIMIT ${limit} OFFSET ${offset}
        `
        const ids = users.map((u: any) => u.id)
        const identities = ids.length
          ? await sql`
              SELECT id, user_id, provider, provider_id, identity_data,
                     last_sign_in_at, created_at, updated_at
                FROM auth.identities
               WHERE user_id = ANY(${sql.array(ids)}::uuid[])
            `
          : []
        return json({
          resource: 'auth-users',
          offset,
          limit,
          users,
          identities,
          has_more: users.length === limit,
        })
      } finally {
        await sql.end({ timeout: 5 })
      }
    }

    // ---- storage: só listagem de paths ----
    if (resource === 'storage-list') {
      const bucket = url.searchParams.get('bucket') ?? 'certificados'
      const prefix = url.searchParams.get('prefix') ?? ''
      const { data, error } = await supabase.storage.from(bucket).list(prefix, {
        limit,
        offset,
        sortBy: { column: 'name', order: 'asc' },
      })
      if (error) throw error
      const objects = (data ?? []).map((o: any) => ({
        name: prefix ? `${prefix}/${o.name}` : o.name,
        id: o.id,
        metadata: o.metadata,
      }))
      return json({
        resource: 'storage-list',
        bucket,
        prefix,
        offset,
        limit,
        objects,
        has_more: objects.length === limit,
      })
    }

    // ---- storage: download de um objeto em base64 ----
    if (resource === 'storage-download') {
      const bucket = url.searchParams.get('bucket') ?? 'certificados'
      const path = url.searchParams.get('path') ?? ''
      if (!path) return json({ error: 'path_required' }, 400)
      const { data, error } = await supabase.storage.from(bucket).download(path)
      if (error || !data) return json({ error: 'not_found', bucket, path }, 404)
      const buf = new Uint8Array(await data.arrayBuffer())
      let bin = ''
      const CH = 0x8000
      for (let i = 0; i < buf.length; i += CH) {
        bin += String.fromCharCode(...buf.subarray(i, i + CH))
      }
      return json({ bucket, path, size: buf.length, data_b64: btoa(bin) })
    }

    // ---- contagem por tabela (planejamento da migração) ----
    if (resource === 'counts') {
      const counts: Record<string, number | string> = {}
      for (const t of TABLES) {
        const { count, error } = await supabase.from(t).select('*', { count: 'exact', head: true })
        counts[t] = error ? `erro: ${error.message}` : (count ?? 0)
      }
      return json({ resource: 'counts', counts })
    }

    // ---- dados de conexão (sem expor senha) ----
    if (resource === 'db-uri') {
      const dbUrl = Deno.env.get('SUPABASE_DB_URL')
      if (!dbUrl) return json({ 'db-uri': 'unavailable' })
      try {
        const u = new URL(dbUrl)
        return json({
          hint: 'Grave CLOUD_DATABASE_URL na VPS em /opt/apps/agilize-apis/config/.pgpass — não repita a senha no chat',
          pooler_host: u.hostname,
          port: Number(u.port || 5432),
          user: decodeURIComponent(u.username),
          database: u.pathname.replace(/^\//, '') || 'postgres',
        })
      } catch {
        return json({ 'db-uri': 'unavailable' })
      }
    }

    return json({ error: 'unknown_request', usage: ['?mode=ping', '?table=NOME&offset=0&limit=500', '?resource=auth-users', '?resource=storage-list&bucket=certificados', '?resource=counts', '?resource=db-uri'] }, 400)
  } catch (err) {
    console.error('migration-export error', err)
    return json({ error: String((err as Error)?.message ?? err) }, 500)
  }
})
