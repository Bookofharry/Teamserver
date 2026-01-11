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

drop trigger if exists workspace_messages_trim on workspace_messages;
create trigger workspace_messages_trim
after insert on workspace_messages
for each row execute function public.trim_workspace_messages();

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

alter table workspace_messages enable row level security;
alter table workspace_message_attachments enable row level security;
alter table workspace_message_reactions enable row level security;
alter table workspace_message_mentions enable row level security;
