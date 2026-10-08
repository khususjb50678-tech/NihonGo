-- =====================================================================
--  AKUN PENGGUNA + KEAMANAN ADMIN
--  Jalankan SEKALI di Supabase -> SQL Editor -> New query -> Run.
--
--  Kenapa perlu: setelah user bisa membuat akun sendiri, akun biasa TIDAK boleh
--  bisa membuka panel Admin atau mengubah data. Script ini membuat daftar Admin
--  dan mengunci semua perubahan data hanya untuk Admin.
--
--  SEBELUM RUN: ganti email di LANGKAH 2 dengan email akun Admin kamu
--  (akun yang selama ini kamu pakai login di admin.html).
-- =====================================================================

-- LANGKAH 1: tabel daftar Admin + fungsi pengecek
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$ select exists (select 1 from public.admins where user_id = auth.uid()) $$;
grant execute on function public.is_admin() to anon, authenticated;

drop policy if exists "admins_baca_diri_sendiri" on public.admins;
create policy "admins_baca_diri_sendiri" on public.admins
  for select to authenticated using (user_id = auth.uid());

-- LANGKAH 2: daftarkan akun Admin kamu (GANTI EMAIL DI BAWAH INI!)
-- Jika email tidak ditemukan, script berhenti di sini supaya kamu tidak terkunci.
do $$
declare
  v_email text := lower('GANTI-DENGAN-EMAIL-ADMIN-KAMU@contoh.com');
  v_id uuid;
begin
  select id into v_id from auth.users where lower(email) = v_email;
  if v_id is null then
    raise exception 'Email admin "%" tidak ditemukan di Authentication > Users. Cek penulisan emailnya lalu Run lagi.', v_email;
  end if;
  insert into public.admins(user_id) values (v_id) on conflict do nothing;
end $$;

-- LANGKAH 3: kunci data (policy "restrictive" = tambahan aturan di atas aturan yang sudah ada,
-- jadi aturan lamamu tidak dihapus).
do $$
declare t text;
begin
  -- Tabel konten: hanya Admin yang boleh mengubah. Belum login = tidak bisa membaca.
  foreach t in array array['kanji','bunpou','parts','questions','timer_settings'] loop
    if to_regclass('public.'||t) is not null then
      execute format('alter table public.%I enable row level security', t);
      execute format('drop policy if exists "akun_anon_tidak_baca" on public.%I', t);
      execute format('drop policy if exists "akun_admin_insert" on public.%I', t);
      execute format('drop policy if exists "akun_admin_update" on public.%I', t);
      execute format('drop policy if exists "akun_admin_delete" on public.%I', t);
      execute format('create policy "akun_anon_tidak_baca" on public.%I as restrictive for select to anon using (false)', t);
      execute format('create policy "akun_admin_insert" on public.%I as restrictive for insert to anon, authenticated with check (public.is_admin())', t);
      execute format('create policy "akun_admin_update" on public.%I as restrictive for update to anon, authenticated using (public.is_admin()) with check (public.is_admin())', t);
      execute format('create policy "akun_admin_delete" on public.%I as restrictive for delete to anon, authenticated using (public.is_admin())', t);
    end if;
  end loop;

  -- Branding: boleh dibaca siapa saja (dipakai layar loading & layar masuk), diubah hanya Admin.
  if to_regclass('public.branding') is not null then
    execute 'alter table public.branding enable row level security';
    execute 'drop policy if exists "akun_admin_insert" on public.branding';
    execute 'drop policy if exists "akun_admin_update" on public.branding';
    execute 'drop policy if exists "akun_admin_delete" on public.branding';
    execute 'create policy "akun_admin_insert" on public.branding as restrictive for insert to anon, authenticated with check (public.is_admin())';
    execute 'create policy "akun_admin_update" on public.branding as restrictive for update to anon, authenticated using (public.is_admin()) with check (public.is_admin())';
    execute 'create policy "akun_admin_delete" on public.branding as restrictive for delete to anon, authenticated using (public.is_admin())';
  end if;

  -- Hasil latihan: user yang sudah login boleh menyimpan hasilnya; hanya Admin yang boleh melihat/mengubah/menghapus.
  if to_regclass('public.results') is not null then
    execute 'alter table public.results enable row level security';
    execute 'drop policy if exists "akun_anon_tidak_insert" on public.results';
    execute 'drop policy if exists "akun_admin_select" on public.results';
    execute 'drop policy if exists "akun_admin_update" on public.results';
    execute 'drop policy if exists "akun_admin_delete" on public.results';
    execute 'create policy "akun_anon_tidak_insert" on public.results as restrictive for insert to anon with check (false)';
    execute 'create policy "akun_admin_select" on public.results as restrictive for select to anon, authenticated using (public.is_admin())';
    execute 'create policy "akun_admin_update" on public.results as restrictive for update to anon, authenticated using (public.is_admin()) with check (public.is_admin())';
    execute 'create policy "akun_admin_delete" on public.results as restrictive for delete to anon, authenticated using (public.is_admin())';
  end if;

  -- Daftar nama: hanya user yang login; hapus hanya Admin.
  if to_regclass('public.user_names') is not null then
    execute 'alter table public.user_names enable row level security';
    execute 'drop policy if exists "akun_anon_tidak_akses" on public.user_names';
    execute 'drop policy if exists "akun_admin_delete" on public.user_names';
    execute 'create policy "akun_anon_tidak_akses" on public.user_names as restrictive for all to anon using (false) with check (false)';
    execute 'create policy "akun_admin_delete" on public.user_names as restrictive for delete to anon, authenticated using (public.is_admin())';
  end if;
end $$;

-- LANGKAH 4: file (foto/audio/logo) di Storage: hanya Admin yang boleh upload/ubah/hapus.
do $$
begin
  execute 'drop policy if exists "akun_admin_storage_insert" on storage.objects';
  execute 'drop policy if exists "akun_admin_storage_update" on storage.objects';
  execute 'drop policy if exists "akun_admin_storage_delete" on storage.objects';
  execute 'create policy "akun_admin_storage_insert" on storage.objects as restrictive for insert to anon, authenticated with check (public.is_admin())';
  execute 'create policy "akun_admin_storage_update" on storage.objects as restrictive for update to anon, authenticated using (public.is_admin()) with check (public.is_admin())';
  execute 'create policy "akun_admin_storage_delete" on storage.objects as restrictive for delete to anon, authenticated using (public.is_admin())';
exception when others then
  raise notice 'Policy Storage dilewati (%). Atur manual di Storage > Policies: upload/ubah/hapus hanya untuk Admin.', sqlerrm;
end $$;

notify pgrst, 'reload schema';
