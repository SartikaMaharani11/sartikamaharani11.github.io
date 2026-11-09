-- Run once in Supabase SQL Editor. No bot token or privileged key is needed here.
begin;

create or replace function public.current_week() returns date
language sql stable set search_path = '' as $$
  select date_trunc('week', now() at time zone 'Europe/Moscow')::date;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  telegram_username text,
  avatar_url text,
  accent_color text not null default '#c2e6d9' check (accent_color ~ '^#[0-9a-fA-F]{6}$'),
  created_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 180),
  difficulty smallint not null check (difficulty between 1 and 4),
  mode text not null check (mode in ('count', 'percent')),
  target integer not null check (target between 1 and 999),
  progress integer not null default 0 check (progress >= 0 and progress <= target),
  week_start date not null default public.current_week(),
  origin_week date not null default public.current_week(),
  rolled_from uuid unique references public.tasks(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (mode <> 'percent' or target = 100),
  check (extract(isodow from week_start) = 1),
  check (origin_week <= week_start)
);
create index tasks_owner_week on public.tasks(owner_id, week_start);
create index tasks_week on public.tasks(week_start);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, display_name, telegram_username, avatar_url)
  values (new.id,
    left(coalesce(nullif(new.raw_user_meta_data->>'name', ''), nullif(new.raw_user_meta_data->>'full_name', ''), 'Участник'), 80),
    new.raw_user_meta_data->>'preferred_username',
    coalesce(new.raw_user_meta_data->>'picture', new.raw_user_meta_data->>'avatar_url'));
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Also supports users who signed in before this migration.
insert into public.profiles(id, display_name, telegram_username, avatar_url)
select id, left(coalesce(nullif(raw_user_meta_data->>'name', ''), 'Участник'), 80),
  raw_user_meta_data->>'preferred_username', raw_user_meta_data->>'picture'
from auth.users on conflict (id) do nothing;

create or replace function public.guard_task_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.id is distinct from old.id or new.owner_id is distinct from old.owner_id
    or new.week_start is distinct from old.week_start or new.origin_week is distinct from old.origin_week
    or new.rolled_from is distinct from old.rolled_from or new.created_at is distinct from old.created_at then
    raise exception 'Task identity and week cannot be changed';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger task_update_guard before update on public.tasks
  for each row execute function public.guard_task_update();

alter table public.profiles enable row level security;
alter table public.tasks enable row level security;

-- Everyone who has signed in can see everyone. Anonymous visitors see nothing.
create policy profiles_read on public.profiles for select to authenticated using (true);
create policy profiles_update_own on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy tasks_read on public.tasks for select to authenticated using (true);
create policy tasks_insert_own on public.tasks for insert to authenticated
  with check ((select auth.uid()) = owner_id and week_start = public.current_week()
    and origin_week = public.current_week() and rolled_from is null and deleted_at is null);
create policy tasks_update_own on public.tasks for update to authenticated
  using ((select auth.uid()) = owner_id and week_start = public.current_week() and deleted_at is null)
  with check ((select auth.uid()) = owner_id and week_start = public.current_week());

revoke all on public.profiles, public.tasks from anon;
revoke all on public.profiles, public.tasks from authenticated;
grant select on public.profiles to authenticated;
grant update(display_name, accent_color) on public.profiles to authenticated;
grant select, insert on public.tasks to authenticated;
grant update(title, difficulty, mode, target, progress, deleted_at) on public.tasks to authenticated;

-- Immutable weekly instances preserve last week's statistics. Only open leaf tasks
-- move forward. A profile row lock serializes simultaneous requests on two devices.
create or replace function public.roll_week() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  caller uuid := auth.uid();
  this_week date := public.current_week();
  moved integer;
begin
  if caller is null then raise exception 'Authentication required'; end if;
  perform 1 from public.profiles where id = caller for update;
  insert into public.tasks(owner_id, title, difficulty, mode, target, progress,
    week_start, origin_week, rolled_from)
  select t.owner_id, t.title, t.difficulty, t.mode, t.target, t.progress,
    this_week, t.origin_week, t.id
  from public.tasks t
  where t.owner_id = caller and t.week_start < this_week and t.progress < t.target and t.deleted_at is null
    and not exists (select 1 from public.tasks child where child.rolled_from = t.id)
  on conflict (rolled_from) do nothing;
  get diagnostics moved = row_count;
  return moved;
end;
$$;
revoke all on function public.roll_week() from public, anon;
grant execute on function public.roll_week() to authenticated;

-- One atomic UPDATE, so simultaneous taps on different devices do not lose steps.
-- SECURITY INVOKER keeps ordinary ownership RLS and column grants in force.
create or replace function public.increment_task(task_id uuid) returns setof public.tasks
language sql security invoker set search_path = '' as $$
  update public.tasks set progress = least(target, progress + case when mode = 'percent' then 10 else 1 end)
  where id = task_id and owner_id = auth.uid() and week_start = public.current_week() and deleted_at is null
  returning *;
$$;
revoke all on function public.increment_task(uuid) from public, anon;
grant execute on function public.increment_task(uuid) to authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.guard_task_update() from public, anon, authenticated;

commit;
