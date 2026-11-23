-- Ellen's status dashboard: the Ellenial checker (23 Nov 2026).
-- Every 10 minutes pg_cron checks Ellenial's own sites and the outside sources they depend on,
-- and keeps one status row per thing in ops.status. Only Ellenial things live here; personal
-- projects are checked elsewhere. Nothing about visitors is read or stored.
-- Applied to the shared Supabase project (gillefeeling) on 23 Nov 2026.
create extension if not exists pg_net;
create schema if not exists ops;
revoke all on schema ops from public, anon, authenticated;

create table ops.checks (
  id text primary key,
  grp text not null,            -- 'app' | 'source' | 'infra'
  app text,                     -- which app it belongs to (for grouping on the page)
  label text not null,
  url text not null,
  kind text not null,           -- site | json | menus | gh_runs | gh_issues | rdap
  sort int not null default 100,
  headers jsonb not null default '{"User-Agent":"ellenial-status (github.com/phoenixcyberpunk/ellenial)"}'
);
create table ops.pending (request_id bigint primary key, check_id text not null, fired_at timestamptz not null default now());
create table ops.status (
  id text primary key,
  grp text not null,
  app text,
  label text not null,
  state text not null check (state in ('up','warn','down')),
  detail text,
  since timestamptz not null default now(),
  checked_at timestamptz not null default now(),
  fails int not null default 0,
  sort int not null default 100,
  link text
);
create table ops.meta (key text primary key, at timestamptz not null default now(), val jsonb);
alter table ops.checks enable row level security;
alter table ops.pending enable row level security;
alter table ops.status enable row level security;
alter table ops.meta enable row level security;

insert into ops.checks (id, grp, app, label, url, kind, sort) values
 ('site:library','app','library','Library','https://ellenial.app/','site',10),
 ('site:lunch','app','lunch','Lunch','https://lunch.ellenial.app/','site',20),
 ('site:maps','app','maps','ellenial maps','https://maps.ellenial.app/','site',30),
 ('site:weather','app','weather','Weather','https://weather.ellenial.app/','site',40),
 ('site:quiz','app','quiz','Quiz','https://quiz.ellenial.app/','site',50),
 ('site:poll','app','poll','Poll','https://poll.ellenial.app/','site',60),
 ('site:partygames','app','partygames','Party games','https://partygames.ellenial.app/','site',70),
 ('site:tv','app','partygames','Party games TV mode','https://tv.ellenial.app/','site',71),
 ('site:bingo','app','bingo','Bingo','https://bingo.ellenial.app/','site',80),
 ('site:present','app','present','Present','https://present.ellenial.app/','site',90),
 ('site:split','app','split','Split','https://split.ellenial.app/','site',100),
 ('site:gillefeeling','app','gillefeeling','Gillefeeling','https://gillefeeling.com/','site',110),
 ('lunch:menus','source','lunch','Lunch menus','https://lunch.ellenial.app/data/menus.json','menus',200),
 ('lunch:reader','source','lunch','Menu reader runs','https://api.github.com/repos/phoenixcyberpunk/ellenial-luncheon/actions/workflows/read-menus.yml/runs?per_page=1','gh_runs',201),
 ('lunch:alerts','source','lunch','Lunch alert issues','https://api.github.com/repos/phoenixcyberpunk/ellenial-luncheon/issues?state=open&per_page=50','gh_issues',202),
 ('maps:places','source','maps','Places data','https://maps.ellenial.app/data/sweden/index.json','json',300),
 ('maps:photos','source','maps','Photos (Cloudflare R2)','https://maps.ellenial.app/photos/000a6403d83159d4232a.jpg','site',301),
 ('maps:tiles','source','maps','Map tiles (OpenFreeMap)','https://tiles.openfreemap.org/planet','json',302),
 ('weather:smhi','source','weather','SMHI forecast','https://opendata-download-metfcst.smhi.se/api/category/snow1g/version/1/geotype/point/lon/11.9746/lat/57.7089/data.json','json',400),
 ('weather:openmeteo','source','weather','Open-Meteo','https://api.open-meteo.com/v1/forecast?latitude=57.71&longitude=11.97&current=temperature_2m','json',401),
 ('weather:metno','source','weather','MET Norway','https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=57.7089&lon=11.9746','json',402),
 ('domain:ellenial.app','infra',null,'ellenial.app renewal','https://pubapi.registry.google/rdap/domain/ellenial.app','rdap',900),
 ('domain:ellenial.org','infra',null,'ellenial.org renewal','https://rdap.publicinterestregistry.org/rdap/domain/ellenial.org','rdap',901);

-- One status row, keeping "since" when the state hasn't changed.
create or replace function ops.put(p_id text, p_state text, p_detail text, p_link text default null)
returns void language plpgsql as $$
declare c ops.checks; g text; a text; l text; s int;
begin
  select * into c from ops.checks where id = p_id;
  if found then g := c.grp; a := c.app; l := c.label; s := c.sort;
  else g := split_part(p_id, '|', 1); a := split_part(p_id, '|', 2); l := split_part(p_id, '|', 3); s := 210; end if;
  insert into ops.status as t (id, grp, app, label, state, detail, since, checked_at, fails, sort, link)
  values (p_id, g, a, l, p_state, p_detail, now(), now(), case when p_state = 'up' then 0 else 1 end, s, p_link)
  on conflict (id) do update set
    state = excluded.state, detail = excluded.detail, checked_at = now(), link = coalesce(excluded.link, t.link),
    label = excluded.label, sort = excluded.sort,
    since = case when t.state = excluded.state then t.since else now() end,
    fails = case when excluded.state = 'up' then 0 else t.fails + 1 end;
end $$;

create or replace function ops.fire() returns void language plpgsql as $$
declare c record;
begin
  for c in select * from ops.checks loop
    -- domains once a day; GitHub every 30 minutes (its anonymous limit is small)
    if c.kind = 'rdap' and exists (select 1 from ops.status where id = c.id and checked_at > now() - interval '23 hours') then continue; end if;
    if c.kind in ('gh_runs','gh_issues') and exists (select 1 from ops.status where id = c.id and checked_at > now() - interval '25 minutes') then continue; end if;
    insert into ops.pending (request_id, check_id)
    values (net.http_get(url := c.url, headers := c.headers, timeout_milliseconds := 20000), c.id);
  end loop;
end $$;

create or replace function ops.eval_menus(body jsonb) returns void language plpgsql as $$
declare p jsonb; sthlm timestamp := now() at time zone 'Europe/Stockholm'; today text := to_char(sthlm, 'YYYY-MM-DD');
  hhmm text := to_char(sthlm, 'HH24:MI'); weekday boolean := extract(isodow from sthlm) <= 5;
  prob text; st text; det text; n_daily int := 0; n_ok int := 0; n_bad int := 0;
begin
  for p in select * from jsonb_array_elements(body->'places') loop
    continue when p->>'kind' is distinct from 'daily';
    n_daily := n_daily + 1;
    prob := p->>'problem';
    if prob like today || ': %' and prob not like '%page read, but no menu for today%' then
      st := 'down'; det := 'Failing: ' || substr(prob, length(today) + 3);
    elsif p->>'menuDate' = today and prob is null then
      st := 'up'; det := 'Today''s menu read ' || to_char((p->>'readAt')::timestamptz at time zone 'Europe/Stockholm', 'HH24:MI');
    elsif weekday and hhmm >= '11:00' then
      st := 'warn'; det := 'Late: no menu for today yet';
    elsif not weekday then st := 'up'; det := 'Weekend';
    else st := 'up'; det := 'Waiting for today''s menu';
    end if;
    if st = 'up' then n_ok := n_ok + 1; else n_bad := n_bad + 1; end if;
    perform ops.put('source|lunch|' || (p->>'name'), st, det, p->>'url');
  end loop;
  perform ops.put('lunch:menus', case when n_bad = 0 then 'up' else 'warn' end,
    case when weekday then n_ok || ' of ' || n_daily || ' daily menus fine' else 'Weekend' end);
end $$;

create or replace function ops.collect() returns void language plpgsql as $$
declare r record; c ops.checks; ok boolean; body jsonb; st text; det text; t timestamptz; d int;
  sthlm timestamp := now() at time zone 'Europe/Stockholm';
begin
  for r in select p.request_id, p.check_id, p.fired_at, h.status_code, h.content, h.timed_out, h.error_msg
           from ops.pending p left join net._http_response h on h.id = p.request_id loop
    if r.status_code is null and r.error_msg is null and coalesce(r.timed_out, false) = false then
      continue when r.fired_at > now() - interval '60 seconds';   -- still waiting
    end if;
    delete from ops.pending where request_id = r.request_id;
    select * into c from ops.checks where id = r.check_id;
    continue when not found;
    ok := r.status_code between 200 and 399;
    begin
      if not ok then
        if c.kind in ('gh_runs','gh_issues') and r.status_code in (403, 429) then continue; end if;  -- rate limit: keep last state
        st := case when exists (select 1 from ops.status where id = c.id and state <> 'up') then 'down' else 'warn' end;
        det := coalesce('HTTP ' || r.status_code, case when r.timed_out then 'No answer in 20 s' else coalesce(r.error_msg, 'No answer') end);
        perform ops.put(c.id, st, det);
      elsif c.kind = 'site' then
        perform ops.put(c.id, 'up', 'HTTP ' || r.status_code);
      elsif c.kind = 'json' then
        body := r.content::jsonb;
        perform ops.put(c.id, 'up', 'Answering');
      elsif c.kind = 'menus' then
        perform ops.eval_menus(r.content::jsonb);
      elsif c.kind = 'gh_runs' then
        body := r.content::jsonb -> 'workflow_runs' -> 0;
        t := (body->>'created_at')::timestamptz;
        if body->>'conclusion' = 'failure' then st := 'warn'; det := 'Last run failed (' || to_char(t at time zone 'Europe/Stockholm', 'Dy HH24:MI') || ')';
        elsif extract(isodow from sthlm) <= 5 and sthlm::time between '06:45' and '12:00' and t < now() - interval '75 minutes' then
          st := 'warn'; det := 'No run since ' || to_char(t at time zone 'Europe/Stockholm', 'HH24:MI') || ' (GitHub skipped, backup timer didn''t catch it)';
        else st := 'up'; det := 'Last run ' || to_char(t at time zone 'Europe/Stockholm', 'Dy HH24:MI');
        end if;
        perform ops.put(c.id, st, det, body->>'html_url');
      elsif c.kind = 'gh_issues' then
        body := coalesce((select jsonb_agg(jsonb_build_object('title', i->>'title', 'url', i->>'html_url', 'since', i->>'created_at'))
                 from jsonb_array_elements(r.content::jsonb) i where i->>'title' like 'Lunch alert: %' and i->'pull_request' is null), '[]');
        insert into ops.meta (key, at, val) values ('lunch_alerts', now(), body)
          on conflict (key) do update set at = now(), val = excluded.val;
        perform ops.put(c.id, case when jsonb_array_length(body) = 0 then 'up' else 'warn' end,
          case when jsonb_array_length(body) = 0 then 'No open alerts' else jsonb_array_length(body) || ' open' end,
          'https://github.com/phoenixcyberpunk/ellenial-luncheon/issues');
      elsif c.kind = 'rdap' then
        body := r.content::jsonb;
        t := (select (e->>'eventDate')::timestamptz from jsonb_array_elements(body->'events') e where e->>'eventAction' = 'expiration' limit 1);
        d := extract(day from t - now());
        perform ops.put(c.id, case when d < 7 then 'down' when d < 30 then 'warn' else 'up' end,
          'Renews ' || to_char(t, 'DD Mon YYYY') || ' (' || d || ' days)');
      end if;
    exception when others then
      perform ops.put(c.id, 'warn', 'Answered, but not as expected: ' || left(sqlerrm, 80));
    end;
  end loop;
  -- the database itself, against the free 500 MB
  d := (pg_database_size(current_database()) / 1048576)::int;
  perform ops.put('infra|supabase|Supabase database', case when d > 450 then 'down' when d > 400 then 'warn' else 'up' end,
    d || ' of 500 MB (' || (d * 100 / 500) || '%)');
end $$;

create or replace function ops.tick() returns void language plpgsql as $$
begin
  perform ops.collect();
  perform ops.fire();
  insert into ops.meta (key, at) values ('last_tick', now()) on conflict (key) do update set at = now();
  delete from ops.status where id like 'source|lunch|%' and checked_at < now() - interval '2 days';  -- places removed from Lunch
end $$;

-- What the alert workflow on GitHub may read with the public key: Ellenial's own public-site
-- states and the checker's heartbeat. Nothing else.
create or replace function public.ellenial_status()
returns table (id text, label text, state text, detail text, since timestamptz, fails int, last_tick timestamptz)
language sql security definer set search_path = '' as $$
  select s.id, s.label, s.state, s.detail, s.since, s.fails, (select at from ops.meta where key = 'last_tick')
  from ops.status s where s.grp in ('app','infra') or s.id in ('maps:places','maps:photos','lunch:reader')
  union all
  select 'heartbeat', 'Status checker', 'up', null, null, 0, (select at from ops.meta where key = 'last_tick')
$$;
revoke all on function public.ellenial_status() from public;
grant execute on function public.ellenial_status() to anon;

select cron.schedule('ops-status-tick', '*/10 * * * *', 'select ops.tick()');
select cron.schedule('ops-net-cleanup', '33 4 * * *', $$delete from ops.pending where fired_at < now() - interval '1 hour'$$);
