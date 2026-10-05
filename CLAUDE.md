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
Generated from `supabase/migrations` (0001-0004).

### Enums ([0001_init.sql:5-8](supabase/migrations/0001_init.sql#L5-L8))
- `user_role`: cashier, press, admin
- `shirt_size`: XS, S, M, L, XL, XXL
- `design_type`: big, small
- `order_status`: new, in_progress, ready, completed, cancelled (added in [0003_enums.sql](supabase/migrations/0003_enums.sql))

### Tables
- `events` ([0001_init.sql:11-18](supabase/migrations/0001_init.sql#L11-L18)); unique partial index allows one active event ([:20](supabase/migrations/0001_init.sql#L20)); 0004 adds `shirt_colors jsonb` (array of `{ key, label, hex }`) and `shirt_sizes text[]` (subset of XS-XXL); null or empty = app defaults from `config.ts`, resolved by `src/lib/eventOptions.ts`
- `users` ([0001_init.sql:22-28](supabase/migrations/0001_init.sql#L22-L28)); `pin` nullable text; RLS enabled with no policies since 0004, so anon cannot select, insert, update or delete it
- `designs` ([0001_init.sql:30-40](supabase/migrations/0001_init.sql#L30-L40)); `compatible_colors text[]`, cascade on event delete; 0004 adds `is_active boolean not null default true` (Hide / Show in Admin Designs; cashier pickers list active designs only; orders still resolve hidden ones). Deleting a design that orders use fails with 23503
- `orders` ([0001_init.sql:42-63](supabase/migrations/0001_init.sql#L42-L63)); `unique (event_id, event_order_no)`, queue index on `(event_id, status, created_at)`; 0004 adds `cancelled_at`, `cancelled_by` (fk users) and `client_request_id uuid` with a unique partial index

### RPCs (all `security definer`, `search_path = public`)
- `create_order` ([0001_init.sql:68-104](supabase/migrations/0001_init.sql#L68-L104)): assigns next per-event number, retries up to 25 times on unique violation
- `set_order_status` (redefined in [0004_ops.sql](supabase/migrations/0004_ops.sql), original [0001_init.sql:108-139](supabase/migrations/0001_init.sql#L108-L139)): forward-only, stamps timestamps, sets `claimed_by` on in_progress, no-op if already at or past target. `cancelled` is allowed from new, in_progress and ready and stamps `cancelled_at`/`cancelled_by`; completed and cancelled are terminal (the row is returned unchanged)
- `create_order_v2` (0004): `create_order` plus a required `p_client_request_id`; the same id returns the same order. The client uses it; `create_order` stays for old bundles
- `activate_event(p_event_id)` (0004): deactivates the others and activates one, under an advisory lock
- `staff_list`, `staff_create`, `staff_update`, `staff_set_pin` (0004): take `p_admin_id` + `p_admin_pin`, verified by `_assert_admin` (execute revoked from anon). They raise `not_admin`, `weak_admin_pin`, `last_admin`, `invalid_pin`, `invalid_name`, `invalid_role`, `user_not_found`. `staff_list` never returns the PIN
- `verify_pin` ([0001_init.sql:142-151](supabase/migrations/0001_init.sql#L142-L151)): returns the user row or null

### Views
- `order_stats_v` ([0001_init.sql:155-169](supabase/migrations/0001_init.sql#L155-L169), replaced in 0004): `security_invoker = true`, granted to anon and authenticated; adds `count_cancelled`. `total_orders` still includes cancelled orders, so the client subtracts `count_cancelled`; the averages exclude them
- `staff_v` ([0001_init.sql:189-191](supabase/migrations/0001_init.sql#L189-L191)): PIN-free staff list, `security_invoker = false`

### RLS policies
- RLS enabled on events, users, designs, orders ([0001_init.sql:174-177](supabase/migrations/0001_init.sql#L174-L177))
- `events_all`, `designs_all`, `orders_all`: open for all ([0001_init.sql:179-181](supabase/migrations/0001_init.sql#L179-L181))
- `users`: no policies. 0004 dropped the open insert/update/delete ones that [0001_init.sql:184-186](supabase/migrations/0001_init.sql#L184-L186) created; staff changes go through the `staff_*` RPCs

### Storage ([0002_storage.sql](supabase/migrations/0002_storage.sql))
- Public bucket `designs` ([:3-5](supabase/migrations/0002_storage.sql#L3-L5)); open select/insert/update/delete policies ([:7-10](supabase/migrations/0002_storage.sql#L7-L10)); 0004 limits uploads to 5 MB and jpeg/png/webp

### Realtime
- `orders` is in the `supabase_realtime` publication with `replica identity full` ([0001_init.sql:194-195](supabase/migrations/0001_init.sql#L194-L195))
