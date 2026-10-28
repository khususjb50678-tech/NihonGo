-- Jalankan sekali di Supabase (SQL Editor): tombol download aplikasi di halaman Developer
create table if not exists public.app_downloads (
  id integer primary key default 1 check (id = 1),
  config jsonb not null default '{}'::jsonb
);
alter table public.app_downloads enable row level security;
drop policy if exists "appdl_baca" on public.app_downloads;
drop policy if exists "appdl_owner_tulis" on public.app_downloads;
create policy "appdl_baca" on public.app_downloads for select to anon, authenticated using (true);
create policy "appdl_owner_tulis" on public.app_downloads for all to authenticated using (public.is_owner()) with check (public.is_owner());
