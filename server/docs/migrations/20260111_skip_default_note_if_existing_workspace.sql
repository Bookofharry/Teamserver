create or replace function public.create_workspace_with_defaults(p_name text, p_owner_id uuid)
returns table (id uuid, name text, owner_id uuid, created_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  workspace_row workspaces;
  default_group_id uuid;
  existing_count bigint;
begin
  -- serialize workspace creation per owner to avoid race conditions
  PERFORM pg_advisory_xact_lock(hashtext(p_owner_id::text)::bigint);

  -- determine owner plan and workspace limit
  DECLARE
    owner_plan text;
    workspace_limit integer;
  BEGIN
    SELECT plan INTO owner_plan FROM profiles WHERE profiles.id = p_owner_id;
    workspace_limit := CASE owner_plan WHEN 'free' THEN 1 WHEN 'premium' THEN 3 ELSE NULL END;

    SELECT count(*) INTO existing_count FROM workspaces WHERE workspaces.owner_id = p_owner_id;

    IF workspace_limit IS NOT NULL AND existing_count >= workspace_limit THEN
      RAISE EXCEPTION 'plan_limit: workspace limit reached for owner %', p_owner_id;
    END IF;
  END;

  insert into workspaces (name, owner_id)
  values (coalesce(nullif(trim(p_name), ''), 'Untitled Workspace'), p_owner_id)
  returning * into workspace_row;

  insert into workspace_members (workspace_id, user_id, role)
  values (workspace_row.id, p_owner_id, 'owner');

  insert into groups as g (workspace_id, name, color)
  values (workspace_row.id, 'General Collection', '#0EA5E9')
  returning g.id into default_group_id;

  if existing_count = 0 then
    insert into notes (workspace_id, group_id, title, body, tags, is_pinned, updated_by_id)
    values (
      workspace_row.id,
      default_group_id,
      'Getting started',
      $note$Welcome to TeamPad! Here are a few quick tips to get started:

- Create collections to organize your notes.
- Use tags to keep related work together.
- Pin important notes so they stay on top.
- Share notes with your team when you are ready.
- Public links expire after 30 days.$note$
      ,
      array['getting-started', 'welcome'],
      false,
      p_owner_id
    );
  end if;

  return query select workspace_row.id, workspace_row.name, workspace_row.owner_id, workspace_row.created_at;
end;
$$;
