-- Jalankan SEKALI di Supabase -> SQL Editor -> New query -> Run.
-- Kolom baru untuk: (1) Part diatur Admin / User + timer per Part, (2) pilihan animasi per Kanji.
-- Data lama aman: Part lama otomatis "admin", Kanji lama otomatis beranimasi.

alter table public.parts add column if not exists setup_mode text not null default 'admin';
alter table public.parts add column if not exists timer_seconds integer;
alter table public.kanji add column if not exists animate boolean not null default true;

notify pgrst, 'reload schema';

-- ITCO JAPAN: jadwal aktif/nonaktif per Part
alter table public.parts add column if not exists scheduled_start_at timestamptz;
alter table public.parts add column if not exists scheduled_end_at timestamptz;
notify pgrst, 'reload schema';
