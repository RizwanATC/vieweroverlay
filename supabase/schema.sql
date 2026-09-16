-- Run this once in the Supabase SQL Editor (Project > SQL Editor > New query).
-- Single shared key-value table used for: /setup config (YouTube + Facebook
-- credentials), the YouTube live-video-id cache, and the TikTok worker's
-- viewer-count bridge.

create table if not exists kv_store (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- The app only ever accesses this table with the service role key (server-side,
-- never exposed to the browser), so RLS stays enabled with no permissive
-- policies — the anon/public key gets zero access to it by default.
alter table kv_store enable row level security;
