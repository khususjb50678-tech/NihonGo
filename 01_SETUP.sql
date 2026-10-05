-- ITCO JAPAN — SETUP DATABASE (Jalankan PERTAMA)
-- Dibuat singkat agar aman dijalankan dari HP.

create extension if not exists pgcrypto;

do $$
begin
  if to_regclass('public.parts') is null then
    create table public.parts (
      id uuid primary key default gen_random_uuid(),
      part_number int not null unique check (part_number between 1 and 20),
      name text not null,
      description text,
      question_limit int,
      shuffle_questions boolean default true,
      shuffle_options boolean default true,
      active boolean default true,
      created_at timestamptz default now()
    );
  elsif exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='parts' and column_name='part_id'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='parts' and column_name='id'
  ) then
    alter table public.parts rename column part_id to id;
  end if;
end $$;

alter table public.questions add column if not exists photo_url text;
alter table public.questions add column if not exists audio_url text;
alter table public.questions add column if not exists audio_text text;

-- Ganti hanya Part 1–12 dari paket ini.
delete from public.questions q using public.parts p
where q.part_id=p.id and p.part_number between 1 and 12;
delete from public.parts where part_number between 1 and 12;

insert into public.parts (part_number,name,description,question_limit,shuffle_questions,shuffle_options,active) values
(1,'JFT Basic','JFT Basic — situasi sehari-hari dan komunikasi dasar.',NULL,true,true,true),
(2,'JFT N5','JFT N5 — komunikasi sederhana dengan konteks lebih beragam.',NULL,true,true,true),
(3,'JFT N4','JFT N4 — percakapan praktis dan urutan tindakan lebih panjang.',NULL,true,true,true),
(4,'JFT N3','JFT N3 — hubungan informasi dan konteks percakapan.',NULL,true,true,true),
(5,'JFT N2','JFT N2 — informasi rinci, alasan, urutan, dan perubahan situasi.',NULL,true,true,true),
(6,'JFT N1','JFT N1 — audio panjang, konteks kompleks, dan makna tersirat.',NULL,true,true,true),
(7,'JLPT Basic','JLPT Basic — latihan pola soal dan pemahaman situasi dasar.',NULL,true,true,true),
(8,'JLPT N5','JLPT N5 — kosakata, tata bahasa, dan situasi sehari-hari.',NULL,true,true,true),
(9,'JLPT N4','JLPT N4 — percakapan dan pola bahasa dasar-menengah.',NULL,true,true,true),
(10,'JLPT N3','JLPT N3 — konteks dan hubungan informasi lebih kompleks.',NULL,true,true,true),
(11,'JLPT N2','JLPT N2 — nuansa bahasa, alasan, sikap, dan informasi rinci.',NULL,true,true,true),
(12,'JLPT N1','JLPT N1 — implikasi, nuansa, dan konteks tingkat lanjut.',NULL,true,true,true);

notify pgrst, 'reload schema';
select part_number,name from public.parts where part_number between 1 and 12 order by part_number;
