-- Migration: rename legacy "plus" plan values to "premium".
-- Run in Supabase SQL editor or via psql with a service role connection.

begin;

update profiles
set plan = 'premium'
where plan is not null
  and lower(plan) = 'plus';

update upgrade_intents
set plan = 'premium'
where plan is not null
  and lower(plan) = 'plus';

commit;
