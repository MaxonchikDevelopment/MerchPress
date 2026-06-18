-- Public bucket for design photos. Public read so tablets can show thumbnails
-- without auth; uploads/updates open for the MVP (matches permissive table RLS).
insert into storage.buckets (id, name, public)
values ('designs', 'designs', true)
on conflict (id) do nothing;

create policy "designs read"   on storage.objects for select using (bucket_id = 'designs');
create policy "designs insert" on storage.objects for insert with check (bucket_id = 'designs');
create policy "designs update" on storage.objects for update using (bucket_id = 'designs');
create policy "designs delete" on storage.objects for delete using (bucket_id = 'designs');
