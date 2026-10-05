# MerchPress

## Role
Event press-queue PWA: fast, calm, touch-first. Cashiers enter orders, the press station works a realtime queue, admins manage events and designs.

## Hard rules
- No schema, RLS or RPC change without explicit approval and the two-round pattern: (1) SQL in a report, (2) human approval, backup, then apply.
- No auth change unless asked.
- No secret ever gets a `VITE_` prefix, and no service-role key in `src`.
- No heavy dependency without flagging it first.
- All UI strings in English.
- Preserve queue semantics: FIFO by `created_at`, forward-only statuses, per-event order numbers, alert dedupe, advisory compatible colors.
- There is ONE database and it is production.
- `main` auto-deploys to production and the service worker auto-updates. Never push `main` during an event.

## Validation before every commit
```
npx tsc -b            # npx tsc --noEmit is a no-op in this repo
npm run lint
npm run build
grep -c "Dev login" dist/assets/*.js        # must be 0
git --no-pager grep -n -i "service_role" -- src   # must be empty
git diff --stat
```

## Branches
`main` is the deploy branch. Work in a branch. Merge only after human review.

## Notes
Project notes are reconstructed. If they differ from the repo, trust the repo.

## Current data model
Generated from `supabase/migrations`.

### Enums ([0001_init.sql:5-8](supabase/migrations/0001_init.sql#L5-L8))
- `user_role`: cashier, press, admin
- `shirt_size`: XS, S, M, L, XL, XXL
- `design_type`: big, small
- `order_status`: new, in_progress, ready, completed

### Tables
- `events` ([0001_init.sql:11-18](supabase/migrations/0001_init.sql#L11-L18)); unique partial index allows one active event ([:20](supabase/migrations/0001_init.sql#L20))
- `users` ([0001_init.sql:22-28](supabase/migrations/0001_init.sql#L22-L28)); `pin` nullable text
- `designs` ([0001_init.sql:30-40](supabase/migrations/0001_init.sql#L30-L40)); `compatible_colors text[]`, cascade on event delete
- `orders` ([0001_init.sql:42-63](supabase/migrations/0001_init.sql#L42-L63)); `unique (event_id, event_order_no)`, queue index on `(event_id, status, created_at)`

### RPCs (all `security definer`, `search_path = public`)
- `create_order` ([0001_init.sql:68-104](supabase/migrations/0001_init.sql#L68-L104)): assigns next per-event number, retries up to 25 times on unique violation
- `set_order_status` ([0001_init.sql:108-139](supabase/migrations/0001_init.sql#L108-L139)): forward-only, stamps timestamps, sets `claimed_by` on in_progress, no-op if already at or past target
- `verify_pin` ([0001_init.sql:142-151](supabase/migrations/0001_init.sql#L142-L151)): returns the user row or null

### Views
- `order_stats_v` ([0001_init.sql:155-169](supabase/migrations/0001_init.sql#L155-L169)): `security_invoker = true`, granted to anon and authenticated
- `staff_v` ([0001_init.sql:189-191](supabase/migrations/0001_init.sql#L189-L191)): PIN-free staff list, `security_invoker = false`

### RLS policies
- RLS enabled on events, users, designs, orders ([0001_init.sql:174-177](supabase/migrations/0001_init.sql#L174-L177))
- `events_all`, `designs_all`, `orders_all`: open for all ([0001_init.sql:179-181](supabase/migrations/0001_init.sql#L179-L181))
- `users`: insert/update/delete open, no select policy ([0001_init.sql:184-186](supabase/migrations/0001_init.sql#L184-L186))

### Storage ([0002_storage.sql](supabase/migrations/0002_storage.sql))
- Public bucket `designs` ([:3-5](supabase/migrations/0002_storage.sql#L3-L5)); open select/insert/update/delete policies ([:7-10](supabase/migrations/0002_storage.sql#L7-L10))

### Realtime
- `orders` is in the `supabase_realtime` publication with `replica identity full` ([0001_init.sql:194-195](supabase/migrations/0001_init.sql#L194-L195))
