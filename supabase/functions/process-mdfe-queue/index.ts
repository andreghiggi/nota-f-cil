import { corsHeaders, processarFila } from '../_shared/fila-worker.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method === 'GET' && new URL(req.url).pathname.endsWith('/health')) {
    return new Response(JSON.stringify({ status: 'ok', service: 'process-mdfe-queue' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  return await processarFila({
    label: 'MDF-e',
    tabela: 'mdfe',
    fila: 'fila_processamento_mdfe',
    fk: 'mdfe_id',
    action: 'emit_mdfe',
    idParam: 'mdfe_id',
    campoNumero: 'numero',
  });
});
