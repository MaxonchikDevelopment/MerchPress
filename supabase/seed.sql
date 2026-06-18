-- Demo data for local testing. Safe to run on an empty DB.

-- Staff (PINs are demo-only).
insert into users (id, name, role, pin) values
  ('11111111-1111-1111-1111-111111111111', 'Maxim',  'cashier', '1111'),
  ('22222222-2222-2222-2222-222222222222', 'Anna',   'cashier', '2222'),
  ('33333333-3333-3333-3333-333333333333', 'Lena',   'press',   '3333'),
  ('44444444-4444-4444-4444-444444444444', 'Olga',   'press',   '4444'),
  ('55555555-5555-5555-5555-555555555555', 'Admin',  'admin',   '0000')
on conflict (id) do nothing;

-- One active event.
insert into events (id, name, location, event_date, is_active) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Hyrox Riga', 'Riga', current_date, true)
on conflict (id) do nothing;

-- A couple of designs for that event (photos can be uploaded later via Admin).
insert into designs (event_id, name, type, compatible_colors) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Riga Skyline',  'big',   '{white,black,navy}'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Riga Map Small','small', '{white,black}')
on conflict do nothing;
