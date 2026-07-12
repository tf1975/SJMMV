-- Add this after the original unique-nickname index.
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
