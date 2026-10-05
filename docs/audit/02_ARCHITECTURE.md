# Architecture

## Stack
React 19, TypeScript, Vite, `vite-plugin-pwa`, `@supabase/supabase-js`. No custom server. One Supabase project (Postgres, Realtime, Storage), which is production. Vercel hosts the static build.

## Frontend structure
- `src/App.tsx`: routes on the session role: `RoleSelect`, `CashierPage`, `PressPage`, `AdminPage`.
- `src/context/SessionContext.tsx`: stored user (`localStorage` key `mpq.session`), active event, silent refresh (20 s, tab visible, online) and `staff_v` revalidation.
- `src/pages`: Cashier, Press, Admin (Events, Designs, Staff, Stats).
- `src/hooks`: `useOrders` (queue), `useEvents`, `useDesigns`, `useCancelOrder`, `useWakeLock`.
- `src/lib`: RPC wrappers with abort timeouts (`orderStatus.ts` 10 s, `createOrder.ts` 12 s), `mergeOrders`, `eventOptions` (per-event colours and sizes, falling back to `config.ts`), `imageUpload` (client resize), `adminPin` (memory only), `notify` (audio), `staffApi`, `csv`, `wait`.
- `src/components`: pickers, `OrderCard`, `SoundGate`, `ConfirmDialog`, `EventEditor`, `PinPad`, UI primitives.

## Data flow and realtime
Initial state is always a query (only new, in_progress and ready orders). Realtime `postgres_changes` on `orders` keeps it in sync. A refetch runs on resubscribe, tab visible, `online` and every 20 s while visible; `mergeOrders` overlays realtime events received since the request started. `connected` is true only if subscribed, online and the last query succeeded; otherwise a banner shows.

Alerts: a `sessionStorage` "seen" set per event (and cashier) dedupes sound and overlay across reloads and refetches. Press alerts on new orders; a cashier alerts only for their own orders turning ready. Audio needs a tap: `SoundGate` shows "Tap to enable sound" and never traps the user ("Sound off · tap to retry" in the top bar).

Writes: `create_order_v2` takes a client request id (one UUID per draft, reused on retry) so a retry returns the same order; the client compares the returned order with the draft and refuses a false success. `set_order_status` is forward-only and a no-op at or past the target. `cancelled` is allowed from new, in_progress and ready. Order numbers are per event, unique, assigned by the RPC. Queue order is FIFO by `created_at`.

Data model, RPCs, views and RLS: see `CLAUDE.md` (generated from the migrations).

## PWA and deploy
`registerType: 'autoUpdate'`, manifest orientation `any`, standalone display. `main` auto-deploys on Vercel and open tablets pick up the new service worker, so a bad merge reaches every tablet. The dev quick-login is gated by `import.meta.env.DEV` and must not appear in the build (`grep -c "Dev login" dist/assets/*.js` is 0).
