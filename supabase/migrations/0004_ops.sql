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
