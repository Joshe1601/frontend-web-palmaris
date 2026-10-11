# Grupo Palmaris · Panel de administración (`/admin`)

Next.js (App Router) + Supabase (Postgres, Auth, Realtime) + Tailwind + Leaflet.

## Puesta en marcha

1. `cp .env.example .env.local` y completa `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` y
   `SUPABASE_SERVICE_ROLE_KEY` (esta última solo se usa en `app/api/choferes`, nunca llega al navegador).
2. Aplica la migración `supabase/migrations/20261009000000_init_schema.sql` (con `supabase link` + `supabase db push`,
   o pegándola una sola vez en el SQL Editor).
3. Crea el primer admin (ver sección 9 de la migración) y completa las coordenadas del almacén en **/admin/configuracion**.
4. `npm run dev` → http://localhost:3000/admin

## Esquema y tipos

- La migración inicial **no se edita**: cualquier cambio va en una migración nueva (`supabase migration new <nombre>`).
- `npm run types` regenera `types/database.ts` (requiere `supabase link`); `npm run types:local` usa la BD local (Docker).

## Scripts

`npm run typecheck` · `npm test` · `npm run lint` · `npm run build`
