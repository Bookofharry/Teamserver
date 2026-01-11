create or replace function public.trim_workspace_messages()
returns trigger
language plpgsql
as $$
declare
  owner_plan text;
  retention_limit integer;
begin
  select p.plan
    into owner_plan
    from workspaces w
    join profiles p on p.id = w.owner_id
   where w.id = new.workspace_id;

  retention_limit := case owner_plan
    when 'premium_plus' then 10000
    when 'premium' then 3000
    else 1000
  end;

  delete from workspace_messages
  where id in (
    select id
    from workspace_messages
    where workspace_id = new.workspace_id
    order by created_at desc, id desc
    offset retention_limit
  );

  return new;
end;
$$;
