import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { Client } from 'npm:ssh2@1.15.0';

interface Body {
  command?: string;
  commands?: string[];
  timeoutMs?: number;
}

function runSsh(host: string, user: string, password: string, command: string, timeoutMs = 60000): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      try { conn.end(); } catch (_) {}
      reject(new Error(`SSH timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    conn
      .on('ready', () => {
        conn.exec(command, (err, stream) => {
          if (err) { clearTimeout(timer); conn.end(); return reject(err); }
          stream
            .on('close', (code: number | null) => {
              clearTimeout(timer);
              conn.end();
              resolve({ stdout, stderr, code });
            })
            .on('data', (d: Buffer) => { stdout += d.toString('utf8'); })
            .stderr.on('data', (d: Buffer) => { stderr += d.toString('utf8'); });
        });
      })
      .on('error', (err) => { clearTimeout(timer); reject(err); })
      .connect({
        host,
        port: 22,
        username: user,
        password,
        readyTimeout: 20000,
        algorithms: {
          serverHostKey: ['ssh-rsa', 'ssh-ed25519', 'ecdsa-sha2-nistp256', 'ecdsa-sha2-nistp384', 'ecdsa-sha2-nistp521', 'rsa-sha2-256', 'rsa-sha2-512'],
        },
      });
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const host = Deno.env.get('API2_SSH_HOST');
    const user = Deno.env.get('API2_SSH_USER');
    const password = Deno.env.get('API2_SSH_PASSWORD');
    if (!host || !user || !password) {
      return new Response(JSON.stringify({ error: 'API2_SSH_* secrets ausentes' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body = (await req.json().catch(() => ({}))) as Body;
    const cmds = body.commands ?? (body.command ? [body.command] : []);
    if (!cmds.length) {
      return new Response(JSON.stringify({ error: 'forneça "command" ou "commands"' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const timeoutMs = Math.min(Math.max(body.timeoutMs ?? 60000, 1000), 300000);

    const results = [];
    for (const c of cmds) {
      try {
        const r = await runSsh(host, user, password, c, timeoutMs);
        results.push({ command: c, ...r });
      } catch (e) {
        results.push({ command: c, error: (e as Error).message });
      }
    }

    return new Response(JSON.stringify({ host, results }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
