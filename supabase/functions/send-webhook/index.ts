import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WebhookPayload {
  evento: string;
  documento_id: string;
  tipo_documento: 'nfce' | 'nfe';
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
    natureza_operacao?: string;
    dest_nome?: string;
    dest_cpf_cnpj?: string;
  };
  timestamp: string;
}

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
        'User-Agent': 'FiscalFlow-Webhook/1.0',
      },
      body: payloadString,
    });

    const durationMs = Date.now() - startTime;
    const responseBody = await response.text().catch(() => '');

    await supabase.from('webhook_logs').insert({
      webhook_id: webhook.id,
      nfce_id: payload.documento_id,
      evento: payload.evento,
      payload: payload,
      status_code: response.status,
      response_body: responseBody.substring(0, 1000),
      duracao_ms: durationMs,
      sucesso: response.ok,
      erro: response.ok ? null : `HTTP ${response.status}: ${response.statusText}`,
    });

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
          ativo: novasFalhas < 10,
        })
        .eq('id', webhook.id);

      console.log(`❌ Webhook ${webhook.nome} failed with status ${response.status}`);
    }

    return { success: response.ok, statusCode: response.status, durationMs };
  } catch (error: any) {
    const durationMs = Date.now() - startTime;
    console.error(`❌ Webhook ${webhook.nome} error:`, error.message);

    await supabase.from('webhook_logs').insert({
      webhook_id: webhook.id,
      nfce_id: payload.documento_id,
      evento: payload.evento,
      payload: payload,
      duracao_ms: durationMs,
      sucesso: false,
      erro: error.message,
    });

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

    return { success: false, error: error.message, durationMs };
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
    const body = await req.json();
    const { nfce_id, nfe_id, evento } = body;

    const documentoId = nfce_id || nfe_id;
    const isNFe = !!nfe_id && !nfce_id;

    if (!documentoId || !evento) {
      return new Response(
        JSON.stringify({ error: 'nfce_id or nfe_id and evento are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`🔔 Processing webhook event: ${evento} for ${isNFe ? 'NF-e' : 'NFC-e'}: ${documentoId}`);

    let documento: any;
    let empresaId: string;

    if (isNFe) {
      const { data, error } = await supabase
        .from('nfe')
        .select('*')
        .eq('id', documentoId)
        .maybeSingle();

      if (error || !data) {
        return new Response(
          JSON.stringify({ error: 'NF-e not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      documento = data;
      empresaId = data.empresa_id;
    } else {
      const { data, error } = await supabase
        .from('nfce')
        .select('*')
        .eq('id', documentoId)
        .maybeSingle();

      if (error || !data) {
        return new Response(
          JSON.stringify({ error: 'NFC-e not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      documento = data;
      empresaId = data.empresa_id;
    }

    // Get active webhooks for this empresa that subscribe to this event
    const { data: webhooks, error: webhooksError } = await supabase
      .from('webhooks')
      .select('id, url, secret, nome')
      .eq('empresa_id', empresaId)
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
      documento_id: documentoId,
      tipo_documento: isNFe ? 'nfe' : 'nfce',
      empresa_id: empresaId,
      dados: {
        numero: documento.numero,
        serie: documento.serie,
        chave_acesso: documento.chave_acesso,
        status: documento.status,
        protocolo: documento.protocolo,
        valor_total: documento.valor_total,
        codigo_retorno: documento.codigo_retorno,
        motivo_retorno: documento.motivo_retorno,
        data_emissao: documento.data_emissao,
        data_autorizacao: documento.data_autorizacao,
        ...(isNFe ? {
          natureza_operacao: documento.natureza_operacao,
          dest_nome: documento.dest_nome,
          dest_cpf_cnpj: documento.dest_cpf_cnpj,
        } : {
          qrcode_url: documento.qrcode_url,
        }),
        external_id: documento.external_id,
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

    await supabase.rpc('registrar_log', {
      p_empresa_id: empresaId,
      p_nfce_id: documentoId,
      p_token_api_id: null,
      p_tipo: failed > 0 ? 'warning' : 'info',
      p_categoria: 'webhook',
      p_mensagem: `Webhooks ${isNFe ? 'NF-e' : 'NFC-e'} enviados: ${delivered} sucesso, ${failed} falha`,
      p_detalhes: { evento, tipo_documento: isNFe ? 'nfe' : 'nfce', results },
    });

    return new Response(
      JSON.stringify({ success: true, delivered, failed, total: webhooks.length }),
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
