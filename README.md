# MerchPress Queue

Event press-queue PWA for merch stands. Cashiers enter custom T-shirt orders, the press station works a realtime queue, and admins manage events, designs, staff and stats. Built to be fast, calm and touch-first on tablets.

**Cloud-first.** There is no offline write queue. The app needs a working connection during the event.

## Stack
- React 19, TypeScript, Vite, PWA via `vite-plugin-pwa` (auto-updating service worker)
- Supabase (Postgres, Realtime, Storage) through `@supabase/supabase-js`; no custom server
- SQL RPCs and views for atomic operations and stats
- Hosted on Vercel; `vercel.json` adds the SPA rewrite

## Roles and login
Login is role, then name, then a 4-digit PIN checked by the `verify_pin` RPC. The name list comes from `staff_v` (active people only). The app remembers the last user ("Continue as"); the PIN is still required. A signed-in session is revalidated against `staff_v` every ~20 s: a deactivated person is signed out, a renamed or re-roled person is updated.

| Role | Does |
|---|---|
| Cashier | Creates orders (colour, size, front/back design, optional client name), sees own in-progress orders, cancels, gets a sound and overlay when own order is ready, marks it picked up |
| Press | Sees the FIFO queue, claims and marks orders ready, cancels, gets a sound on new orders |
| Admin | Tabs: Events, Designs, Staff, Stats |

PINs are a convenience, not strong security (public anon key, open RLS on events, designs, orders and Storage). See `docs/audit/06_SECURITY.md`.

### Admin tabs
- **Events**: create, edit (name, location, date, shirt colours, shirt sizes), activate. Exactly one event is active.
- **Designs**: add, edit, replace photos, hide or show, delete. Photos are resized on the client.
- **Staff**: add people, rename, change role, activate or deactivate, set PIN. Calls the `staff_*` RPCs, which verify the admin id and PIN. The admin PIN is held in memory only, so after a reload the tab asks for it again.
- **Stats**: KPIs, breakdowns, CSV export (cancelled orders included in the CSV).

## Setup
1. Create a Supabase project and apply the migrations in order (`supabase/migrations`):
   1. `0001_init.sql`: schema, RLS, RPCs, stats view
   2. `0002_storage.sql`: public `designs` bucket and policies
   3. `0003_enums.sql`: adds the `cancelled` order status; apply alone, before 0004
   4. `0004_ops.sql`: cancel, idempotent `create_order_v2`, `activate_event`, staff RPCs, per-event shirt options, `designs.is_active`, bucket limits, users RLS lockdown
2. Create the first admin directly in the database. No demo data is shipped.
3. Copy `.env.example` to `.env.local` and fill the env vars below. Set the same in Vercel.
4. `npm install && npm run dev`

Schema, RLS and RPC changes need explicit approval, a report with the SQL, and a backup before applying. There is one database and it is production.

## Environment variables
| Name | Notes |
|---|---|
| `VITE_SUPABASE_URL` | Project URL |
| `VITE_SUPABASE_ANON_KEY` | Public anon key |

Never give a secret a `VITE_` prefix and never put a service-role key in `src`.

## Validation before every commit
```
npx tsc -b            # npx tsc --noEmit is a no-op in this repo
npm run lint
npm run build
grep -c "Dev login" dist/assets/*.js        # must be 0
git --no-pager grep -n -i "service_role" -- src   # must be empty
git diff --stat
```

## Deploy
`main` auto-deploys to production on Vercel and the service worker auto-updates every open tablet. Work in a branch and merge only after review. **Never push `main` during an event.** Runbook: `docs/audit/08_TESTING_RUNBOOK.md`.

## Scripts
- `npm run dev`, `npm run build`, `npm run lint`
- `node scripts/gen-assets.mjs`: regenerate placeholder PWA icons and sounds
- `scripts/r1-livetest.mjs`, `r2-livetest.mjs`, `r2c-livetest.mjs`: live checks against the real database; each creates `ZZ-` test data and cleans up. Read the script header first.

## Docs
`CLAUDE.md` (rules and data model) and `docs/audit/` (reports, runbook, phase summary).
