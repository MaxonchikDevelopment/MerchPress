-- MerchPress Queue — initial schema
-- Cloud-first: Supabase (Postgres + Realtime + Storage). PIN auth is MVP-only, not strong security.

-- ---------- Enums ----------
create type user_role    as enum ('cashier', 'press', 'admin');
create type shirt_size   as enum ('XS', 'S', 'M', 'L', 'XL', 'XXL');
create type design_type  as enum ('big', 'small');
create type order_status as enum ('new', 'in_progress', 'ready', 'completed');

-- ---------- Tables ----------
create table events (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  location   text,
  event_date date,
  is_active  boolean not null default false,
  created_at timestamptz not null default now()
);
-- At most one active event at a time.
create unique index events_one_active_idx on events (is_active) where is_active;

create table users (
  id        uuid primary key default gen_random_uuid(),
  name      text not null,
  role      user_role not null,
  pin       text,                       -- 4-digit, nullable (MVP-only security)
  is_active boolean not null default true
);

create table designs (
  id                uuid primary key default gen_random_uuid(),
  event_id          uuid not null references events(id) on delete cascade,
  name              text not null,
  type              design_type not null,
  photo_front       text,               -- Storage path
  photo_back        text,
  compatible_colors text[] not null default '{}',
  created_at        timestamptz not null default now()
);
create index designs_event_idx on designs (event_id);

create table orders (
  id              uuid primary key default gen_random_uuid(),
  event_id        uuid not null references events(id) on delete cascade,
  event_order_no  int  not null,        -- human-facing #, restarts at 1 per event
  created_at      timestamptz not null default now(),
  shirt_color     text not null,
  shirt_size      shirt_size not null,
  design_front_id uuid references designs(id),
  design_back_id  uuid references designs(id),
  client_name     text,
  status          order_status not null default 'new',
  created_by      uuid references users(id),
  cashier_key     text,
  cashier_name    text,
  claimed_by      uuid references users(id),
  new_at          timestamptz not null default now(),
  in_progress_at  timestamptz,
  ready_at        timestamptz,
  completed_at    timestamptz,
  unique (event_id, event_order_no)
);
create index orders_queue_idx on orders (event_id, status, created_at);

-- ---------- RPCs ----------

-- Atomically assign the next per-event order number and insert the order.
create or replace function create_order(
  p_event_id        uuid,
  p_shirt_color     text,
  p_shirt_size      shirt_size,
  p_design_front_id uuid,
  p_design_back_id  uuid,
  p_client_name     text,
  p_created_by      uuid,
  p_cashier_key     text,
  p_cashier_name    text
) returns orders
language plpgsql security definer set search_path = public as $$
declare
  v_order orders;
  v_no    int;
begin
  for i in 1..25 loop
    select coalesce(max(event_order_no), 0) + 1 into v_no
      from orders where event_id = p_event_id;
    begin
      insert into orders (
        event_id, event_order_no, shirt_color, shirt_size,
        design_front_id, design_back_id, client_name,
        created_by, cashier_key, cashier_name
      ) values (
        p_event_id, v_no, p_shirt_color, p_shirt_size,
        p_design_front_id, p_design_back_id, nullif(p_client_name, ''),
        p_created_by, p_cashier_key, p_cashier_name
      ) returning * into v_order;
      return v_order;
    exception when unique_violation then
      -- another insert grabbed v_no; retry with a fresh number
    end;
  end loop;
  raise exception 'create_order: could not assign event_order_no after retries';
end;
$$;

-- Advance an order's status; stamps the matching timestamp, sets claimed_by on
-- in_progress, and no-ops if the order is already at/past the target state.
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

-- PIN check kept server-side so PINs are not broadly readable by clients.
create or replace function verify_pin(p_user_id uuid, p_pin text)
returns users
language plpgsql security definer set search_path = public as $$
declare v_user users;
begin
  select * into v_user from users
    where id = p_user_id and is_active and pin = p_pin;
  return v_user;  -- null row if no match
end;
$$;

-- ---------- Stats view ----------
-- security_invoker so it respects RLS of the caller (orders/events are readable).
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

-- ---------- RLS (permissive MVP policies) ----------
-- Trade-off: anon key + permissive policies = anyone with the URL can read/write.
-- Acceptable for a trusted booth MVP; revisit before any public exposure.
alter table events  enable row level security;
alter table users   enable row level security;
alter table designs enable row level security;
alter table orders  enable row level security;

create policy events_all  on events  for all using (true) with check (true);
create policy designs_all on designs for all using (true) with check (true);
create policy orders_all  on orders  for all using (true) with check (true);
-- Users: writable (admin manages staff) but NOT directly selectable, so PINs are
-- never returned to clients. Pickers read staff_v (below); PINs go through verify_pin.
create policy users_insert on users for insert with check (true);
create policy users_update on users for update using (true) with check (true);
create policy users_delete on users for delete using (true);

-- PIN-free projection for role/name selection on the login screen.
create view staff_v with (security_invoker = false) as
  select id, name, role, is_active from users where is_active;
grant select on staff_v to anon, authenticated;

-- ---------- Realtime ----------
alter publication supabase_realtime add table orders;
alter table orders replica identity full;
