# AGENTS.md

- The production web panel (emit.agilizeerp.com.br) is a static build served by Caddy from `/opt/apps/agilize-apis/www` on the VPS; frontend changes only reach users after building with the VPS `.env.production.local` (unset shell `VITE_SUPABASE_*` first, they override it) and copying `dist/` there with a backup in `backups/`. Why: Lovable Cloud is paused, so Lovable publish does not update the real panel.
