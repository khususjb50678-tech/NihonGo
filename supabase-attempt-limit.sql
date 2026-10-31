-- Jalankan di Supabase (SQL Editor). Aman dijalankan ulang.
-- Batas kesempatan mengerjakan per Part: 0 = tanpa batas (bawaan), 1 = sekali, 2 = dua kali, dst.
alter table public.parts add column if not exists max_attempts integer not null default 0;
alter table public.parts alter column max_attempts set default 0;
alter table public.parts drop constraint if exists parts_max_attempts_check;
alter table public.parts add constraint parts_max_attempts_check check (max_attempts >= 0);

-- Semua Part yang masih bernilai 1 (bawaan sebelumnya) dikembalikan ke tanpa batas.
-- Part yang sudah kamu atur ke 2 atau lebih tidak diubah.
update public.parts set max_attempts = 0 where max_attempts = 1;

create or replace function public.attempt_info(p_part text)
returns jsonb language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'max', coalesce((select max_attempts from public.parts where id::text = p_part), 0),
    'used', (select count(*) from public.results where user_id = auth.uid() and part_id::text = p_part)
  )
$$;
grant execute on function public.attempt_info(text) to authenticated;

create or replace function public.check_attempt_limit()
returns trigger language plpgsql security definer set search_path = public
as $$
declare maxa int; used int;
begin
  if new.user_id is null or new.part_id is null then return new; end if;
  select coalesce(max_attempts, 0) into maxa from public.parts where id = new.part_id;
  if coalesce(maxa, 0) = 0 then return new; end if;
  select count(*) into used from public.results where user_id = new.user_id and part_id = new.part_id;
  if used >= maxa then
    raise exception 'Kesempatan mengerjakan Part ini sudah habis' using errcode = 'P0001';
  end if;
  return new;
end
$$;
drop trigger if exists results_attempt_limit on public.results;
create trigger results_attempt_limit before insert on public.results
  for each row execute function public.check_attempt_limit();

notify pgrst, 'reload schema';
