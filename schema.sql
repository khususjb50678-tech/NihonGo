-- ITCO JAPAN — Supabase schema v2
create extension if not exists pgcrypto;

create table if not exists branding (
  id int primary key default 1,
  site_name text not null default 'ITCO JAPAN',
  corporate_name text default 'TOP CORPORATION',
  creator text default 'ウィタマ。',
  logo_url text,
  favicon_url text,
  hero_image text,
  description text default 'Belajar bahasa Jepang dengan Kanji dan latihan interaktif.',
  creator_name text default 'Witama Yuliananta',
  developer_description text default 'Website ini dibuat dan dikembangkan oleh Witama Yuliananta, sebagai bagian dari pengembangan media pembelajaran bahasa Jepang yang interaktif, modern, dan mudah digunakan.',
  whatsapp_url text,
  telegram_url text,
  instagram_url text,
  updated_at timestamptz default now()
);

create table if not exists kanji (
  id uuid primary key default gen_random_uuid(), kanji text not null,
  level text, reading text, onyomi text, romaji text, meaning text not null, notes text,
  active boolean default true, created_at timestamptz default now()
);

create table if not exists parts (
  id uuid primary key default gen_random_uuid(), part_number int not null unique check(part_number between 1 and 20),
  name text not null, description text, question_limit int, shuffle_questions boolean default true,
  shuffle_options boolean default true, active boolean default true, created_at timestamptz default now()
);

create table if not exists questions (
  id uuid primary key default gen_random_uuid(), part_id uuid references parts(id) on delete cascade,
  prompt text not null, reading text, instruction text, type text not null default 'multiple_choice',
  options jsonb default '[]'::jsonb, answer text not null, media_url text, media_type text,
  photo_url text, audio_url text, active boolean default true, created_at timestamptz default now()
);

alter table kanji add column if not exists onyomi text;
alter table questions add column if not exists photo_url text;
alter table questions add column if not exists audio_url text;

create table if not exists timer_settings (
  id int primary key default 1, enabled boolean default false, global_seconds int default 0,
  per_part jsonb default '{}'::jsonb, per_question jsonb default '{}'::jsonb, updated_at timestamptz default now()
);

create table if not exists user_names (
  id uuid primary key default gen_random_uuid(), name text not null unique, created_at timestamptz default now()
);

create table if not exists results (
  id uuid primary key default gen_random_uuid(), name text not null, part_id uuid references parts(id) on delete set null,
  score int not null, correct_count int not null, wrong_count int not null, unanswered_count int not null,
  details jsonb, created_at timestamptz default now()
);

alter table branding add column if not exists logo_url text;
alter table branding add column if not exists favicon_url text;
alter table branding add column if not exists hero_image text;
alter table branding add column if not exists creator_name text default 'Witama Yuliananta';
alter table branding add column if not exists developer_logo_url text;
alter table branding add column if not exists developer_description text;
alter table branding add column if not exists whatsapp_url text;
alter table branding add column if not exists telegram_url text;
alter table branding add column if not exists instagram_url text;
alter table branding enable row level security;
alter table kanji enable row level security;
alter table parts enable row level security;
alter table questions enable row level security;
alter table timer_settings enable row level security;
alter table user_names enable row level security;
alter table results enable row level security;

do $$ begin
  create policy "public branding read" on branding for select using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "public active kanji read" on kanji for select using (active=true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "public active parts read" on parts for select using (active=true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "public active questions read" on questions for select using (active=true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "public timer read" on timer_settings for select using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "public result insert" on results for insert with check (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "public name insert" on user_names for insert with check (true);
exception when duplicate_object then null; end $$;

-- Authenticated Admin access. In production, only give the Admin account access to this Supabase project.
do $$ begin
  create policy "auth branding write" on branding for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "auth kanji write" on kanji for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "auth parts write" on parts for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "auth questions write" on questions for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "auth timer write" on timer_settings for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "auth names read" on user_names for select to authenticated using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "auth names write" on user_names for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "auth results read" on results for select to authenticated using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "auth results delete" on results for delete to authenticated using (true);
exception when duplicate_object then null; end $$;

-- Storage bucket for photo/audio uploads. Run once in SQL Editor.
insert into storage.buckets (id, name, public) values ('media', 'media', true) on conflict (id) do update set public=true;

do $$ begin
  create policy "public media read" on storage.objects for select using (bucket_id='media');
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "auth media upload" on storage.objects for insert to authenticated with check (bucket_id='media');
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "auth media update" on storage.objects for update to authenticated using (bucket_id='media') with check (bucket_id='media');
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "auth media delete" on storage.objects for delete to authenticated using (bucket_id='media');
exception when duplicate_object then null; end $$;
