# R2A Report: migration round 1 of 2 (SQL only)

Branch `gdansk-sprint`. Nothing applied, no SQL run against any database (not even a local one), `src/` untouched, `0001`/`0002`/`seed.sql` untouched, not pushed, not merged. The SQL is **unexecuted and unverified**; round 2 starts with backup and apply.

Files:
- `supabase/migrations/0003_enums.sql`, apply alone first.
- `supabase/migrations/0004_ops.sql`, apply second, in one transaction (it has its own `begin`/`commit`).
- `supabase/rollback/0004_ops_rollback.sql`, never run unless asked.

## 1. Recon: src call sites that depend on the touched objects

| Object | Call site | What it does |
|---|---|---|
| `set_order_status` | src/lib/orderStatus.ts:19 | Only RPC call. Used by src/pages/PressPage.tsx:63 (claim/ready) and src/pages/CashierPage.tsx:91 (completed) |
| `create_order` | src/pages/CashierPage.tsx:170 | Only call; not idempotent, no retry guard |
| `order_stats_v` | src/pages/StatsPage.tsx:45 | Reads view; type `OrderStats` at src/types/db.ts:57-67 |
| `orders` (table) | src/hooks/useOrders.ts:51, src/pages/StatsPage.tsx:39 | Queue list and export; both read `status` |
| `events` | src/context/SessionContext.tsx:51 (active event), src/hooks/useEvents.ts:12 (list), :25 (insert), :38-39 (activate: two updates) | Type `EventRow` at src/types/db.ts:9-16 |
| `designs` | src/hooks/useDesigns.ts:18 (list), src/pages/AdminDesignsPage.tsx:55 (insert), :78 (delete) | Type `Design` at src/types/db.ts:25-34 |
| `users` | none direct | No `from('users')` anywhere, so dropping the write policies breaks no current code |
| `staff_v` | src/components/RoleSelect.tsx:36 | Login picker, unchanged by this round |
| `verify_pin` | src/components/RoleSelect.tsx:51 | Unchanged |
| storage `designs` | src/pages/AdminDesignsPage.tsx:15 (upload), src/lib/supabase.ts:19 (public URL) | Affected by the new bucket limits |

Status-dependent UI that a new `cancelled` value reaches: src/types/db.ts:7, src/lib/colors.ts:5 (`STATUS_COLORS` has no `cancelled` key), src/components/StatusBadge.tsx:5 (`c.bg` on undefined would throw), src/components/OrderCard.tsx:103 (wait timer shows unless `completed`), src/pages/PressPage.tsx:54, src/pages/CashierPage.tsx:49 and :76.

## 2. SQL

### supabase/migrations/0003_enums.sql

```sql
-- MerchPress Queue — enum additions (round 2A, step 1 of 2)
-- Apply this file ON ITS OWN, before 0004_ops.sql: a new enum value cannot be
-- used in the same transaction that adds it.
-- Additive and re-runnable.

alter type order_status add value if not exists 'cancelled';
```

### supabase/migrations/0004_ops.sql

```sql
-- MerchPress Queue — ops hardening (round 2A, step 2 of 2)
-- Requires 0003_enums.sql to be applied (and committed) first.
-- Re-runnable: columns/indexes use IF NOT EXISTS, functions use CREATE OR REPLACE,
-- policy drops use IF EXISTS.

begin;

-- ---------- A. orders: cancellation + idempotency columns ----------
alter table orders add column if not exists cancelled_at       timestamptz;
alter table orders add column if not exists cancelled_by       uuid references users(id);
alter table orders add column if not exists client_request_id  uuid;

create unique index if not exists orders_client_request_id_idx
  on orders (client_request_id) where client_request_id is not null;

-- ---------- B. set_order_status: add cancel, make completed/cancelled terminal ----------
-- Same name, signature and return type as 0001.
create or replace function set_order_status(
  p_order_id uuid,
  p_status   order_status,
  p_user_id  uuid
) returns orders
language plpgsql security definer set search_path = public as $$
declare
  v_order orders;
  v_rank  jsonb := '{"new":0,"in_progress":1,"ready":2,"completed":3}';
begin
  select * into v_order from orders where id = p_order_id for update;
  if not found then
    raise exception 'order % not found', p_order_id;
  end if;

  -- Terminal states: nothing moves out of completed or cancelled.
  if v_order.status in ('completed', 'cancelled') then
    return v_order;
  end if;

  -- Cancel: allowed from new, in_progress and ready (terminal states returned above).
  if p_status = 'cancelled' then
    update orders set
      status       = 'cancelled',
      cancelled_at = now(),
      cancelled_by = p_user_id
    where id = p_order_id
    returning * into v_order;
    return v_order;
  end if;

  -- Guard: only move forward.
  if (v_rank ->> v_order.status::text)::int >= (v_rank ->> p_status::text)::int then
    return v_order;  -- already at/past target: no-op
  end if;

  update orders set
    status         = p_status,
    claimed_by     = case when p_status = 'in_progress' then p_user_id else claimed_by end,
    in_progress_at = case when p_status = 'in_progress' then now() else in_progress_at end,
    ready_at       = case when p_status = 'ready'       then now() else ready_at end,
    completed_at   = case when p_status = 'completed'   then now() else completed_at end
  where id = p_order_id
  returning * into v_order;

  return v_order;
end;
$$;

-- ---------- C. create_order_v2: idempotent create ----------
-- create_order (0001) stays untouched so tablets on a cached old bundle keep working.
create or replace function create_order_v2(
  p_event_id          uuid,
  p_shirt_color       text,
  p_shirt_size        shirt_size,
  p_design_front_id   uuid,
  p_design_back_id    uuid,
  p_client_name       text,
  p_created_by        uuid,
  p_cashier_key       text,
  p_cashier_name      text,
  p_client_request_id uuid
) returns orders
language plpgsql security definer set search_path = public as $$
declare
  v_order orders;
  v_no    int;
begin
  if p_client_request_id is null then
    raise exception 'create_order_v2: p_client_request_id is required';
  end if;

  -- Replay of an earlier request: return what that request created.
  select * into v_order from orders where client_request_id = p_client_request_id;
  if found then
    return v_order;
  end if;

  for i in 1..25 loop
    select coalesce(max(event_order_no), 0) + 1 into v_no
      from orders where event_id = p_event_id;
    begin
      insert into orders (
        event_id, event_order_no, shirt_color, shirt_size,
        design_front_id, design_back_id, client_name,
        created_by, cashier_key, cashier_name, client_request_id
      ) values (
        p_event_id, v_no, p_shirt_color, p_shirt_size,
        p_design_front_id, p_design_back_id, nullif(p_client_name, ''),
        p_created_by, p_cashier_key, p_cashier_name, p_client_request_id
      ) returning * into v_order;
      return v_order;
    exception when unique_violation then
      -- Either a concurrent call with the same request id won, or another insert
      -- grabbed v_no. Check the request id first, otherwise retry with a fresh number.
      select * into v_order from orders where client_request_id = p_client_request_id;
      if found then
        return v_order;
      end if;
    end;
  end loop;
  raise exception 'create_order_v2: could not assign event_order_no after retries';
end;
$$;

-- ---------- D. activate_event ----------
-- Two statements on purpose: the partial unique index is checked per row, so a
-- single swap statement can fail.
create or replace function activate_event(p_event_id uuid)
returns events
language plpgsql security definer set search_path = public as $$
declare
  v_event events;
begin
  -- Serialise concurrent activations.
  perform pg_advisory_xact_lock(hashtext('merchpress.activate_event'));

  if not exists (select 1 from events where id = p_event_id) then
    raise exception 'event % not found', p_event_id;
  end if;

  update events set is_active = false where is_active and id <> p_event_id;
  update events set is_active = true  where id = p_event_id
    returning * into v_event;

  return v_event;
end;
$$;

-- ---------- E. Staff management (admin id + PIN verified server-side) ----------
create or replace function _assert_admin(p_admin_id uuid, p_admin_pin text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from users u
    where u.id = p_admin_id
      and u.role = 'admin'
      and u.is_active
      and u.pin = p_admin_pin
  ) then
    raise exception 'not_admin';
  end if;
end;
$$;
revoke execute on function _assert_admin(uuid, text) from public, anon, authenticated;

-- All users including inactive; never the pin.
create or replace function staff_list(p_admin_id uuid, p_admin_pin text)
returns table (id uuid, name text, role user_role, is_active boolean)
language plpgsql security definer set search_path = public as $$
begin
  perform _assert_admin(p_admin_id, p_admin_pin);
  return query
    select u.id, u.name, u.role, u.is_active
    from users u
    order by u.is_active desc, u.name, u.id;
end;
$$;

create or replace function staff_create(
  p_admin_id  uuid,
  p_admin_pin text,
  p_name      text,
  p_role      user_role,
  p_pin       text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_name text := btrim(p_name);
  v_id   uuid;
begin
  perform _assert_admin(p_admin_id, p_admin_pin);

  if v_name is null or v_name = '' then
    raise exception 'invalid_name';
  end if;
  if p_role is null then
    raise exception 'invalid_role';
  end if;
  if p_pin is null or p_pin !~ '^[0-9]{4}$' then
    raise exception 'invalid_pin';
  end if;
  if p_role = 'admin' and p_pin = '0000' then
    raise exception 'weak_admin_pin';
  end if;

  insert into users (name, role, pin, is_active)
  values (v_name, p_role, p_pin, true)
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function staff_update(
  p_admin_id  uuid,
  p_admin_pin text,
  p_user_id   uuid,
  p_name      text,
  p_role      user_role,
  p_is_active boolean
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_name   text := btrim(p_name);
  v_target users;
begin
  perform _assert_admin(p_admin_id, p_admin_pin);

  if v_name is null or v_name = '' then
    raise exception 'invalid_name';
  end if;
  if p_role is null then
    raise exception 'invalid_role';
  end if;
  if p_is_active is null then
    raise exception 'invalid_active';
  end if;

  -- Lock all active admins so two concurrent updates cannot both pass the
  -- last-admin check.
  perform 1 from users where role = 'admin' and is_active for update;

  select * into v_target from users where id = p_user_id for update;
  if not found then
    raise exception 'user_not_found';
  end if;

  -- The last active admin cannot be deactivated or demoted.
  if v_target.role = 'admin' and v_target.is_active
     and (p_role <> 'admin' or not p_is_active)
     and not exists (
       select 1 from users
       where role = 'admin' and is_active and id <> p_user_id
     ) then
    raise exception 'last_admin';
  end if;

  -- Promotion to admin may not carry the demo PIN.
  if p_role = 'admin' and v_target.role <> 'admin' and v_target.pin = '0000' then
    raise exception 'weak_admin_pin';
  end if;

  update users set name = v_name, role = p_role, is_active = p_is_active
  where id = p_user_id;
end;
$$;

create or replace function staff_set_pin(
  p_admin_id  uuid,
  p_admin_pin text,
  p_user_id   uuid,
  p_new_pin   text
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_target users;
begin
  perform _assert_admin(p_admin_id, p_admin_pin);

  if p_new_pin is null or p_new_pin !~ '^[0-9]{4}$' then
    raise exception 'invalid_pin';
  end if;

  select * into v_target from users where id = p_user_id for update;
  if not found then
    raise exception 'user_not_found';
  end if;

  if v_target.role = 'admin' and p_new_pin = '0000' then
    raise exception 'weak_admin_pin';
  end if;

  update users set pin = p_new_pin where id = p_user_id;
end;
$$;

-- DESTRUCTIVE (approved by the owner): after this, anon/authenticated can no longer
-- insert, update or delete users directly. Staff changes go through the staff_*
-- RPCs above. RLS stays enabled with no policies, so direct access is denied.
-- Any src code that writes to `users` directly stops working.
drop policy if exists users_insert on users;
drop policy if exists users_update on users;
drop policy if exists users_delete on users;

-- ---------- F. events: per-event shirt options (null = app defaults) ----------
alter table events add column if not exists shirt_colors jsonb;
alter table events add column if not exists shirt_sizes  text[];

-- ---------- G. designs: soft hide ----------
alter table designs add column if not exists is_active boolean not null default true;

-- ---------- H. order_stats_v: add cancelled count, exclude cancelled from averages ----------
-- Same columns in the same order; count_cancelled appended at the end.
create or replace view order_stats_v with (security_invoker = true) as
select
  o.event_id,
  e.name                                         as event_name,
  count(*)                                       as total_orders,
  count(*) filter (where o.status = 'new')         as count_new,
  count(*) filter (where o.status = 'in_progress') as count_in_progress,
  count(*) filter (where o.status = 'ready')        as count_ready,
  count(*) filter (where o.status = 'completed')    as count_completed,
  avg(extract(epoch from (o.ready_at     - o.new_at)))
    filter (where o.status <> 'cancelled')                       as avg_secs_to_ready,
  avg(extract(epoch from (o.completed_at - o.new_at)))
    filter (where o.status <> 'cancelled')                       as avg_secs_to_complete,
  count(*) filter (where o.status = 'cancelled')    as count_cancelled
from orders o
join events e on e.id = o.event_id
group by o.event_id, e.name;
grant select on order_stats_v to anon, authenticated;

-- ---------- I. Storage: design photo limits ----------
-- Restrictive: new uploads over 5 MB or outside these types are rejected.
-- Existing objects are not touched.
update storage.buckets
set file_size_limit    = 5242880,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'designs';

-- ---------- J. Grants for the new public RPCs ----------
-- _assert_admin is deliberately not granted.
grant execute on function create_order_v2(uuid, text, shirt_size, uuid, uuid, text, uuid, text, text, uuid) to anon, authenticated;
grant execute on function activate_event(uuid)                                    to anon, authenticated;
grant execute on function staff_list(uuid, text)                                  to anon, authenticated;
grant execute on function staff_create(uuid, text, text, user_role, text)         to anon, authenticated;
grant execute on function staff_update(uuid, text, uuid, text, user_role, boolean) to anon, authenticated;
grant execute on function staff_set_pin(uuid, text, uuid, text)                   to anon, authenticated;

commit;
```

### supabase/rollback/0004_ops_rollback.sql

```sql
-- MerchPress Queue — rollback of 0004_ops.sql. NEVER run unless asked.
-- Back up first. The enum value 'cancelled' from 0003 cannot be removed and stays.

begin;

-- Refuse to roll back while cancelled orders exist: the restored set_order_status
-- and the dropped cancelled_* columns cannot represent them. Resolve them by hand
-- (decide what status they should have), then re-run.
do $$
begin
  if exists (select 1 from orders where status = 'cancelled') then
    raise exception 'rollback aborted: cancelled orders exist';
  end if;
end $$;

-- Restore the three users policies (as in 0001_init.sql).
drop policy if exists users_insert on users;
drop policy if exists users_update on users;
drop policy if exists users_delete on users;
create policy users_insert on users for insert with check (true);
create policy users_update on users for update using (true) with check (true);
create policy users_delete on users for delete using (true);

-- Drop the new functions.
drop function if exists staff_set_pin(uuid, text, uuid, text);
drop function if exists staff_update(uuid, text, uuid, text, user_role, boolean);
drop function if exists staff_create(uuid, text, text, user_role, text);
drop function if exists staff_list(uuid, text);
drop function if exists _assert_admin(uuid, text);
drop function if exists activate_event(uuid);
drop function if exists create_order_v2(uuid, text, shirt_size, uuid, uuid, text, uuid, text, text, uuid);

-- Restore set_order_status as in 0001_init.sql.
create or replace function set_order_status(
  p_order_id uuid,
  p_status   order_status,
  p_user_id  uuid
) returns orders
language plpgsql security definer set search_path = public as $$
declare
  v_order orders;
  v_rank  jsonb := '{"new":0,"in_progress":1,"ready":2,"completed":3}';
begin
  select * into v_order from orders where id = p_order_id for update;
  if not found then
    raise exception 'order % not found', p_order_id;
  end if;

  if (v_rank ->> v_order.status::text)::int >= (v_rank ->> p_status::text)::int then
    return v_order;
  end if;

  update orders set
    status         = p_status,
    claimed_by     = case when p_status = 'in_progress' then p_user_id else claimed_by end,
    in_progress_at = case when p_status = 'in_progress' then now() else in_progress_at end,
    ready_at       = case when p_status = 'ready'       then now() else ready_at end,
    completed_at   = case when p_status = 'completed'   then now() else completed_at end
  where id = p_order_id
  returning * into v_order;

  return v_order;
end;
$$;

-- Restore order_stats_v as in 0001_init.sql (a view cannot lose a column via replace).
drop view if exists order_stats_v;
create view order_stats_v with (security_invoker = true) as
select
  o.event_id,
  e.name                                         as event_name,
  count(*)                                       as total_orders,
  count(*) filter (where o.status = 'new')         as count_new,
  count(*) filter (where o.status = 'in_progress') as count_in_progress,
  count(*) filter (where o.status = 'ready')        as count_ready,
  count(*) filter (where o.status = 'completed')    as count_completed,
  avg(extract(epoch from (o.ready_at     - o.new_at)))         as avg_secs_to_ready,
  avg(extract(epoch from (o.completed_at - o.new_at)))         as avg_secs_to_complete
from orders o
join events e on e.id = o.event_id
group by o.event_id, e.name;
grant select on order_stats_v to anon, authenticated;

-- Drop the new columns (DATA LOSS for their contents).
drop index if exists orders_client_request_id_idx;
alter table orders  drop column if exists client_request_id;
alter table orders  drop column if exists cancelled_by;
alter table orders  drop column if exists cancelled_at;
alter table events  drop column if exists shirt_colors;
alter table events  drop column if exists shirt_sizes;
alter table designs drop column if exists is_active;

-- Remove the bucket limits.
update storage.buckets set file_size_limit = null, allowed_mime_types = null where id = 'designs';

commit;
```

## 3. Statement-by-statement

| File | Statement | Class | Notes |
|---|---|---|---|
| 0003 | add enum value `cancelled` | additive | Cannot be removed later, even by rollback |
| 0004 A | 3 columns on `orders` | additive | Nullable, no rewrite |
| 0004 A | unique partial index on `client_request_id` | additive | Table has no values yet |
| 0004 B | replace `set_order_status` | behaviour change | Same signature. Old callers unaffected unless they send `cancelled`. Completed rows now return unchanged (they already did) |
| 0004 C | `create_order_v2` | additive | `create_order` untouched |
| 0004 D | `activate_event` | additive | |
| 0004 E | `_assert_admin`, `staff_*` (5 functions) | additive | `_assert_admin` execute revoked from public, anon, authenticated |
| 0004 E | drop `users_insert`, `users_update`, `users_delete` | **destructive** | Owner-approved. Direct user writes from anon stop. Reversible via rollback file |
| 0004 F | 2 nullable columns on `events` | additive | |
| 0004 G | `designs.is_active` default true | additive | Existing rows become active |
| 0004 H | replace `order_stats_v` | additive | Same columns/order, one appended; averages now exclude cancelled (no effect until a cancel exists) |
| 0004 I | bucket size and MIME limits | restrictive | New uploads only; existing files kept. See open question 1 |
| 0004 J | grants on 6 functions | additive | |

## 4. src changes round 2 must make

- **Cancel UI and types.** src/types/db.ts:7 add `cancelled`; :46-54 add `cancelled_at`, `cancelled_by`, `client_request_id` to `Order`; :57-67 add `count_cancelled` to `OrderStats`. src/lib/colors.ts:5 and src/index.css:30-38 need a cancelled style (StatusBadge.tsx:5 throws without it). src/components/OrderCard.tsx:103 hide the wait timer for cancelled. src/pages/PressPage.tsx:54 and src/pages/CashierPage.tsx:49,76 decide how cancelled orders are listed. src/lib/orderStatus.ts:19 already passes any status. A Cancel button in Press/Cashier is new.
- **Idempotent create.** src/pages/CashierPage.tsx:170 switch to `create_order_v2` with a `crypto.randomUUID()` generated once per form submission and reused on retry. Add a timeout/retry like src/lib/orderStatus.ts.
- **Activate event.** src/hooks/useEvents.ts:38-39 replace the two updates with `rpc('activate_event')`.
- **Staff admin.** New admin UI calling `staff_list/create/update/set_pin`. It must hold the admin id and PIN from the session; nothing exists today.
- **Events options.** src/types/db.ts:9-16 add `shirt_colors`, `shirt_sizes`; src/config.ts:12,20 become fallbacks; src/components/ColorPicker.tsx:14 and SizePicker.tsx:13 read the event values; src/hooks/useEvents.ts:25 insert; src/context/SessionContext.tsx:51 select.
- **Designs.** src/types/db.ts:25-34 add `is_active`; src/hooks/useDesigns.ts:18 filter or expose it for cashiers; src/pages/AdminDesignsPage.tsx:78 hard delete could become a toggle.
- **Stats.** src/pages/StatsPage.tsx:45 and the KPI row near :118 show `count_cancelled`; src/pages/StatsPage.tsx:39 export includes cancelled rows.
- **Photo upload.** src/pages/AdminDesignsPage.tsx:15 must send only jpeg/png/webp under 5 MB (see below).

Deploy order: apply 0003, apply 0004, then deploy src. Old bundles keep working in between (`create_order`, `set_order_status` forward moves, `staff_v`, `verify_pin` unchanged). Do not create a cancelled order before the new bundle is live, because the old `StatusBadge` would crash on it.

## 5. Open questions

1. **Photo upload will break at the tablet.** The bucket now rejects files over 5 MB and anything that is not jpeg/png/webp. Phone photos are often over 5 MB and iPhones may send HEIC. R1 listed image compression as a non-goal. Either round 2 adds client-side resize/convert, or the limit needs raising.
2. **`events.shirt_sizes text[]` cannot reach `orders.shirt_size`.** That column is the enum `shirt_size` (XS..XXL). A custom size outside that list fails on `create_order_v2`. Subsets work. Real custom sizes need a column type change, which this round does not do.
3. **Seed admin PIN `0000` in production.** The rules only block `0000` on create, set_pin and promotion. An existing admin with `0000` keeps working until someone sets a new PIN via `staff_set_pin`. Do you want that forced before the event?
4. **`total_orders` in `order_stats_v` now includes cancelled orders**, since only the two averages were specified. The KPI total then no longer equals the sum of the four visible status counts. Say if it should exclude them.
5. **Promoting a user with a null PIN to admin is allowed** (only `0000` is blocked). That admin cannot log in until a PIN is set. Should it be rejected?
6. **Reactivating an inactive admin** whose PIN is `0000` is allowed (not in the rules).
7. **`verify_pin` returns the whole `users` row including `pin`** to the caller. Pre-existing and out of scope, but the PIN of the person logging in is sent back to the client.
8. **`activate_event` and `staff_*` carry no rate limiting**, so an admin PIN can be brute-forced over RPC (4 digits, 10,000 tries). Matches the accepted risk in 06_SECURITY.md, listed for completeness.
9. **Transaction wrapper.** 0004 has explicit `begin`/`commit`. If your apply path already wraps in a transaction, the nested `begin` only warns. Confirm the path you will use.
10. **`staff_v` still excludes inactive users** by design, so the login picker never shows them; the admin sees them only via `staff_list`.
