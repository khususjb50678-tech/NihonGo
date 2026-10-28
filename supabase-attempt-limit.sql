-- Jalankan sekali di Supabase (SQL Editor): batas kesempatan mengerjakan per Part
alter table public.parts add column if not exists max_attempts integer not null default 1 check (max_attempts >= 1);

-- Info untuk user: sudah berapa kali dikerjakan dan batasnya
create or replace function public.attempt_info(p_part text)
returns jsonb language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'max', coalesce((select max_attempts from public.parts where id::text = p_part), 1),
    'used', (select count(*) from public.results where user_id = auth.uid() and part_id::text = p_part)
  )
$$;
grant execute on function public.attempt_info(text) to authenticated;

-- Penjaga di database: hasil baru ditolak kalau kesempatan sudah habis (tidak bisa diakali dari website)
create or replace function public.check_attempt_limit()
returns trigger language plpgsql security definer set search_path = public
as $$
declare maxa int; used int;
begin
  if new.user_id is null or new.part_id is null then return new; end if;
  select coalesce(max_attempts, 1) into maxa from public.parts where id = new.part_id;
  select count(*) into used from public.results where user_id = new.user_id and part_id = new.part_id;
  if used >= coalesce(maxa, 1) then
    raise exception 'Kesempatan mengerjakan Part ini sudah habis' using errcode = 'P0001';
  end if;
  return new;
end
$$;
drop trigger if exists results_attempt_limit on public.results;
create trigger results_attempt_limit before insert on public.results
  for each row execute function public.check_attempt_limit();
