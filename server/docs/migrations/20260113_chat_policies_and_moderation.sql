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

drop policy if exists chat_messages_select on workspace_messages;
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

drop policy if exists chat_messages_insert on workspace_messages;
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

drop policy if exists chat_messages_update on workspace_messages;
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

drop policy if exists chat_attachments_select on workspace_message_attachments;
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

drop policy if exists chat_attachments_insert on workspace_message_attachments;
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

drop policy if exists chat_reactions_select on workspace_message_reactions;
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

drop policy if exists chat_reactions_insert on workspace_message_reactions;
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

drop policy if exists chat_reactions_delete on workspace_message_reactions;
create policy chat_reactions_delete
on workspace_message_reactions
for delete
using (
  user_id = auth.uid()
);

drop policy if exists chat_mentions_select on workspace_message_mentions;
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

drop policy if exists chat_mentions_insert on workspace_message_mentions;
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

drop policy if exists chat_notifications_select on workspace_message_notifications;
create policy chat_notifications_select
on workspace_message_notifications
for select
using (user_id = auth.uid());

drop policy if exists chat_notifications_update on workspace_message_notifications;
create policy chat_notifications_update
on workspace_message_notifications
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists chat_notifications_insert on workspace_message_notifications;
create policy chat_notifications_insert
on workspace_message_notifications
for insert
with check (auth.role() = 'service_role');

drop policy if exists chat_audits_select on workspace_message_audits;
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

drop policy if exists chat_audits_insert on workspace_message_audits;
create policy chat_audits_insert
on workspace_message_audits
for insert
with check (auth.role() = 'service_role');

update storage.buckets
set public = false
where id = 'workspace-chat';

drop policy if exists chat_storage_read on storage.objects;
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

drop policy if exists chat_storage_insert on storage.objects;
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

drop policy if exists chat_storage_delete on storage.objects;
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
