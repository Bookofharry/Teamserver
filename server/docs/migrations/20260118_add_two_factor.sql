alter table profiles
  add column if not exists two_factor_enabled boolean default false;

create table if not exists two_factor_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  token text not null unique,
  code text not null,
  purpose text not null,
  expires_at timestamptz not null,
  created_at timestamptz default now()
);

create index if not exists idx_two_factor_codes_user_id on two_factor_codes(user_id);
create index if not exists idx_two_factor_codes_token on two_factor_codes(token);
create index if not exists idx_two_factor_codes_purpose on two_factor_codes(purpose);

alter table two_factor_codes enable row level security;
