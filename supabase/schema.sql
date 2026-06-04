-- ============================================================================
-- Mac Speaker — Supabase setup
-- Run this ONCE in your Supabase project: Dashboard → SQL Editor → New query →
-- paste all of this → Run.  Everything here fits the FREE tier.
-- ============================================================================

-- 1. Table that holds one row per voice note ---------------------------------
create table if not exists public.messages (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  sender      text,
  audio_path  text not null,
  audio_url   text not null,
  played      boolean not null default false
);

-- 2. Row Level Security ------------------------------------------------------
-- The website and the Mac listener both use the public "anon" key, so we open
-- up exactly the access they need. NOTE: this means anyone with the website URL
-- can post a note. That's fine for a fun shared speaker; see README for locking
-- it down later.
alter table public.messages enable row level security;

create policy "anon can insert messages"
  on public.messages for insert
  to anon
  with check (true);

-- Needed so the Mac listener (anon key) actually receives realtime rows.
create policy "anon can read messages"
  on public.messages for select
  to anon
  using (true);

-- Lets the Mac mark a note as played (optional, used by the listener).
create policy "anon can update messages"
  on public.messages for update
  to anon
  using (true)
  with check (true);

-- 3. Realtime ----------------------------------------------------------------
-- Broadcast INSERTs on this table to subscribed clients (the Mac).
alter publication supabase_realtime add table public.messages;

-- 4. Storage bucket for the audio files --------------------------------------
insert into storage.buckets (id, name, public)
values ('voice-notes', 'voice-notes', true)
on conflict (id) do nothing;

-- Anyone can upload a note...
create policy "anon can upload voice notes"
  on storage.objects for insert
  to anon
  with check (bucket_id = 'voice-notes');

-- ...and the file is publicly readable (so the Mac can just download the URL).
create policy "public can read voice notes"
  on storage.objects for select
  to anon
  using (bucket_id = 'voice-notes');
