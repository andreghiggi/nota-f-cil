import { corsHeaders, processarFila } from '../_shared/fila-worker.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method === 'GET' && new URL(req.url).pathname.endsWith('/health')) {
    return new Response(JSON.stringify({ status: 'ok', service: 'process-nfse-queue' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  return await processarFila({
    label: 'NFS-e',
    tabela: 'nfse',
    fila: 'fila_processamento_nfse',
    fk: 'nfse_id',
    action: 'emit_nfse',
    idParam: 'nfse_id',
    campoNumero: 'numero_dps',
  });
});
