-- ClassPing schema — paste this into Supabase SQL Editor and click Run

create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  device_token text unique not null,      -- random id stored in the browser, links a phone to its courses
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz default now()
);

create table if not exists courses (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid references subscriptions(id) on delete cascade,
  name text not null,                      -- e.g. "BO ACS 201 – Foundations of Cyber Security"
  day_of_week int not null check (day_of_week between 0 and 6), -- 0 = Sunday ... 6 = Saturday
  start_time time not null,                -- e.g. 08:00
  join_link text not null,                 -- Teams join URL
  reminder_minutes int not null default 30,
  color text default '#4FE3C1',
  last_notified_on date,                   -- guards against sending the same reminder twice in one day
  created_at timestamptz default now()
);

alter table subscriptions enable row level security;
alter table courses enable row level security;

-- Simple policy: service role (used only by our serverless functions) bypasses RLS by default,
-- so no public policies are needed — the browser never talks to Supabase directly.
