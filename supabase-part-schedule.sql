-- ITCO JAPAN: jadwal aktif/nonaktif per Part
alter table public.parts add column if not exists scheduled_start_at timestamptz;
alter table public.parts add column if not exists scheduled_end_at timestamptz;
notify pgrst, 'reload schema';
