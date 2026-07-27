-- The Archive 2.6: shared Book Club, songs, art, theories, events, and letters.
-- Safe to rerun. Run this entire file in the Supabase SQL Editor.

begin;

alter table public.mentions add column if not exists email_sent_at timestamptz;

create or replace function public.reader_has_reached(reader uuid, target_book text, target_chapter integer, require_finished boolean default false)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  progress_row public.reading_progress%rowtype;
  tandem_done integer;
begin
  if target_book = 'tandem' then
    select coalesce((ui_preferences->>'tandemStep')::integer, 0)
      into tandem_done
      from public.user_book_settings
     where user_id = reader and book_id = 'tog-plan';
    if require_finished then return coalesce(tandem_done, 0) >= 50; end if;
    return coalesce(tandem_done, 0) >= greatest(target_chapter, 0);
  end if;

  select * into progress_row
    from public.reading_progress
   where user_id = reader and book_id = target_book;
  if not found then return false; end if;
  if require_finished then return progress_row.reading_status = 'finished'; end if;
  return progress_row.reading_status = 'finished'
    or (progress_row.reading_status = 'reading' and progress_row.current_chapter > target_chapter);
end;
$$;

revoke all on function public.reader_has_reached(uuid,text,integer,boolean) from public;
grant execute on function public.reader_has_reached(uuid,text,integer,boolean) to authenticated;

-- Reuse the same spoiler rule for ordinary and tandem chapter discussions.
drop policy if exists "Signed in readers can view chapter posts" on public.chapter_posts;
create policy "Signed in readers can view chapter posts" on public.chapter_posts
for select to authenticated using (
  author_id=(select auth.uid()) or public.reader_has_reached((select auth.uid()),book_id,chapter_number,false)
);
drop policy if exists "Readers can view mentions involving them" on public.mentions;
create policy "Readers can view mentions involving them" on public.mentions
for select to authenticated using (
  exists (select 1 from public.chapter_posts post where post.id=post_id and post.author_id=(select auth.uid()))
  or (
    mentioned_user_id=(select auth.uid())
    and exists (select 1 from public.chapter_posts post where post.id=post_id and public.reader_has_reached((select auth.uid()),post.book_id,post.chapter_number,false))
  )
);

create table if not exists public.club_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  author_nickname text not null,
  body text not null check (char_length(btrim(body)) between 1 and 1200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reader_submissions (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  author_nickname text not null,
  kind text not null check (kind in ('song','art')),
  book_id text not null,
  chapter_number integer check (chapter_number is null or chapter_number > 0),
  placement text not null check (placement in ('book-start','chapter','book-end')),
  title text not null check (char_length(btrim(title)) between 1 and 160),
  artist text check (artist is null or char_length(artist) <= 160),
  note text check (note is null or char_length(note) <= 1000),
  external_url text check (external_url is null or external_url ~ '^https://'),
  storage_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((kind = 'song' and storage_path is null) or (kind = 'art' and storage_path is not null)),
  check ((placement = 'chapter' and chapter_number is not null) or (placement <> 'chapter' and chapter_number is null))
);

create table if not exists public.reader_theories (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  author_nickname text not null,
  title text not null check (char_length(btrim(title)) between 1 and 140),
  body text not null check (char_length(btrim(body)) between 1 and 3000),
  book_id text not null,
  chapter_number integer not null check (chapter_number > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reader_events (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  author_nickname text not null,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  starts_at timestamptz not null,
  location text not null check (char_length(btrim(location)) between 1 and 180),
  details text check (details is null or char_length(details) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dear_sarah_letters (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  author_nickname text not null,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.archivist_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  requested_at timestamptz not null default now()
);
alter table public.archivist_usage enable row level security;
revoke all on public.archivist_usage from anon,authenticated;
create index if not exists archivist_usage_limit_idx on public.archivist_usage(user_id,requested_at desc);

create or replace function public.claim_archivist_request()
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare requester uuid := auth.uid(); recent_count integer;
begin
  if requester is null then return false; end if;
  select count(*) into recent_count from public.archivist_usage where user_id=requester and requested_at > now()-interval '1 hour';
  if recent_count >= 20 then return false; end if;
  insert into public.archivist_usage(user_id) values(requester);
  delete from public.archivist_usage where requested_at < now()-interval '30 days';
  return true;
end;
$$;
revoke all on function public.claim_archivist_request() from public;
grant execute on function public.claim_archivist_request() to authenticated;

create index if not exists club_posts_created_idx on public.club_posts(created_at desc);
create index if not exists reader_submissions_context_idx on public.reader_submissions(book_id,placement,chapter_number,created_at desc);
create index if not exists reader_theories_context_idx on public.reader_theories(book_id,chapter_number,created_at desc);
create index if not exists reader_events_starts_idx on public.reader_events(starts_at);

create or replace function public.set_community_author()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare canonical_nickname text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select nickname into canonical_nickname from public.profiles where id = auth.uid();
  if canonical_nickname is null then raise exception 'Complete your Archive profile first'; end if;
  new.author_id := auth.uid();
  new.author_nickname := canonical_nickname;
  if to_jsonb(new) ? 'updated_at' then new.updated_at := now(); end if;
  return new;
end;
$$;

revoke all on function public.set_community_author() from public;

do $$
declare table_name text;
begin
  foreach table_name in array array['club_posts','reader_submissions','reader_theories','reader_events','dear_sarah_letters'] loop
    execute format('drop trigger if exists assign_community_author on public.%I', table_name);
    execute format('create trigger assign_community_author before insert or update on public.%I for each row execute function public.set_community_author()', table_name);
  end loop;
end $$;

alter table public.club_posts enable row level security;
alter table public.reader_submissions enable row level security;
alter table public.reader_theories enable row level security;
alter table public.reader_events enable row level security;
alter table public.dear_sarah_letters enable row level security;

grant select,insert,update,delete on public.club_posts,public.reader_submissions,public.reader_theories,public.reader_events,public.dear_sarah_letters to authenticated;
revoke all on public.club_posts,public.reader_submissions,public.reader_theories,public.reader_events,public.dear_sarah_letters from anon;

do $$
declare row record;
begin
  for row in select schemaname,tablename,policyname from pg_policies where schemaname='public' and tablename in ('club_posts','reader_submissions','reader_theories','reader_events','dear_sarah_letters') loop
    execute format('drop policy if exists %I on %I.%I', row.policyname, row.schemaname, row.tablename);
  end loop;
end $$;

create policy "Readers can view the club bulletin" on public.club_posts for select to authenticated using (true);
create policy "Readers can add club posts" on public.club_posts for insert to authenticated with check (author_id = (select auth.uid()));
create policy "Readers can update their club posts" on public.club_posts for update to authenticated using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()));
create policy "Readers can delete their club posts" on public.club_posts for delete to authenticated using (author_id = (select auth.uid()));

create policy "Readers can view safe submissions" on public.reader_submissions for select to authenticated using (
  author_id = (select auth.uid()) or placement = 'book-start'
  or (placement = 'chapter' and public.reader_has_reached((select auth.uid()),book_id,chapter_number,false))
  or (placement = 'book-end' and public.reader_has_reached((select auth.uid()),book_id,0,true))
);
create policy "Readers can add reached submissions" on public.reader_submissions for insert to authenticated with check (
  author_id = (select auth.uid()) and (
    placement = 'book-start'
    or (placement = 'chapter' and public.reader_has_reached((select auth.uid()),book_id,chapter_number,false))
    or (placement = 'book-end' and public.reader_has_reached((select auth.uid()),book_id,0,true))
  )
);
create policy "Readers can update their submissions" on public.reader_submissions for update to authenticated using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()));
create policy "Readers can delete their submissions" on public.reader_submissions for delete to authenticated using (author_id = (select auth.uid()));

create policy "Readers can view safe theories" on public.reader_theories for select to authenticated using (author_id = (select auth.uid()) or public.reader_has_reached((select auth.uid()),book_id,chapter_number,false));
create policy "Readers can add reached theories" on public.reader_theories for insert to authenticated with check (author_id = (select auth.uid()) and public.reader_has_reached((select auth.uid()),book_id,chapter_number,false));
create policy "Readers can update their theories" on public.reader_theories for update to authenticated using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()));
create policy "Readers can delete their theories" on public.reader_theories for delete to authenticated using (author_id = (select auth.uid()));

create policy "Readers can view events" on public.reader_events for select to authenticated using (true);
create policy "Readers can add events" on public.reader_events for insert to authenticated with check (author_id = (select auth.uid()));
create policy "Readers can update their events" on public.reader_events for update to authenticated using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()));
create policy "Readers can delete their events" on public.reader_events for delete to authenticated using (author_id = (select auth.uid()));

create policy "Readers can view community letters" on public.dear_sarah_letters for select to authenticated using (true);
create policy "Readers can add community letters" on public.dear_sarah_letters for insert to authenticated with check (author_id = (select auth.uid()));
create policy "Readers can delete their community letters" on public.dear_sarah_letters for delete to authenticated using (author_id = (select auth.uid()));

create or replace function public.list_book_club_readers()
returns table (id uuid, nickname text, current_books jsonb)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.id, p.nickname,
    coalesce((select jsonb_agg(jsonb_build_object('book_id',rp.book_id,'current_chapter',rp.current_chapter) order by rp.updated_at desc)
      from public.reading_progress rp where rp.user_id=p.id and rp.reading_status='reading'),'[]'::jsonb) as current_books
  from public.profiles p
  where p.onboarding_complete=true
  order by lower(p.nickname);
$$;
revoke all on function public.list_book_club_readers() from public;
grant execute on function public.list_book_club_readers() to authenticated;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('reader-art','reader-art',false,8388608,array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "Readers can upload their art" on storage.objects;
drop policy if exists "Readers can view safe art" on storage.objects;
drop policy if exists "Readers can update their art" on storage.objects;
drop policy if exists "Readers can delete their art" on storage.objects;
create policy "Readers can upload their art" on storage.objects for insert to authenticated with check (bucket_id='reader-art' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "Readers can view safe art" on storage.objects for select to authenticated using (
  bucket_id='reader-art' and exists (
    select 1 from public.reader_submissions submission
    where submission.storage_path=name and submission.kind='art' and (
      submission.author_id=(select auth.uid()) or submission.placement='book-start'
      or (submission.placement='chapter' and public.reader_has_reached((select auth.uid()),submission.book_id,submission.chapter_number,false))
      or (submission.placement='book-end' and public.reader_has_reached((select auth.uid()),submission.book_id,0,true))
    )
  )
);
create policy "Readers can update their art" on storage.objects for update to authenticated using (bucket_id='reader-art' and owner_id=(select auth.uid())::text) with check (bucket_id='reader-art' and owner_id=(select auth.uid())::text);
create policy "Readers can delete their art" on storage.objects for delete to authenticated using (bucket_id='reader-art' and owner_id=(select auth.uid())::text);

commit;
