import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WebhookPayload {
  evento: string;
  nfce_id: string;
  empresa_id: string;
  dados: {
    numero: string;
    serie: string;
    chave_acesso?: string;
    status: string;
    protocolo?: string;
    valor_total: number;
    codigo_retorno?: string;
    motivo_retorno?: string;
    data_emissao: string;
    data_autorizacao?: string;
    qrcode_url?: string;
    external_id?: string;
  };
  timestamp: string;
}

// Generate HMAC-SHA256 signature
async function generateSignature(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Send webhook with retry logic
async function sendWebhook(
  webhook: { id: string; url: string; secret: string; nome: string },
  payload: WebhookPayload,
  supabase: any
): Promise<{ success: boolean; statusCode?: number; error?: string; durationMs: number }> {
  const startTime = Date.now();
  const payloadString = JSON.stringify(payload);
  
  try {
    const signature = await generateSignature(payloadString, webhook.secret);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    
    console.log(`📤 Sending webhook to ${webhook.nome}: ${webhook.url}`);
    
    const response = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-Timestamp': timestamp,
        'X-Webhook-Event': payload.evento,
        'User-Agent': 'NFCe-SaaS-Webhook/1.0',
      },
      body: payloadString,
    });
    
    const durationMs = Date.now() - startTime;
    const responseBody = await response.text().catch(() => '');
    
    // Log the webhook delivery
    await supabase.from('webhook_logs').insert({
      webhook_id: webhook.id,
      nfce_id: payload.nfce_id,
      evento: payload.evento,
      payload: payload,
      status_code: response.status,
      response_body: responseBody.substring(0, 1000), // Limit response body
      duracao_ms: durationMs,
      sucesso: response.ok,
      erro: response.ok ? null : `HTTP ${response.status}: ${response.statusText}`,
    });
    
    // Update webhook status
    if (response.ok) {
      await supabase
        .from('webhooks')
        .update({
          ultimo_envio: new Date().toISOString(),
          ultimo_status: response.status,
          falhas_consecutivas: 0,
        })
        .eq('id', webhook.id);
      
      console.log(`✅ Webhook ${webhook.nome} delivered successfully (${durationMs}ms)`);
    } else {
      const { data: currentWebhook } = await supabase
        .from('webhooks')
        .select('falhas_consecutivas')
        .eq('id', webhook.id)
        .single();
      
      const novasFalhas = (currentWebhook?.falhas_consecutivas || 0) + 1;
      
      await supabase
        .from('webhooks')
        .update({
          ultimo_envio: new Date().toISOString(),
          ultimo_status: response.status,
          falhas_consecutivas: novasFalhas,
          // Disable webhook after 10 consecutive failures
          ativo: novasFalhas < 10,
        })
        .eq('id', webhook.id);
      
      console.log(`❌ Webhook ${webhook.nome} failed with status ${response.status}`);
    }
    
    return {
      success: response.ok,
      statusCode: response.status,
      durationMs,
    };
  } catch (error: any) {
    const durationMs = Date.now() - startTime;
    
    console.error(`❌ Webhook ${webhook.nome} error:`, error.message);
    
    // Log the error
    await supabase.from('webhook_logs').insert({
      webhook_id: webhook.id,
      nfce_id: payload.nfce_id,
      evento: payload.evento,
      payload: payload,
      duracao_ms: durationMs,
      sucesso: false,
      erro: error.message,
    });
    
    // Update failure count
    const { data: currentWebhook } = await supabase
      .from('webhooks')
      .select('falhas_consecutivas')
      .eq('id', webhook.id)
      .maybeSingle();
    
    const novasFalhas = (currentWebhook?.falhas_consecutivas || 0) + 1;
    
    await supabase
      .from('webhooks')
      .update({
        ultimo_envio: new Date().toISOString(),
        falhas_consecutivas: novasFalhas,
        ativo: novasFalhas < 10,
      })
      .eq('id', webhook.id);
    
    return {
      success: false,
      error: error.message,
      durationMs,
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { nfce_id, evento } = await req.json();

    if (!nfce_id || !evento) {
      return new Response(
        JSON.stringify({ error: 'nfce_id and evento are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`🔔 Processing webhook event: ${evento} for NFC-e: ${nfce_id}`);

    // Get NFC-e data
    const { data: nfce, error: nfceError } = await supabase
      .from('nfce')
      .select('*')
      .eq('id', nfce_id)
      .maybeSingle();

    if (nfceError || !nfce) {
      console.error('NFC-e not found:', nfce_id);
      return new Response(
        JSON.stringify({ error: 'NFC-e not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get active webhooks for this empresa that subscribe to this event
    const { data: webhooks, error: webhooksError } = await supabase
      .from('webhooks')
      .select('id, url, secret, nome')
      .eq('empresa_id', nfce.empresa_id)
      .eq('ativo', true)
      .contains('eventos', [evento]);

    if (webhooksError) {
      console.error('Error fetching webhooks:', webhooksError);
      throw webhooksError;
    }

    if (!webhooks || webhooks.length === 0) {
      console.log(`No active webhooks found for event ${evento}`);
      return new Response(
        JSON.stringify({ success: true, message: 'No webhooks configured', delivered: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${webhooks.length} webhook(s) to notify`);

    // Build payload
    const payload: WebhookPayload = {
      evento,
      nfce_id: nfce.id,
      empresa_id: nfce.empresa_id,
      dados: {
        numero: nfce.numero,
        serie: nfce.serie,
        chave_acesso: nfce.chave_acesso,
        status: nfce.status,
        protocolo: nfce.protocolo,
        valor_total: nfce.valor_total,
        codigo_retorno: nfce.codigo_retorno,
        motivo_retorno: nfce.motivo_retorno,
        data_emissao: nfce.data_emissao,
        data_autorizacao: nfce.data_autorizacao,
        qrcode_url: nfce.qrcode_url,
        external_id: nfce.external_id,
      },
      timestamp: new Date().toISOString(),
    };

    // Send to all webhooks in parallel
    const results = await Promise.all(
      webhooks.map(webhook => sendWebhook(webhook, payload, supabase))
    );

    const delivered = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log(`📊 Webhook delivery complete: ${delivered} delivered, ${failed} failed`);

    // Log the webhook dispatch
    await supabase.rpc('registrar_log', {
      p_empresa_id: nfce.empresa_id,
      p_nfce_id: nfce.id,
      p_token_api_id: null,
      p_tipo: failed > 0 ? 'warning' : 'info',
      p_categoria: 'webhook',
      p_mensagem: `Webhooks enviados: ${delivered} sucesso, ${failed} falha`,
      p_detalhes: { evento, results },
    });

    return new Response(
      JSON.stringify({
        success: true,
        delivered,
        failed,
        total: webhooks.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Webhook dispatcher error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
