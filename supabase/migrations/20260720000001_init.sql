-- FindParker schema: profiles, incidents, search sessions, track points,
-- watchtowers, sightings, sectors. Timestamps are stored as timestamptz;
-- the app's domain model works in epoch milliseconds and the DataProvider
-- layer (src/data/SupabaseProvider.ts) converts at the boundary.
--
-- POC RLS: permissive for anonymous field use. HARDEN before real deployment
-- (restrict verify/reject to coordinators, rate-limit inserts).

create extension if not exists postgis;
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
-- id matches the id of the Supabase Auth user created by signInAnonymously().
-- Not FK'd to auth.users so seed fixtures and tests can create profiles
-- without going through the auth flow; the app enforces id = auth.uid() when
-- writing its own profile.
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  role text not null check (role in ('searcher', 'coordinator')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- incidents
-- ---------------------------------------------------------------------------
create table public.incidents (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  subject_category text not null check (
    subject_category in (
      'autistic_child', 'dementia', 'child_1_6', 'child_7_12',
      'hiker', 'despondent', 'other'
    )
  ),
  ipp_lat double precision not null,
  ipp_lng double precision not null,
  ipp geography(Point, 4326) generated always as (
    geography(st_setsrid(st_makepoint(ipp_lng, ipp_lat), 4326))
  ) stored,
  started_at timestamptz not null default now(),
  status text not null default 'active' check (status in ('active', 'closed'))
);

create index incidents_ipp_gix on public.incidents using gist (ipp);

-- ---------------------------------------------------------------------------
-- search_sessions
-- ---------------------------------------------------------------------------
create table public.search_sessions (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  mode text not null check (mode in ('moving', 'watchtower')),
  started_at timestamptz not null default now(),
  ended_at timestamptz null
);

create index search_sessions_incident_id_idx on public.search_sessions (incident_id);
create index search_sessions_user_id_idx on public.search_sessions (user_id);

-- ---------------------------------------------------------------------------
-- track_points
-- ---------------------------------------------------------------------------
create table public.track_points (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.search_sessions (id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  geog geography(Point, 4326) generated always as (
    geography(st_setsrid(st_makepoint(lng, lat), 4326))
  ) stored,
  accuracy_m real not null,
  recorded_at timestamptz not null default now()
);

create index track_points_session_id_idx on public.track_points (session_id);
create index track_points_geog_gix on public.track_points using gist (geog);

-- ---------------------------------------------------------------------------
-- watchtowers
-- ---------------------------------------------------------------------------
create table public.watchtowers (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents (id) on delete cascade,
  session_id uuid null references public.search_sessions (id) on delete set null,
  lat double precision not null,
  lng double precision not null,
  geog geography(Point, 4326) generated always as (
    geography(st_setsrid(st_makepoint(lng, lat), 4326))
  ) stored,
  radius_m real not null,
  active_from timestamptz not null default now(),
  active_to timestamptz null
);

create index watchtowers_incident_id_idx on public.watchtowers (incident_id);

-- ---------------------------------------------------------------------------
-- sightings
-- ---------------------------------------------------------------------------
create table public.sightings (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents (id) on delete cascade,
  reported_by uuid not null references public.profiles (id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  geog geography(Point, 4326) generated always as (
    geography(st_setsrid(st_makepoint(lng, lat), 4326))
  ) stored,
  observed_at timestamptz not null default now(),
  type text not null check (type in ('visual', 'clothing', 'footprint', 'other')),
  confidence real not null,
  status text not null default 'unverified' check (status in ('unverified', 'verified', 'rejected')),
  verified_by uuid null references public.profiles (id) on delete set null,
  verified_via text null check (verified_via in ('corroboration', 'coordinator')),
  corroborates_id uuid null references public.sightings (id) on delete set null,
  notes text not null default '',
  photo_url text null
);

create index sightings_incident_id_idx on public.sightings (incident_id);
create index sightings_geog_gix on public.sightings using gist (geog);

-- ---------------------------------------------------------------------------
-- sectors
-- ---------------------------------------------------------------------------
create table public.sectors (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents (id) on delete cascade,
  polygon jsonb not null,
  assigned_label text not null,
  status text not null default 'open' check (status in ('open', 'in_progress', 'done'))
);

create index sectors_incident_id_idx on public.sectors (incident_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- POC RLS: permissive for anonymous field use. HARDEN before real deployment
-- (restrict verify/reject to coordinators, rate-limit inserts).
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.incidents enable row level security;
alter table public.search_sessions enable row level security;
alter table public.track_points enable row level security;
alter table public.watchtowers enable row level security;
alter table public.sightings enable row level security;
alter table public.sectors enable row level security;

create policy "profiles_select_all" on public.profiles for select using (true);
create policy "profiles_insert_any" on public.profiles for insert with check (true);
create policy "profiles_update_any" on public.profiles for update using (true) with check (true);

create policy "incidents_select_all" on public.incidents for select using (true);
create policy "incidents_insert_any" on public.incidents for insert with check (true);
create policy "incidents_update_any" on public.incidents for update using (true) with check (true);

create policy "search_sessions_select_all" on public.search_sessions for select using (true);
create policy "search_sessions_insert_any" on public.search_sessions for insert with check (true);
create policy "search_sessions_update_any" on public.search_sessions for update using (true) with check (true);

create policy "track_points_select_all" on public.track_points for select using (true);
create policy "track_points_insert_any" on public.track_points for insert with check (true);

create policy "watchtowers_select_all" on public.watchtowers for select using (true);
create policy "watchtowers_insert_any" on public.watchtowers for insert with check (true);

-- TODO(harden): verify/reject should require a coordinator role, not "anyone".
create policy "sightings_select_all" on public.sightings for select using (true);
create policy "sightings_insert_any" on public.sightings for insert with check (true);
create policy "sightings_update_any" on public.sightings for update using (true) with check (true);

create policy "sectors_select_all" on public.sectors for select using (true);
create policy "sectors_insert_any" on public.sectors for insert with check (true);
create policy "sectors_update_any" on public.sectors for update using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table
  public.incidents,
  public.track_points,
  public.sightings,
  public.watchtowers,
  public.search_sessions;
