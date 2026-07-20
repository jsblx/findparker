# FindParker Supabase backend

## Run locally

Requires Docker (the Supabase CLI runs Postgres, GoTrue, Realtime, etc. in containers).

```bash
npx supabase start          # boots local Postgres + Studio + Realtime, applies migrations
npx supabase db reset       # re-applies migrations/*.sql and seed.sql from scratch
```

`npx supabase start` prints the local API URL and anon key - copy them into `.env.local`:

```bash
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<anon key printed by `supabase start`>
```

Studio is available at http://127.0.0.1:54323 for browsing tables and running SQL.

## Migrations

Schema lives in `supabase/migrations/*.sql`, applied in filename order. Add new
migrations with:

```bash
npx supabase migration new <name>
```

## Seed data

`supabase/seed.sql` is applied automatically by `supabase db reset` (and by
`supabase start` on first boot). It creates one active incident, a searcher
and coordinator profile, one search session with a few track points, and two
corroborating sightings, all under fixed UUIDs so tests can reference them
directly (see the comment at the top of the file for the exact ids).

## Pointing the app at a hosted project instead

Set the same two env vars to your hosted project's values (Project Settings ->
API in the Supabase dashboard):

```bash
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<hosted anon key>
```

Run the migrations against the hosted project with `npx supabase link` then
`npx supabase db push`, and apply `seed.sql` via the SQL editor if you want the
same fixtures there. With neither env var set, the app falls back to
`InMemoryProvider` and runs fully offline (see `src/data/index.ts`).

## RLS note

The policies in `20260720000001_init.sql` are intentionally permissive (POC
scope: anonymous field use, no coordinator-only enforcement at the DB layer).
Harden them before any real deployment - see the comment block at the top of
that migration.
