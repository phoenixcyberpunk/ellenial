-- ellenial.app – anonymous, one-way feedback (23 Nov 2026). NOT APPLIED YET: waits for Ellen's yes.
-- Lives in the shared Supabase project (gillefeeling), like Split and the visit counters.
--
-- Stored per message: the kind (idea / broken / kind words), which app, the message (max 1,000
-- characters, plain text: Ellen, 23 Nov: text written to her is the accepted exception to "encrypted"),
-- when it came in, and whether she kept it. Nothing about the sender: no account, email, IP or cookie.
--
-- Spam: a hidden trap field (in the page), at most 200 messages per hour in total, and at most
-- 1,000 unread messages waiting. A flood can only fill those caps for a while, never grow the database.
--
-- Inbox: no sign-in or email. Ellen holds a long random inbox key (password manager); the database
-- keeps only its SHA-256 hash and checks it on every inbox call. Set or change it with:
--   update ellenial_feedback.settings set inbox_key_hash = sha256(convert_to('<the key>', 'UTF8')) where id = 1;
--
-- Visitors (public key) can only send. Only a caller holding the inbox key can list, keep or delete.

create schema if not exists ellenial_feedback;
revoke all on schema ellenial_feedback from public, anon, authenticated;

create table ellenial_feedback.settings (
  id             smallint primary key default 1 check (id = 1),
  inbox_key_hash bytea      -- SHA-256 of Ellen's inbox key; null = inbox closed
);
insert into ellenial_feedback.settings (id) values (1);

create table ellenial_feedback.messages (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null check (kind in ('idea', 'broken', 'kind')),
  app        text not null check (app ~ '^[a-z0-9-]{1,32}$'),
  message    text not null check (char_length(message) between 1 and 1000),
  created_at timestamptz not null default now(),
  kept       boolean not null default false
);
create index on ellenial_feedback.messages (created_at desc);

alter table ellenial_feedback.settings enable row level security;
alter table ellenial_feedback.messages enable row level security;
revoke all on all tables in schema ellenial_feedback from public, anon, authenticated;

-- Does the caller hold the inbox key?
create or replace function ellenial_feedback.is_owner(p_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    length(p_key) between 32 and 200
    and sha256(convert_to(p_key, 'UTF8')) = (select inbox_key_hash from ellenial_feedback.settings where id = 1),
    false);
$$;
revoke all on function ellenial_feedback.is_owner(text) from public;

-- Send one message (anyone).
create or replace function public.ellenial_feedback_send(p_kind text, p_app text, p_message text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_text text := btrim(p_message);
begin
  if p_kind is null or p_kind not in ('idea', 'broken', 'kind') or p_app is null or p_app !~ '^[a-z0-9-]{1,32}$'
     or v_text is null or char_length(v_text) < 1 or char_length(v_text) > 1000 then
    raise exception 'bad_request';
  end if;
  if (select count(*) from ellenial_feedback.messages where created_at > now() - interval '1 hour') >= 200 then
    raise exception 'rate_limited';
  end if;
  if (select count(*) from ellenial_feedback.messages where not kept) >= 1000 then
    raise exception 'inbox_full';
  end if;
  insert into ellenial_feedback.messages (kind, app, message) values (p_kind, p_app, v_text);
end;
$$;
revoke all on function public.ellenial_feedback_send(text, text, text) from public;
grant execute on function public.ellenial_feedback_send(text, text, text) to anon, authenticated;

-- Inbox (inbox key only).
create or replace function public.ellenial_feedback_inbox(p_key text)
returns table (id uuid, kind text, app text, message text, created_at timestamptz, kept boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not ellenial_feedback.is_owner(p_key) then raise exception 'not_allowed'; end if;
  return query
    select m.id, m.kind, m.app, m.message, m.created_at, m.kept
    from ellenial_feedback.messages m order by m.created_at desc limit 1000;
end;
$$;

create or replace function public.ellenial_feedback_keep(p_key text, p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not ellenial_feedback.is_owner(p_key) then raise exception 'not_allowed'; end if;
  update ellenial_feedback.messages set kept = true where id = p_id;
end;
$$;

create or replace function public.ellenial_feedback_delete(p_key text, p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not ellenial_feedback.is_owner(p_key) then raise exception 'not_allowed'; end if;
  delete from ellenial_feedback.messages where id = p_id;
end;
$$;

revoke all on function public.ellenial_feedback_inbox(text) from public;
revoke all on function public.ellenial_feedback_keep(text, uuid) from public;
revoke all on function public.ellenial_feedback_delete(text, uuid) from public;
grant execute on function public.ellenial_feedback_inbox(text) to anon, authenticated;
grant execute on function public.ellenial_feedback_keep(text, uuid) to anon, authenticated;
grant execute on function public.ellenial_feedback_delete(text, uuid) to anon, authenticated;
