-- The Archive 2.5.1: profile and discussion-author hardening
-- Run this once in Supabase SQL Editor. It is safe to run again.

begin;

-- Stop with a clear message if older data already contains duplicate nicknames.
-- No changes in this transaction will be saved if this check fails.
do $$
begin
  if exists (
    select 1
    from public.profiles
    group by lower(btrim(nickname))
    having count(*) > 1
  ) then
    raise exception
      'Duplicate nicknames already exist. Rename the duplicates before running this script.';
  end if;
end
$$;

-- A nickname cannot be blank after trimming spaces.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_nickname_trimmed_length'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_nickname_trimmed_length
      check (char_length(btrim(nickname)) between 1 and 30);
  end if;
end
$$;

-- Rosetta, rosetta, and " Rosetta " are treated as the same nickname.
create unique index if not exists profiles_nickname_unique_ci
  on public.profiles (lower(btrim(nickname)));

-- Keep full profile rows private. Mention autocomplete uses the separate,
-- nickname-only list_mentionable_readers() function.
drop policy if exists "Readers can see public profile names"
  on public.profiles;

-- Existing owner-only profile policies remain in effect.

-- Repair existing bylines so each post matches its author's current profile.
update public.chapter_posts post
set author_nickname = profile.nickname
from public.profiles profile
where profile.id = post.author_id
  and post.author_nickname is distinct from profile.nickname;

-- The database assigns both author fields from the authenticated account.
-- A modified browser request therefore cannot impersonate another nickname.
create or replace function public.set_chapter_post_author()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  canonical_nickname text;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required to create or edit a post.';
  end if;

  select profile.nickname
    into canonical_nickname
  from public.profiles profile
  where profile.id = auth.uid();

  if canonical_nickname is null then
    raise exception 'Complete your Archive profile before posting.';
  end if;

  new.author_id := auth.uid();
  new.author_nickname := canonical_nickname;
  return new;
end
$$;

revoke all on function public.set_chapter_post_author() from public;

drop trigger if exists chapter_posts_assign_author
  on public.chapter_posts;

create trigger chapter_posts_assign_author
before insert or update on public.chapter_posts
for each row execute function public.set_chapter_post_author();

commit;

-- Optional verification queries. They should return no duplicate rows,
-- and the policy list should not include "Readers can see public profile names".
select lower(btrim(nickname)) as normalized_nickname, count(*)
from public.profiles
group by lower(btrim(nickname))
having count(*) > 1;

select policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('profiles', 'chapter_posts')
order by tablename, policyname;
