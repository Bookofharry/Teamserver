-- Fix profiles.id foreign key to reference auth.users.
-- This migration is safe by default and will abort if orphaned profiles exist.

do $$
begin
  if exists (
    select 1
    from public.profiles p
    where not exists (
      select 1
      from auth.users u
      where u.id = p.id
    )
  ) then
    raise exception 'Cannot add FK: profiles contains ids not present in auth.users';
  end if;
end $$;

alter table public.profiles
  drop constraint if exists profiles_id_fkey;

alter table public.profiles
  add constraint profiles_id_fkey
  foreign key (id)
  references auth.users (id)
  on delete cascade;
