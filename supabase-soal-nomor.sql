-- Jalankan SEKALI di Supabase -> SQL Editor. Untuk nomor soal & halaman dari impor PDF.
alter table public.questions add column if not exists q_number integer;
alter table public.questions add column if not exists source_page integer;
notify pgrst, 'reload schema';
