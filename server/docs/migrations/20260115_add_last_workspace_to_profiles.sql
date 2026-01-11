alter table profiles
  add column if not exists last_workspace_id uuid references workspaces(id) on delete set null;
