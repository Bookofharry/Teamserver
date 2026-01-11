create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text,
  created_at timestamptz default now(),
  last_login_at timestamptz
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

insert into users (id, email, created_at)
select id, email, created_at
from profiles
on conflict (id) do nothing;

alter table profiles drop constraint if exists profiles_id_fkey;
alter table profiles
  add constraint profiles_id_fkey
  foreign key (id) references users(id) on delete cascade;

alter table users enable row level security;
alter table password_reset_tokens enable row level security;
alter table signup_otps enable row level security;
