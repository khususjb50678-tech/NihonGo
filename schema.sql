-- ITCO JAPAN / Supabase schema
create extension if not exists pgcrypto;
create table if not exists branding (id int primary key default 1, site_name text not null default 'ITCO JAPAN', corporate_name text default 'TOP CORPORATION', creator text default 'ウィタマ。', hero_image text, description text, updated_at timestamptz default now());
create table if not exists kanji (id uuid primary key default gen_random_uuid(), kanji text not null, level text, reading text, romaji text, meaning text, notes text, active boolean default true, created_at timestamptz default now());
create table if not exists parts (id uuid primary key default gen_random_uuid(), part_number int not null unique check(part_number between 1 and 20), name text not null, description text, question_limit int, shuffle_questions boolean default true, shuffle_options boolean default true, active boolean default true, created_at timestamptz default now());
create table if not exists questions (id uuid primary key default gen_random_uuid(), part_id uuid references parts(id) on delete cascade, prompt text not null, reading text, instruction text, type text not null default 'multiple_choice', options jsonb default '[]'::jsonb, answer text not null, media_url text, media_type text, active boolean default true, created_at timestamptz default now());
create table if not exists timer_settings (id int primary key default 1, enabled boolean default false, global_seconds int default 0, per_part jsonb default '{}'::jsonb, per_question jsonb default '{}'::jsonb, updated_at timestamptz default now());
create table if not exists results (id uuid primary key default gen_random_uuid(), name text not null, part_id uuid references parts(id) on delete set null, score int not null, correct_count int not null, wrong_count int not null, unanswered_count int not null, details jsonb, created_at timestamptz default now());

-- Public read policies. Admin writes should be protected by authenticated policies.
alter table branding enable row level security;
alter table kanji enable row level security;
alter table parts enable row level security;
alter table questions enable row level security;
alter table timer_settings enable row level security;
alter table results enable row level security;
create policy "public branding read" on branding for select using (true);
create policy "public active kanji read" on kanji for select using (active=true);
create policy "public active parts read" on parts for select using (active=true);
create policy "public active questions read" on questions for select using (active=true);
create policy "public timer read" on timer_settings for select using (true);
create policy "public result insert" on results for insert with check (true);
-- Admin policies: for a real production setup, replace the authenticated condition with your admin role/claim.
create policy "auth branding write" on branding for all to authenticated using (true) with check (true);
create policy "auth kanji write" on kanji for all to authenticated using (true) with check (true);
create policy "auth parts write" on parts for all to authenticated using (true) with check (true);
create policy "auth questions write" on questions for all to authenticated using (true) with check (true);
create policy "auth timer write" on timer_settings for all to authenticated using (true) with check (true);
create policy "auth results read" on results for select to authenticated using (true);
