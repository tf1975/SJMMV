-- Secure nickname-only list used by @mention autocomplete.
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
