-- Jalankan SEKALI di Supabase SQL Editor.
-- Menambahkan pengaturan Pesan Website dan Maintenance ke tabel branding yang sudah ada.

alter table public.branding add column if not exists notice_enabled boolean not null default false;
alter table public.branding add column if not exists notice_title text not null default 'Update Terbaru';
alter table public.branding add column if not exists notice_message text not null default '';
alter table public.branding add column if not exists maintenance_enabled boolean not null default false;
alter table public.branding add column if not exists maintenance_title text not null default 'Website Sedang Dalam Perbaikan';
alter table public.branding add column if not exists maintenance_message text not null default 'Kami sedang melakukan beberapa perbaikan agar website dapat digunakan dengan lebih baik. Mohon tunggu sebentar dan silakan kembali lagi nanti.';

notify pgrst, 'reload schema';
