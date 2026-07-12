-- Archive 2.1: account-owned profiles and reading progress.
-- Idempotent and safe to run again in the Supabase SQL editor.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 30),
  reading_mode text not null default 'first' check (reading_mode in ('first','reread')),
  avatar_url text,
  onboarding_complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reading_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id text not null,
  current_chapter integer not null default 0 check (current_chapter >= 0),
  reading_status text not null default 'not-started' check (reading_status in ('not-started','reading','finished')),
  updated_at timestamptz not null default now(),
  primary key (user_id, book_id)
);

alter table public.profiles enable row level security;
alter table public.reading_progress enable row level security;
revoke all on public.profiles from anon;
revoke all on public.reading_progress from anon;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.reading_progress to authenticated;

drop policy if exists "Users can read their own profile" on public.profiles;
drop policy if exists "Users can create their own profile" on public.profiles;
drop policy if exists "Users can update their own profile" on public.profiles;
drop policy if exists "Users can delete their own profile" on public.profiles;
create policy "Users can read their own profile" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "Users can create their own profile" on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
create policy "Users can update their own profile" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy "Users can delete their own profile" on public.profiles for delete to authenticated using ((select auth.uid()) = id);

drop policy if exists "Users can read their own progress" on public.reading_progress;
drop policy if exists "Users can create their own progress" on public.reading_progress;
drop policy if exists "Users can update their own progress" on public.reading_progress;
drop policy if exists "Users can delete their own progress" on public.reading_progress;
create policy "Users can read their own progress" on public.reading_progress for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can create their own progress" on public.reading_progress for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update their own progress" on public.reading_progress for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can delete their own progress" on public.reading_progress for delete to authenticated using ((select auth.uid()) = user_id);
