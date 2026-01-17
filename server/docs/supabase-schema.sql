create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text,
  created_at timestamptz default now(),
  last_login_at timestamptz
);

create table if not exists profiles (
  id uuid primary key references users(id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  is_subscribed boolean default false,
  plan text not null default 'free',
  session_version integer default 0,
  last_workspace_id uuid,
  created_at timestamptz default now()
);

create table if not exists workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz default now()
);

alter table profiles
  add constraint profiles_last_workspace_fkey
  foreign key (last_workspace_id) references workspaces(id) on delete set null;

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

create table if not exists workspace_messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  sender_id uuid references profiles(id) on delete set null,
  body text not null,
  message_type text not null default 'text',
  created_at timestamptz default now(),
  edited_at timestamptz,
  deleted_at timestamptz
);

create table if not exists workspace_message_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references workspace_messages(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  uploader_id uuid references profiles(id) on delete set null,
  file_path text not null,
  file_name text,
  content_type text,
  size bigint,
  created_at timestamptz default now()
);

create table if not exists workspace_message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references workspace_messages(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  emoji text not null,
  created_at timestamptz default now(),
  unique (message_id, user_id, emoji)
);

create table if not exists workspace_message_mentions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references workspace_messages(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  mentioned_user_id uuid not null references profiles(id) on delete cascade,
  mention_text text,
  start_index integer,
  end_index integer,
  created_at timestamptz default now()
);

create table if not exists workspace_message_audits (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  message_id uuid not null references workspace_messages(id) on delete cascade,
  actor_id uuid references profiles(id) on delete set null,
  action text not null,
  before_body text,
  after_body text,
  created_at timestamptz default now()
);

create table if not exists workspace_message_notifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  message_id uuid not null references workspace_messages(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  type text not null default 'mention',
  created_at timestamptz default now(),
  read_at timestamptz,
  unique (message_id, user_id, type)
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

create or replace function public.trim_workspace_messages()
returns trigger
language plpgsql
as $$
begin
  delete from workspace_messages
  where id in (
    select id
    from workspace_messages
    where workspace_id = new.workspace_id
    order by created_at desc
    offset 1000
  );
  return new;
end;
$$;

create index if not exists idx_workspace_message_audits_message_id on workspace_message_audits(message_id);
create index if not exists idx_workspace_message_audits_workspace_id on workspace_message_audits(workspace_id);
create index if not exists idx_workspace_message_notifications_user_id on workspace_message_notifications(user_id);
create index if not exists idx_workspace_message_notifications_workspace_id on workspace_message_notifications(workspace_id);
create index if not exists idx_workspace_message_notifications_read_at on workspace_message_notifications(read_at);

alter table workspace_messages enable row level security;
alter table workspace_message_attachments enable row level security;
alter table workspace_message_reactions enable row level security;
alter table workspace_message_mentions enable row level security;
alter table workspace_message_audits enable row level security;
alter table workspace_message_notifications enable row level security;

create policy chat_messages_select
on workspace_messages
for select
using (
  exists (
    select 1 from workspace_members wm
    where wm.workspace_id = workspace_id
      and wm.user_id = auth.uid()
  )
);

create policy chat_messages_insert
on workspace_messages
for insert
with check (
  sender_id = auth.uid()
  and exists (
    select 1 from workspace_members wm
    where wm.workspace_id = workspace_id
      and wm.user_id = auth.uid()
  )
);

create policy chat_messages_update
on workspace_messages
for update
using (
  sender_id = auth.uid()
  or exists (
    select 1 from workspace_members wm
    where wm.workspace_id = workspace_id
      and wm.user_id = auth.uid()
      and wm.role in ('owner', 'admin')
  )
)
with check (
  sender_id = auth.uid()
  or exists (
    select 1 from workspace_members wm
    where wm.workspace_id = workspace_id
      and wm.user_id = auth.uid()
      and wm.role in ('owner', 'admin')
  )
);

create policy chat_attachments_select
on workspace_message_attachments
for select
using (
  exists (
    select 1 from workspace_members wm
    where wm.workspace_id = workspace_id
      and wm.user_id = auth.uid()
  )
);

create policy chat_attachments_insert
on workspace_message_attachments
for insert
with check (
  uploader_id = auth.uid()
  and exists (
    select 1 from workspace_members wm
    where wm.workspace_id = workspace_id
      and wm.user_id = auth.uid()
  )
);

create policy chat_reactions_select
on workspace_message_reactions
for select
using (
  exists (
    select 1 from workspace_members wm
    where wm.workspace_id = workspace_id
      and wm.user_id = auth.uid()
  )
);

create policy chat_reactions_insert
on workspace_message_reactions
for insert
with check (
  user_id = auth.uid()
  and exists (
    select 1 from workspace_members wm
    where wm.workspace_id = workspace_id
      and wm.user_id = auth.uid()
  )
);

create policy chat_reactions_delete
on workspace_message_reactions
for delete
using (user_id = auth.uid());

create policy chat_mentions_select
on workspace_message_mentions
for select
using (
  exists (
    select 1 from workspace_members wm
    where wm.workspace_id = workspace_id
      and wm.user_id = auth.uid()
  )
);

create policy chat_mentions_insert
on workspace_message_mentions
for insert
with check (
  exists (
    select 1 from workspace_members wm
    where wm.workspace_id = workspace_id
      and wm.user_id = auth.uid()
  )
);

create policy chat_notifications_select
on workspace_message_notifications
for select
using (user_id = auth.uid());

create policy chat_notifications_update
on workspace_message_notifications
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy chat_notifications_insert
on workspace_message_notifications
for insert
with check (auth.role() = 'service_role');

create policy chat_audits_select
on workspace_message_audits
for select
using (
  exists (
    select 1 from workspace_members wm
    where wm.workspace_id = workspace_id
      and wm.user_id = auth.uid()
      and wm.role in ('owner', 'admin')
  )
);

create policy chat_audits_insert
on workspace_message_audits
for insert
with check (auth.role() = 'service_role');

update storage.buckets
set public = false
where id = 'workspace-chat';

create policy chat_storage_read
on storage.objects
for select
using (
  bucket_id = 'workspace-chat'
  and name like 'workspaces/%'
  and exists (
    select 1 from workspace_members wm
    where wm.workspace_id = (split_part(name, '/', 2))::uuid
      and wm.user_id = auth.uid()
  )
);

create policy chat_storage_insert
on storage.objects
for insert
with check (
  bucket_id = 'workspace-chat'
  and name like 'workspaces/%'
  and exists (
    select 1 from workspace_members wm
    where wm.workspace_id = (split_part(name, '/', 2))::uuid
      and wm.user_id = auth.uid()
  )
);

create policy chat_storage_delete
on storage.objects
for delete
using (
  bucket_id = 'workspace-chat'
  and name like 'workspaces/%'
  and exists (
    select 1 from workspace_members wm
    where wm.workspace_id = (split_part(name, '/', 2))::uuid
      and wm.user_id = auth.uid()
  )
);

drop trigger if exists workspace_messages_trim on workspace_messages;
create trigger workspace_messages_trim
after insert on workspace_messages
for each row execute function public.trim_workspace_messages();

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

create table if not exists password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz default now()
);

create table if not exists signup_otps (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  code text not null,
  expires_at timestamptz not null,
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
create index if not exists idx_workspace_messages_workspace_id on workspace_messages(workspace_id);
create index if not exists idx_workspace_messages_sender_id on workspace_messages(sender_id);
create index if not exists idx_workspace_messages_created_at on workspace_messages(created_at);
create index if not exists idx_workspace_message_attachments_message_id on workspace_message_attachments(message_id);
create index if not exists idx_workspace_message_attachments_workspace_id on workspace_message_attachments(workspace_id);
create index if not exists idx_workspace_message_reactions_message_id on workspace_message_reactions(message_id);
create index if not exists idx_workspace_message_reactions_workspace_id on workspace_message_reactions(workspace_id);
create index if not exists idx_workspace_message_mentions_message_id on workspace_message_mentions(message_id);
create index if not exists idx_workspace_message_mentions_workspace_id on workspace_message_mentions(workspace_id);
create index if not exists idx_workspace_message_mentions_user_id on workspace_message_mentions(mentioned_user_id);
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
create index if not exists idx_users_email on users(email);
create index if not exists idx_password_reset_tokens_user_id on password_reset_tokens(user_id);
create index if not exists idx_signup_otps_email on signup_otps(email);

-- Enable RLS to prevent direct client access; server uses service_role.
alter table profiles enable row level security;
alter table users enable row level security;
alter table workspaces enable row level security;
alter table workspace_members enable row level security;
alter table groups enable row level security;
alter table notes enable row level security;
alter table note_versions enable row level security;
alter table note_attachments enable row level security;
alter table workspace_messages enable row level security;
alter table workspace_message_attachments enable row level security;
alter table workspace_message_reactions enable row level security;
alter table workspace_message_mentions enable row level security;
alter table workspace_invites enable row level security;
alter table event_logs enable row level security;
alter table upgrade_intents enable row level security;
alter table idempotency_keys enable row level security;
alter table password_reset_tokens enable row level security;
alter table signup_otps enable row level security;

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
