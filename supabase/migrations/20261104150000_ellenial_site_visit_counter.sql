-- ellenial.app – daily visit counter (4 Nov 2026), same design as Luncheon's.
-- Applied to the shared Supabase project (gillefeeling) on 4 Nov 2026.
--   * One row per Stockholm day: just a date and a number. No ids, IPs or cookies.
--     The phone remembers that it was already counted today; the server only gets "+1".
--   * Nobody can read, set, add or delete rows with the public key. The only thing it can
--     do is call public.ellenial_count_visit(), which takes no input.
--   * A ceiling of 50,000 a day keeps a scripted flood from doing anything but hit the cap.
create schema if not exists ellenial_site;
revoke all on schema ellenial_site from public, anon, authenticated;

create table ellenial_site.daily_visits (
  day    date primary key,
  visits integer not null default 0 check (visits >= 0 and visits <= 50000)
);
alter table ellenial_site.daily_visits enable row level security;
revoke all on ellenial_site.daily_visits from public, anon, authenticated;

create or replace function public.ellenial_count_visit()
returns void
language sql
security definer
set search_path = ''
as $$
  insert into ellenial_site.daily_visits as d (day, visits)
  values ((now() at time zone 'Europe/Stockholm')::date, 1)
  on conflict (day) do update
    set visits = least(d.visits + 1, 50000);
$$;

revoke all on function public.ellenial_count_visit() from public;
grant execute on function public.ellenial_count_visit() to anon, authenticated;
