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
