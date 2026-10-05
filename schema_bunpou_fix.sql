-- ITCO JAPAN — Fix tabel Bunpou + refresh PostgREST schema cache
create extension if not exists pgcrypto;

create table if not exists public.bunpou (
  id uuid primary key default gen_random_uuid(),
  category text not null default 'bunpou' check(category in ('partikel','bunpou')),
  title text not null,
  pattern text not null,
  meaning text not null,
  usage text,
  before_form text,
  notes text,
  examples jsonb default '[]'::jsonb,
  conversation jsonb default '[]'::jsonb,
  sort_order int default 100,
  active boolean default true,
  created_at timestamptz default now()
);

-- Pastikan kolom tetap ada bila tabel sudah pernah dibuat dengan versi lama.
alter table public.bunpou add column if not exists category text default 'bunpou';
alter table public.bunpou add column if not exists title text;
alter table public.bunpou add column if not exists pattern text;
alter table public.bunpou add column if not exists meaning text;
alter table public.bunpou add column if not exists usage text;
alter table public.bunpou add column if not exists before_form text;
alter table public.bunpou add column if not exists notes text;
alter table public.bunpou add column if not exists examples jsonb default '[]'::jsonb;
alter table public.bunpou add column if not exists conversation jsonb default '[]'::jsonb;
alter table public.bunpou add column if not exists sort_order int default 100;
alter table public.bunpou add column if not exists active boolean default true;
alter table public.bunpou add column if not exists created_at timestamptz default now();

-- Supabase API roles perlu hak akses tabel.
grant select, insert, update, delete on table public.bunpou to anon, authenticated;

-- Ini bagian penting untuk error:
-- "Could not find the table 'public.bunpou' in the schema cache"
notify pgrst, 'reload schema';

-- Tampilan kartu
alter table public.branding add column if not exists card_wallpaper_url text;
notify pgrst, 'reload schema';
