-- The Archive 2.7.4: reliable, authorized mention-email delivery claims.
-- Safe to run more than once.

alter table public.mentions
  add column if not exists email_claimed_at timestamptz;

create or replace function public.claim_mention_email(target_mention uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  affected integer;
begin
  if auth.uid() is null then
    return false;
  end if;

  update public.mentions as mention
     set email_claimed_at = pg_catalog.now()
   where mention.id = target_mention
     and mention.email_sent_at is null
     and (
       mention.email_claimed_at is null
       or mention.email_claimed_at < pg_catalog.now() - interval '15 minutes'
     )
     and exists (
       select 1
         from public.chapter_posts as post
        where post.id = mention.post_id
          and post.author_id = auth.uid()
     );

  get diagnostics affected = row_count;
  return affected = 1;
end;
$$;

create or replace function public.complete_mention_email(target_mention uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  affected integer;
begin
  if auth.uid() is null then
    return false;
  end if;

  update public.mentions as mention
     set email_sent_at = pg_catalog.now(),
         email_claimed_at = null
   where mention.id = target_mention
     and mention.email_sent_at is null
     and mention.email_claimed_at is not null
     and exists (
       select 1
         from public.chapter_posts as post
        where post.id = mention.post_id
          and post.author_id = auth.uid()
     );

  get diagnostics affected = row_count;
  return affected = 1;
end;
$$;

create or replace function public.release_mention_email(target_mention uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  affected integer;
begin
  if auth.uid() is null then
    return false;
  end if;

  update public.mentions as mention
     set email_claimed_at = null
   where mention.id = target_mention
     and mention.email_sent_at is null
     and exists (
       select 1
         from public.chapter_posts as post
        where post.id = mention.post_id
          and post.author_id = auth.uid()
     );

  get diagnostics affected = row_count;
  return affected = 1;
end;
$$;

revoke all on function public.claim_mention_email(uuid) from public, anon;
revoke all on function public.complete_mention_email(uuid) from public, anon;
revoke all on function public.release_mention_email(uuid) from public, anon;

grant execute on function public.claim_mention_email(uuid) to authenticated;
grant execute on function public.complete_mention_email(uuid) to authenticated;
grant execute on function public.release_mention_email(uuid) to authenticated;
