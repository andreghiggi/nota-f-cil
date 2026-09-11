import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BON_APPETIT_URL = 'https://iwmrtxdzlkasuzutxvhh.supabase.co/functions/v1/nfce-webhook';
const BON_APPETIT_NOME = 'Bon Appetit - ComandaTech';
const EVENTOS = ['nfce.autorizada', 'nfce.rejeitada', 'nfce.cancelada', 'nfce.denegada'];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function hmacSha256(payload: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(supabaseUrl, serviceKey);

  try {
    // ===== Autenticação: apenas admin da plataforma =====
    const authHeader = req.headers.get('Authorization') || '';
    const jwt = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!jwt) return json({ success: false, error: 'Não autenticado' }, 401);

    const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
    if (userErr || !userData?.user) return json({ success: false, error: 'Não autenticado' }, 401);

    const { data: isAdmin } = await admin.rpc('has_role', { _user_id: userData.user.id, _role: 'admin' });
    if (!isAdmin) return json({ success: false, error: 'Acesso restrito a administradores' }, 403);

    const secret = Deno.env.get('BON_APPETIT_WEBHOOK_SECRET');
    if (!secret) {
      return json({
        success: false,
        error: 'BON_APPETIT_WEBHOOK_SECRET não configurado nos parâmetros do backend.',
        code: 'MISSING_SECRET',
      }, 400);
    }

    const url = new URL(req.url);
    const enviarTeste = url.searchParams.get('teste') !== 'false';

    // ===== Empresas ativas =====
    const { data: empresas, error: empErr } = await admin
      .from('empresas')
      .select('id, razao_social, nome_fantasia')
      .eq('ativo', true);
    if (empErr) throw empErr;

    // ===== Webhooks já existentes para a URL destino =====
    const { data: existentes, error: whErr } = await admin
      .from('webhooks')
      .select('id, empresa_id, ativo')
      .eq('url', BON_APPETIT_URL);
    if (whErr) throw whErr;

    const porEmpresa = new Map<string, { id: string; ativo: boolean }>();
    for (const w of existentes || []) porEmpresa.set(w.empresa_id, { id: w.id, ativo: w.ativo });

    let criados = 0;
    let reativados = 0;
    const webhookIds: string[] = [];

    for (const empresa of empresas || []) {
      const atual = porEmpresa.get(empresa.id);
      if (atual) {
        const { error } = await admin
          .from('webhooks')
          .update({
            nome: BON_APPETIT_NOME,
            ativo: true,
            falhas_consecutivas: 0,
            eventos: EVENTOS,
            secret,
            updated_at: new Date().toISOString(),
          })
          .eq('id', atual.id);
        if (error) throw error;
        reativados++;
        webhookIds.push(atual.id);
      } else {
        const { data, error } = await admin
          .from('webhooks')
          .insert({
            empresa_id: empresa.id,
            nome: BON_APPETIT_NOME,
            url: BON_APPETIT_URL,
            eventos: EVENTOS,
            secret,
            ativo: true,
            falhas_consecutivas: 0,
          })
          .select('id')
          .single();
        if (error) throw error;
        criados++;
        webhookIds.push(data.id);
      }
    }

    // ===== Teste de envio simulado (1 requisição) com log em webhook_logs =====
    let teste: Record<string, unknown> | null = null;
    if (enviarTeste && webhookIds.length > 0) {
      const webhookId = webhookIds[0];
      const payload = {
        evento: 'nfce.autorizada',
        teste: true,
        documento_id: '00000000-0000-0000-0000-000000000000',
        tipo_documento: 'nfce',
        dados: {
          numero: '000000000',
          serie: '1',
          status: 'autorizada',
          valor_total: 0,
          data_emissao: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      };
      const body = JSON.stringify(payload);
      const started = Date.now();
      let statusCode: number | null = null;
      let responseBody = '';
      let erro: string | null = null;

      try {
        const resp = await fetch(BON_APPETIT_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Signature': await hmacSha256(body, secret),
            'X-Webhook-Secret': secret,
            'X-Webhook-Event': 'nfce.autorizada',
            'X-Webhook-Test': 'true',
            'User-Agent': 'FiscalFlow-Webhook/1.0',
          },
          body,
        });
        statusCode = resp.status;
        responseBody = (await resp.text().catch(() => '')).substring(0, 1000);
      } catch (e) {
        erro = (e as Error).message;
      }

      const duracao = Date.now() - started;
      await admin.from('webhook_logs').insert({
        webhook_id: webhookId,
        evento: 'nfce.autorizada',
        payload,
        status_code: statusCode,
        response_body: responseBody,
        duracao_ms: duracao,
        sucesso: statusCode !== null && statusCode >= 200 && statusCode < 300,
        erro,
      });

      teste = { webhook_id: webhookId, status_code: statusCode, duracao_ms: duracao, erro };
    }

    return json({
      success: true,
      url: BON_APPETIT_URL,
      empresas_ativas: empresas?.length || 0,
      criados,
      reativados,
      total_configurados: criados + reativados,
      teste,
    });
  } catch (error) {
    console.error('sync-bonappetit-webhooks error:', error);
    return json({ success: false, error: (error as Error).message }, 500);
  }
});
