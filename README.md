# MerchPress Queue

Real-time event merch order queue. Cashiers create custom T-shirt print orders;
the press station sees them live, prints, and marks ready; cashiers get an
audible/visual "ready" alert and close the order. Admin manages per-event design
catalogs and views/export stats.

**Cloud-first**: React PWA (Vite) + Supabase (Postgres + Realtime + Storage),
deployed on Vercel. Depends on stable internet during the event.

## Stack
- React 19 + TypeScript + Vite, PWA via `vite-plugin-pwa`
- Supabase JS client (no custom server); SQL RPCs/views for atomicity + stats
- Realtime via `postgres_changes`

## Setup

1. **Provision Supabase**: create a project, then apply the SQL in order:
   - `supabase/migrations/0001_init.sql` (schema, RLS, RPCs, stats view)
   - `supabase/migrations/0002_storage.sql` (designs Storage bucket + policies)
   - Optionally `supabase/seed.sql` (demo staff/event/designs).
2. **Env**: copy `.env.example` to `.env.local` and fill `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_ANON_KEY` (Supabase → Project Settings → API). Set the same in Vercel.
3. **Run**: `npm install && npm run dev`.

## Roles & auth
Pick role → name → 4-digit PIN. PIN is **MVP-only, not strong security**
(public anon key + permissive RLS). Demo PINs are in `seed.sql`.

## Data model highlights
- Multi-event: every order/design has a required `event_id`. Exactly one active event.
- `orders.event_order_no` is the human number, **restarts at 1 per event**,
  unique per event, assigned atomically by the `create_order` RPC.
- Designs are **event-specific**.

## Realtime discipline
Initial state always loaded by query; Realtime only keeps it in sync; reconnect
refetches. A `sessionStorage` "seen" set prevents duplicate sound/vibration on
refresh/reconnect. Press alerts on new orders; cashiers alert only for their own
orders becoming ready (but see all ready orders).

## Scripts
- `npm run dev` / `npm run build` / `npm run lint`
- `node scripts/gen-assets.mjs` — regenerate placeholder PWA icons + notification sounds
  (replace `public/icons/*` and `public/sounds/*` with real assets for production).

## Deploy (Vercel)
Framework preset: Vite. `vercel.json` adds SPA rewrites. Set the two env vars.
