-- ITCO JAPAN: fix/verify question media storage
-- Run this once in Supabase SQL Editor if the media bucket/policies were not created.
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do update set public = true;

do $$ begin
  create policy "public media read" on storage.objects
  for select using (bucket_id='media');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "auth media upload" on storage.objects
  for insert to authenticated
  with check (bucket_id='media');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "auth media update" on storage.objects
  for update to authenticated
  using (bucket_id='media') with check (bucket_id='media');
exception when duplicate_object then null; end $$;
