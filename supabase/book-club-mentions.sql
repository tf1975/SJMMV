-- The Archive: synced chapter posts and @mentions

create table if not exists public.chapter_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  author_nickname text not null,
  book_id text not null,
  chapter_number integer not null check (chapter_number > 0),
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create table if not exists public.mentions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.chapter_posts(id) on delete cascade,
  mentioned_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  unique (post_id, mentioned_user_id)
);

create index if not exists chapter_posts_chapter_idx on public.chapter_posts(book_id, chapter_number, created_at);
create index if not exists mentions_recipient_idx on public.mentions(mentioned_user_id, created_at desc);

alter table public.chapter_posts enable row level security;
alter table public.mentions enable row level security;

grant select, insert, update, delete on public.chapter_posts to authenticated;
grant select, insert, update, delete on public.mentions to authenticated;
grant select on public.profiles to authenticated;

drop policy if exists "Signed in readers can view chapter posts" on public.chapter_posts;
drop policy if exists "Readers can create their own posts" on public.chapter_posts;
drop policy if exists "Readers can update their own posts" on public.chapter_posts;
drop policy if exists "Readers can delete their own posts" on public.chapter_posts;
drop policy if exists "Readers can see public profile names" on public.profiles;
drop policy if exists "Readers can create mentions from their posts" on public.mentions;
drop policy if exists "Readers can view mentions involving them" on public.mentions;
drop policy if exists "Mentioned readers can mark mentions read" on public.mentions;
drop policy if exists "Post authors can delete their mentions" on public.mentions;

create policy "Signed in readers can view chapter posts" on public.chapter_posts
for select to authenticated using (
  author_id = (select auth.uid()) or
  exists (
    select 1 from public.reading_progress progress
    where progress.user_id = (select auth.uid())
      and progress.book_id = chapter_posts.book_id
      and (
        progress.reading_status = 'finished' or
        (progress.reading_status = 'reading' and chapter_posts.chapter_number < progress.current_chapter)
      )
  )
);

create policy "Readers can create their own posts" on public.chapter_posts
for insert to authenticated with check ((select auth.uid()) = author_id);

create policy "Readers can update their own posts" on public.chapter_posts
for update to authenticated using ((select auth.uid()) = author_id) with check ((select auth.uid()) = author_id);

create policy "Readers can delete their own posts" on public.chapter_posts
for delete to authenticated using ((select auth.uid()) = author_id);

create policy "Readers can see public profile names" on public.profiles
for select to authenticated using (true);

create policy "Readers can create mentions from their posts" on public.mentions
for insert to authenticated with check (
  exists (select 1 from public.chapter_posts post where post.id = post_id and post.author_id = (select auth.uid()))
);

create policy "Readers can view mentions involving them" on public.mentions
for select to authenticated using (
  (
    mentioned_user_id = (select auth.uid()) and
    exists (
      select 1
      from public.chapter_posts post
      join public.reading_progress progress
        on progress.user_id = (select auth.uid())
       and progress.book_id = post.book_id
      where post.id = post_id
        and (
          progress.reading_status = 'finished' or
          (progress.reading_status = 'reading' and post.chapter_number < progress.current_chapter)
        )
    )
  ) or
  exists (select 1 from public.chapter_posts post where post.id = post_id and post.author_id = (select auth.uid()))
);

create policy "Mentioned readers can mark mentions read" on public.mentions
for update to authenticated using (mentioned_user_id = (select auth.uid()))
with check (mentioned_user_id = (select auth.uid()));

create policy "Post authors can delete their mentions" on public.mentions
for delete to authenticated using (
  exists (select 1 from public.chapter_posts post where post.id = post_id and post.author_id = (select auth.uid()))
);

-- Signup can check a public-facing nickname before creating an account.
-- The unique index remains the authoritative protection against races.
create or replace function public.nickname_available(candidate text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    char_length(btrim(candidate)) between 1 and 30
    and not exists (
      select 1
      from public.profiles
      where lower(btrim(nickname)) = lower(btrim(candidate))
    );
$$;

revoke all on function public.nickname_available(text) from public;
grant execute on function public.nickname_available(text) to anon, authenticated;

-- Autocomplete exposes only the public nickname needed for @mentions.
create or replace function public.list_mentionable_readers()
returns table (id uuid, nickname text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select profile.id, profile.nickname
  from public.profiles profile
  where profile.id <> (select auth.uid())
    and profile.onboarding_complete = true
    and char_length(btrim(profile.nickname)) > 0
  order by lower(profile.nickname);
$$;

revoke all on function public.list_mentionable_readers() from public;
grant execute on function public.list_mentionable_readers() to authenticated;
