-- The Archive 2.7: private Personal Archive notes and community song likes.
-- Safe to rerun. Run this entire file in the Supabase SQL Editor.

begin;

create table if not exists public.personal_notes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  book_id text not null,
  chapter_number integer not null default 0 check (chapter_number >= 0),
  body text not null check (char_length(btrim(body)) between 1 and 8000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, book_id, chapter_number)
);

comment on column public.personal_notes.chapter_number is '0 means a book-level note; positive values are chapter notes.';

create table if not exists public.song_likes (
  submission_id uuid not null references public.reader_submissions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (submission_id, user_id)
);

create index if not exists personal_notes_recent_idx on public.personal_notes(user_id, updated_at desc);
create index if not exists song_likes_submission_idx on public.song_likes(submission_id, created_at);

create or replace function public.set_personal_note_owner()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  new.user_id := auth.uid();
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.set_personal_note_owner() from public;
drop trigger if exists assign_personal_note_owner on public.personal_notes;
create trigger assign_personal_note_owner before insert or update on public.personal_notes
for each row execute function public.set_personal_note_owner();

create or replace function public.set_song_like_owner()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  new.user_id := auth.uid();
  return new;
end;
$$;

revoke all on function public.set_song_like_owner() from public;
drop trigger if exists assign_song_like_owner on public.song_likes;
create trigger assign_song_like_owner before insert or update on public.song_likes
for each row execute function public.set_song_like_owner();

alter table public.personal_notes enable row level security;
alter table public.song_likes enable row level security;

grant select,insert,update,delete on public.personal_notes to authenticated;
grant select,insert,delete on public.song_likes to authenticated;
revoke all on public.personal_notes, public.song_likes from anon;

drop policy if exists "Readers can view their own notes" on public.personal_notes;
drop policy if exists "Readers can add their own notes" on public.personal_notes;
drop policy if exists "Readers can update their own notes" on public.personal_notes;
drop policy if exists "Readers can delete their own notes" on public.personal_notes;

create policy "Readers can view their own notes" on public.personal_notes
for select to authenticated using (user_id = (select auth.uid()));
create policy "Readers can add their own notes" on public.personal_notes
for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Readers can update their own notes" on public.personal_notes
for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Readers can delete their own notes" on public.personal_notes
for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists "Readers can view likes on safe songs" on public.song_likes;
drop policy if exists "Readers can like safe songs" on public.song_likes;
drop policy if exists "Readers can remove their song likes" on public.song_likes;

create policy "Readers can view likes on safe songs" on public.song_likes
for select to authenticated using (
  exists (
    select 1 from public.reader_submissions submission
    where submission.id = submission_id and submission.kind = 'song'
  )
);
create policy "Readers can like safe songs" on public.song_likes
for insert to authenticated with check (
  user_id = (select auth.uid()) and exists (
    select 1 from public.reader_submissions submission
    where submission.id = submission_id and submission.kind = 'song'
  )
);
create policy "Readers can remove their song likes" on public.song_likes
for delete to authenticated using (user_id = (select auth.uid()));

commit;
