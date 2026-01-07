create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  is_subscribed boolean default false,
  plan text not null default 'free',
  created_at timestamptz default now()
);

create table if not exists workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz default now()
);

create table if not exists workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz default now(),
  unique (workspace_id, user_id)
);

create table if not exists groups (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  color text,
  created_at timestamptz default now()
);

create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  group_id uuid not null references groups(id) on delete cascade,
  title text not null,
  body text,
  tags text[] default '{}',
  is_pinned boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  is_public boolean default false,
  public_slug text,
  public_published_at timestamptz,
  public_expires_at timestamptz,
  deleted_at timestamptz,
  updated_by_id uuid references profiles(id)
);

create table if not exists note_versions (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references notes(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  group_id uuid not null references groups(id) on delete cascade,
  title text not null,
  body text,
  tags text[] default '{}',
  created_at timestamptz default now(),
  created_by_id uuid references profiles(id)
);

create table if not exists note_attachments (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references notes(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  url text not null,
  size bigint,
  content_type text,
  created_at timestamptz default now(),
  created_by_id uuid references profiles(id)
);

create or replace function public.get_group_note_counts(p_workspace_id uuid)
returns table (group_id uuid, note_count bigint)
language sql
as $$
  select group_id, count(*)::bigint as note_count
  from notes
  where workspace_id = p_workspace_id
    and deleted_at is null
  group by group_id;
$$;

create table if not exists workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  email text not null,
  role text not null default 'member',
  token text not null unique,
  expires_at timestamptz not null,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

create table if not exists event_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete set null,
  workspace_id uuid references workspaces(id) on delete set null,
  action text not null,
  metadata jsonb,
  created_at timestamptz default now()
);

create table if not exists upgrade_intents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  plan text not null,
  source text,
  status text not null default 'pending',
  created_at timestamptz default now()
);

create table if not exists idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  scope text not null,
  idempotency_key text not null,
  status text not null default 'processing',
  status_code integer,
  response jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  unique (user_id, scope, idempotency_key)
);

create index if not exists idx_workspace_members_user_id on workspace_members(user_id);
create index if not exists idx_workspace_members_workspace_id on workspace_members(workspace_id);
create index if not exists idx_groups_workspace_id on groups(workspace_id);
create index if not exists idx_notes_workspace_id on notes(workspace_id);
create index if not exists idx_notes_group_id on notes(group_id);
create index if not exists idx_notes_updated_at on notes(updated_at);
create index if not exists idx_notes_deleted_at on notes(deleted_at);
create index if not exists idx_notes_workspace_id_deleted_at on notes(workspace_id, deleted_at);
create index if not exists idx_notes_title_trgm on notes using gin (title gin_trgm_ops);
create index if not exists idx_notes_body_trgm on notes using gin (body gin_trgm_ops);
create unique index if not exists idx_notes_public_slug on notes(public_slug);
create index if not exists idx_notes_public_expires_at on notes(public_expires_at);
create index if not exists idx_note_versions_note_id on note_versions(note_id);
create index if not exists idx_note_versions_created_at on note_versions(created_at);
create index if not exists idx_note_attachments_note_id on note_attachments(note_id);
create index if not exists idx_note_attachments_created_at on note_attachments(created_at);
create index if not exists idx_workspace_invites_token on workspace_invites(token);
create index if not exists idx_workspace_invites_workspace_id on workspace_invites(workspace_id);
create index if not exists idx_event_logs_user_id on event_logs(user_id);
create index if not exists idx_event_logs_workspace_id on event_logs(workspace_id);
create index if not exists idx_event_logs_action on event_logs(action);
create index if not exists idx_event_logs_created_at on event_logs(created_at);
create index if not exists idx_upgrade_intents_user_id on upgrade_intents(user_id);
create index if not exists idx_upgrade_intents_status on upgrade_intents(status);
create unique index if not exists idx_upgrade_intents_unique on upgrade_intents(user_id, plan, status);
create index if not exists idx_idempotency_user_scope on idempotency_keys(user_id, scope);
create index if not exists idx_idempotency_expires_at on idempotency_keys(expires_at);
create index if not exists idx_idempotency_created_at on idempotency_keys(created_at);

-- Enable RLS to prevent direct client access; server uses service_role.
alter table profiles enable row level security;
alter table workspaces enable row level security;
alter table workspace_members enable row level security;
alter table groups enable row level security;
alter table notes enable row level security;
alter table note_versions enable row level security;
alter table note_attachments enable row level security;
alter table workspace_invites enable row level security;
alter table event_logs enable row level security;
alter table upgrade_intents enable row level security;
alter table idempotency_keys enable row level security;

create or replace function public.create_workspace_with_defaults(p_name text, p_owner_id uuid)
returns table (id uuid, name text, owner_id uuid, created_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  workspace_row workspaces;
  default_group_id uuid;
begin
  -- serialize workspace creation per owner to avoid race conditions
  PERFORM pg_advisory_xact_lock(hashtext(p_owner_id::text)::bigint);

  -- determine owner plan and workspace limit
  DECLARE
    owner_plan text;
    workspace_limit integer;
    existing_count bigint;
  BEGIN
    SELECT plan INTO owner_plan FROM profiles WHERE id = p_owner_id;
    workspace_limit := CASE owner_plan WHEN 'free' THEN 1 WHEN 'premium' THEN 3 ELSE NULL END;

    SELECT count(*) INTO existing_count FROM workspaces WHERE owner_id = p_owner_id;

    IF workspace_limit IS NOT NULL AND existing_count >= workspace_limit THEN
      RAISE EXCEPTION 'plan_limit: workspace limit reached for owner %', p_owner_id;
    END IF;
  END;

  insert into workspaces (name, owner_id)
  values (coalesce(nullif(trim(p_name), ''), 'Untitled Workspace'), p_owner_id)
  returning * into workspace_row;

  insert into workspace_members (workspace_id, user_id, role)
  values (workspace_row.id, p_owner_id, 'owner');

  insert into groups (workspace_id, name, color)
  values (workspace_row.id, 'General Collection', '#0EA5E9')
  returning id into default_group_id;

  insert into notes (workspace_id, group_id, title, body, tags, is_pinned, updated_by_id)
  values (
    workspace_row.id,
    default_group_id,
    'Getting started',
    $$Welcome to TeamPad! Here are a few quick tips to get started:

- Create collections to organize your notes.
- Use tags to keep related work together.
- Pin important notes so they stay on top.
- Share notes with your team when you are ready.
- Public links expire after 30 days.$$
    ,
    array['getting-started', 'welcome'],
    false,
    p_owner_id
  );

  return query select workspace_row.id, workspace_row.name, workspace_row.owner_id, workspace_row.created_at;
end;
$$;
