import { corsHeaders, processarFila } from '../_shared/fila-worker.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method === 'GET' && new URL(req.url).pathname.endsWith('/health')) {
    return new Response(JSON.stringify({ status: 'ok', service: 'process-cte-queue' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  return await processarFila({
    label: 'CT-e',
    tabela: 'cte',
    fila: 'fila_processamento_cte',
    fk: 'cte_id',
    action: 'emit_cte',
    idParam: 'cte_id',
    campoNumero: 'numero',
  });
});
