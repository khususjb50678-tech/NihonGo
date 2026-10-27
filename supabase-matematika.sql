-- Jalankan sekali di Supabase (SQL Editor): pengaturan Matematika & Kraepelin
create table if not exists public.math_settings (
  id integer primary key default 1 check (id = 1),
  config jsonb not null default '{}'::jsonb
);
alter table public.math_settings enable row level security;
drop policy if exists "math_baca" on public.math_settings;
drop policy if exists "math_admin_tulis" on public.math_settings;
create policy "math_baca" on public.math_settings for select to anon, authenticated using (true);
create policy "math_admin_tulis" on public.math_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());
