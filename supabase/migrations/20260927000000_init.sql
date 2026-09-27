-- Murph in Progress: invited participants, private entries, leaderboard profiles and weekly points.
-- Invitations and participant email addresses live only in the database, never in this public repository.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

-- Invitations: managed by the project owner in SQL. No client role can read or write them.
create table private.invitations (
  email text primary key check (email = lower(btrim(email)) and position('@' in email) > 1),
  invited_at timestamptz not null default now()
);
alter table private.invitations enable row level security;
revoke all on private.invitations from public, anon, authenticated;

-- A participant is a signed-in user whose confirmed email matches an invitation.
create or replace function private.is_participant()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from auth.users u
    join private.invitations i on i.email = lower(u.email)
    where u.id = auth.uid() and u.email_confirmed_at is not null
  );
$$;
revoke all on function private.is_participant() from public, anon;
grant execute on function private.is_participant() to authenticated;

-- Entries: one row per tap. Totals and scores are always derived, never stored.
create table public.entries (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  entry_id uuid not null,
  occurred_at timestamptz not null,
  local_date date not null check (local_date >= date '2020-01-01'),
  timezone text not null default 'Australia/Sydney' check (char_length(timezone) between 1 and 64),
  exercise text not null check (exercise in ('run', 'pull', 'push', 'squat')),
  quantity integer not null check (quantity between 1 and 1000000),
  unit text generated always as (case when exercise = 'run' then 'm' else 'reps' end) stored,
  session_id uuid,
  target_version text not null default 'rounded-km-v1' check (char_length(target_version) between 1 and 40),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, entry_id)
);
create index entries_user_updated_idx on public.entries (user_id, updated_at);
create index entries_live_date_idx on public.entries (local_date, user_id) where deleted_at is null;

-- Server-owned timestamps; deletion is permanent so an undone entry can never return from another device or an old backup.
create or replace function private.entries_before_write()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.local_date > (now() at time zone 'Australia/Sydney')::date + 1 then
      raise exception 'local_date % is in the future', new.local_date using errcode = '22023';
    end if;
    new.created_at := now();
    if new.deleted_at is not null then new.deleted_at := now(); end if;
  else
    if old.deleted_at is not null then
      new.deleted_at := old.deleted_at;
    elsif new.deleted_at is not null then
      new.deleted_at := now();
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger entries_before_write before insert or update on public.entries
  for each row execute function private.entries_before_write();

alter table public.entries enable row level security;
revoke all on public.entries from public, anon, authenticated;
grant select on public.entries to authenticated;
grant insert (user_id, entry_id, occurred_at, local_date, timezone, exercise, quantity, session_id, target_version, deleted_at)
  on public.entries to authenticated;
grant update (deleted_at) on public.entries to authenticated;

create policy "Participants read their own entries" on public.entries
  for select to authenticated
  using (user_id = (select auth.uid()) and (select private.is_participant()));
create policy "Participants add their own entries" on public.entries
  for insert to authenticated
  with check (user_id = (select auth.uid()) and (select private.is_participant()));
create policy "Participants mark their own entries deleted" on public.entries
  for update to authenticated
  using (user_id = (select auth.uid()) and (select private.is_participant()))
  with check (user_id = (select auth.uid()) and (select private.is_participant()));

-- Profiles: leaderboard name and opt-in. Clients only touch these through the functions below.
create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  leaderboard_name text check (leaderboard_name is null or (char_length(leaderboard_name) between 1 and 24 and leaderboard_name = btrim(leaderboard_name))),
  show_on_leaderboard boolean not null default false,
  updated_at timestamptz not null default now(),
  check (not show_on_leaderboard or leaderboard_name is not null)
);
create unique index profiles_leaderboard_name_key on public.profiles (lower(leaderboard_name));
alter table public.profiles enable row level security;
revoke all on public.profiles from public, anon, authenticated;

create or replace function public.my_status()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'participant', private.is_participant(),
    'leaderboard_name', p.leaderboard_name,
    'show_on_leaderboard', coalesce(p.show_on_leaderboard, false)
  )
  from (select 1) as one
  left join public.profiles p on p.user_id = auth.uid() and private.is_participant();
$$;

create or replace function public.save_profile(p_leaderboard_name text, p_show boolean)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_name text := nullif(btrim(p_leaderboard_name), '');
begin
  if not private.is_participant() then
    raise exception 'This account is not invited' using errcode = '42501';
  end if;
  if coalesce(p_show, false) and v_name is null then
    raise exception 'Choose a leaderboard name first' using errcode = '22023';
  end if;
  insert into public.profiles (user_id, leaderboard_name, show_on_leaderboard, updated_at)
  values (auth.uid(), v_name, coalesce(p_show, false), now())
  on conflict (user_id) do update
    set leaderboard_name = excluded.leaderboard_name,
        show_on_leaderboard = excluded.show_on_leaderboard,
        updated_at = now();
  return public.my_status();
end;
$$;

-- Weekly points: the sum of daily Murph scores (each exercise capped at 100%) over a Monday-Sunday Sydney week.
-- Returns only opted-in, currently invited participants, and only to participants. Individual entries never leave the database.
create or replace function public.leaderboard(week_offset integer default 0)
returns table (rank integer, leaderboard_name text, points numeric, active_days integer, is_me boolean, week_start date)
language sql stable security definer set search_path = ''
as $$
  with week as (
    select date_trunc('week', now() at time zone 'Australia/Sydney')::date + 7 * week_offset as start
  ),
  members as (
    select p.user_id, p.leaderboard_name
    from public.profiles p
    join auth.users u on u.id = p.user_id
    join private.invitations i on i.email = lower(u.email)
    where p.show_on_leaderboard and p.leaderboard_name is not null and u.email_confirmed_at is not null
  ),
  totals as (
    select e.user_id, e.local_date, e.exercise, sum(e.quantity) as qty
    from public.entries e
    join members m on m.user_id = e.user_id
    cross join week w
    where e.deleted_at is null and e.local_date >= w.start and e.local_date < w.start + 7
    group by e.user_id, e.local_date, e.exercise
  ),
  daily as (
    select user_id, local_date,
      25 * sum(least(1.0, qty::numeric / case exercise when 'run' then 3200 when 'pull' then 100 when 'push' then 200 else 300 end)) as score
    from totals
    group by user_id, local_date
  ),
  scored as (
    select m.user_id, m.leaderboard_name, round(coalesce(sum(d.score), 0), 1) as points, count(d.local_date)::integer as active_days
    from members m
    left join daily d on d.user_id = m.user_id
    group by m.user_id, m.leaderboard_name
  )
  select (rank() over (order by s.points desc))::integer, s.leaderboard_name, s.points, s.active_days, s.user_id = auth.uid(), w.start
  from scored s cross join week w
  where (select private.is_participant()) and week_offset between -52 and 0
  order by 1, 2;
$$;

revoke all on function public.my_status() from public, anon;
revoke all on function public.save_profile(text, boolean) from public, anon;
revoke all on function public.leaderboard(integer) from public, anon;
grant execute on function public.my_status() to authenticated;
grant execute on function public.save_profile(text, boolean) to authenticated;
grant execute on function public.leaderboard(integer) to authenticated;

-- Auth hook: refuse to create an account for an email without an invitation (enabled in the project's auth config).
create or replace function public.hook_before_user_created(event jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  if exists (select 1 from private.invitations i where i.email = lower(event -> 'user' ->> 'email')) then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object('error', jsonb_build_object(
    'http_code', 403,
    'message', 'Murph in Progress is invite-only. Ask for an invitation first.'
  ));
end;
$$;
revoke all on function public.hook_before_user_created(jsonb) from public, anon, authenticated;
grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;
