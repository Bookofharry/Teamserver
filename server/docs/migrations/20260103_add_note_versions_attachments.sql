begin;

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

create index if not exists idx_note_versions_note_id on note_versions(note_id);
create index if not exists idx_note_versions_created_at on note_versions(created_at);

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

create index if not exists idx_note_attachments_note_id on note_attachments(note_id);
create index if not exists idx_note_attachments_created_at on note_attachments(created_at);

alter table note_versions enable row level security;
alter table note_attachments enable row level security;

commit;
