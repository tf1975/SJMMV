-- Archive 2.1: per-user, per-book preferences.
-- Safe to run more than once in the Supabase SQL editor.

create table if not exists public.user_book_settings (
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id text not null,
  spoiler_mode text not null default 'safe'
    check (spoiler_mode in ('safe', 'full')),
  rereading boolean not null default false,
  bookmarked_chapters integer[] not null default '{}',
  favorite_quotes jsonb not null default '[]'::jsonb,
  ui_preferences jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, book_id)
);

alter table public.user_book_settings enable row level security;
grant usage on schema public to authenticated;
revoke all on public.user_book_settings from anon;
grant select, insert, update, delete on public.user_book_settings to authenticated;

drop policy if exists "Users can read their own book settings" on public.user_book_settings;
drop policy if exists "Users can create their own book settings" on public.user_book_settings;
drop policy if exists "Users can update their own book settings" on public.user_book_settings;
drop policy if exists "Users can delete their own book settings" on public.user_book_settings;

create policy "Users can read their own book settings"
on public.user_book_settings for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create their own book settings"
on public.user_book_settings for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their own book settings"
on public.user_book_settings for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete their own book settings"
on public.user_book_settings for delete to authenticated
using ((select auth.uid()) = user_id);
