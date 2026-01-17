alter table profiles
  add column if not exists session_version integer default 0;
