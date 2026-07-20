-- Deterministic fixtures for local dev and tests. Fixed UUIDs so tests can
-- reference specific rows directly. Re-runnable: clears its own rows first.
--
-- Scenario: an autistic child went missing near a Forest Park trailhead.
-- One searcher has been walking a short path (search_sessions + track_points).
-- Two different users (the searcher, then the coordinator) each report a
-- sighting close in space (~15m apart) and close in time (~5 minutes apart) -
-- well within CONFIG.CORROBORATION_RADIUS_M (150m) and
-- CONFIG.CORROBORATION_WINDOW_MS (30min), so the signals engine's
-- corroboration logic should fire for them.

delete from public.sightings where id in (
  '66666666-6666-6666-6666-666666666661',
  '66666666-6666-6666-6666-666666666662'
);
delete from public.track_points where session_id = '44444444-4444-4444-4444-444444444444';
delete from public.search_sessions where id = '44444444-4444-4444-4444-444444444444';
delete from public.incidents where id = '11111111-1111-1111-1111-111111111111';
delete from public.profiles where id in (
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333'
);

insert into public.profiles (id, display_name, role) values
  ('22222222-2222-2222-2222-222222222222', 'Jordan (Searcher)', 'searcher'),
  ('33333333-3333-3333-3333-333333333333', 'Casey (Coordinator)', 'coordinator');

insert into public.incidents (id, name, subject_category, ipp_lat, ipp_lng, started_at, status) values
  (
    '11111111-1111-1111-1111-111111111111',
    'Missing child near Forest Park trailhead',
    'autistic_child',
    45.5450, -122.7180,
    now() - interval '2 hours',
    'active'
  );

insert into public.search_sessions (id, incident_id, user_id, mode, started_at, ended_at) values
  (
    '44444444-4444-4444-4444-444444444444',
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    'moving',
    now() - interval '90 minutes',
    null
  );

insert into public.track_points (id, session_id, lat, lng, accuracy_m, recorded_at) values
  ('55555555-5555-5555-5555-000000000001', '44444444-4444-4444-4444-444444444444', 45.5451, -122.7182, 8.0, now() - interval '89 minutes'),
  ('55555555-5555-5555-5555-000000000002', '44444444-4444-4444-4444-444444444444', 45.5453, -122.7178, 7.5, now() - interval '87 minutes'),
  ('55555555-5555-5555-5555-000000000003', '44444444-4444-4444-4444-444444444444', 45.5456, -122.7174, 9.0, now() - interval '85 minutes'),
  ('55555555-5555-5555-5555-000000000004', '44444444-4444-4444-4444-444444444444', 45.5459, -122.7170, 6.5, now() - interval '83 minutes');

insert into public.sightings (id, incident_id, reported_by, lat, lng, observed_at, type, confidence, notes) values
  (
    '66666666-6666-6666-6666-666666666661',
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    45.5461, -122.7168,
    now() - interval '20 minutes',
    'visual',
    0.7,
    'Child in red jacket seen near the creek, heading north.'
  ),
  (
    '66666666-6666-6666-6666-666666666662',
    '11111111-1111-1111-1111-111111111111',
    '33333333-3333-3333-3333-333333333333',
    45.5462, -122.7167,
    now() - interval '15 minutes',
    'clothing',
    0.6,
    'Red fabric snagged on a branch, matches description.'
  );
