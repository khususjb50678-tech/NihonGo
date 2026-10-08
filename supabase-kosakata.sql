-- Jalankan SEKALI di Supabase -> SQL Editor -> New query -> Run.
-- Untuk fitur Admin > Kosakata (ubah / sembunyikan / tambah kata).
create table if not exists public.vocab_edits (
  id uuid primary key default gen_random_uuid(),
  lesson integer not null,
  number integer,            -- nomor kata di bab; kosong = kata tambahan baru
  kanji text, kana text, arti text,
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index if not exists vocab_edits_unik on public.vocab_edits (lesson, number) where number is not null;
alter table public.vocab_edits enable row level security;
drop policy if exists "vocab_baca" on public.vocab_edits;
drop policy if exists "vocab_admin_tulis" on public.vocab_edits;
create policy "vocab_baca" on public.vocab_edits for select to anon, authenticated using (true);
create policy "vocab_admin_tulis" on public.vocab_edits for all to authenticated using (public.is_admin()) with check (public.is_admin());
notify pgrst, 'reload schema';
