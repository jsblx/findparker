# FindParker

Coordinate volunteer search-and-rescue efforts. Volunteers run an explicit "search
session" that records their GPS breadcrumb (their **coverage**); anyone can report
**sightings**; a coordinator sets the missing person's last-known point and moderates
sightings. FindParker fuses all of this - decayed search coverage, a statistical
Lost-Person-Behavior distance prior, and verified sightings - into a live probability
surface and a **"search here next"** ranking, so effort isn't duplicated and the next
searchers start better informed.

> **Not a replacement for emergency services or the official Incident Commander.** This is
> a coordination aid for volunteers. Always defer to authorities and call your local
> emergency number for a missing person.

## How it works (the signals engine)

Everything is bucketed into [H3](https://h3geo.org/) hexagons and treated as a time-stamped
observation over space:

- **Coverage / Probability of Detection** - searcher tracks and stationary "watchtowers"
  mark cells as searched; confidence **decays over time** (the subject may re-enter a
  searched area).
- **Prior** - a Lost-Person-Behavior radial distance model from the Initial Planning Point
  (IPP), by subject category (e.g. autistic child, dementia, hiker). *The distance values
  are placeholders and must be replaced with vetted ISRID / Koester data before real use -
  see `src/signals/prior.ts`.*
- **Sightings** - anyone can submit one (starts **unverified**). It becomes **verified**
  either by **corroboration** (≥2 reports from distinct users, close in space/time and
  physically plausible) or by **coordinator** approval. Only verified sightings move the
  probability surface.
- **Fusion** - `computeSurfaces()` combines prior + verified sightings, applies a Bayesian
  coverage update `remaining = base × (1 − POD)`, renormalizes, and ranks the best
  un-searched, high-probability cells.

## Tech stack

React + Vite PWA · TypeScript · MapLibre GL + deck.gl (H3 layers) · h3-js · Supabase
(Postgres/PostGIS + Auth + Realtime) · Vitest + Playwright.

The app talks to a `DataProvider` interface (`src/data/`). With no Supabase env vars set it
runs entirely on an **in-memory provider** (great for local dev and tests); set the env vars
to use the real Supabase backend.

## Quick start (local, no backend)

```bash
npm install
npm run dev        # http://localhost:5173 - runs on InMemoryProvider, keyless basemap
```

Geolocation requires a secure context; `localhost` counts as secure, so `npm run dev` works.
On a phone over the LAN you need HTTPS (see Deploy).

### Environment variables (all optional for dev)

Copy `.env.example` to `.env` and fill in as needed:

| Variable | Purpose | If unset |
|---|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL | Falls back to in-memory provider |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public key | Falls back to in-memory provider |
| `VITE_MAPTILER_KEY` | MapTiler basemap tiles | Keyless blank basemap (hex layers still render) |

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Type-check project refs + production build (PWA) |
| `npm run preview` | Serve the production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Unit/integration tests (Vitest) |
| `npm run test:watch` | Vitest watch mode |
| `npm run test:e2e` | Playwright end-to-end tests |
| `npm run lint` | ESLint |

## Backend setup (Supabase)

Requires Docker for the local stack. See `supabase/README.md` for details.

```bash
npx supabase start                       # local Postgres/PostGIS/Realtime (needs Docker)
npx supabase db reset                    # apply migrations + seed.sql
# copy the printed API URL + anon key into .env as VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
npm run dev
```

Schema, permissive-POC row-level security (with hardening TODOs), and deterministic seed
data live in `supabase/migrations/` and `supabase/seed.sql`.

## Using the app

1. **Sign in** with a display name and a role (searcher or coordinator). Identity persists
   in `localStorage`.
2. **Create / pick an incident** on the landing page (name, subject category, and an IPP via
   current location or manual lat/lng).
3. **Searcher** tab: choose Moving or Watchtower, tap **Start search**, keep the screen on
   while you walk. Your coverage streams into the shared map; **End search** when done.
4. **Report sighting** (any user, any tab): location, type, confidence, notes, optional photo.
5. **Coordinator** tab: edit IPP/category, and **Verify/Reject** sightings. Corroborated
   sightings auto-show as verified.
6. **Map** tab: toggle coverage, probability, distance rings, sightings, and "search next".

## Testing

- **Unit/integration** (`npm run test`): the signals math, tracking hooks, data provider,
  map surface hook, and UI components - runnable with no backend or browser.
- **End-to-end** (`npm run test:e2e`): drives the real UI with mocked geolocation against the
  in-memory backend. Some behaviors (offline-failure resync, cross-user corroboration,
  multi-device realtime) require the real Supabase stack and are covered by unit tests +
  `HUMAN_TEST_PLAN.md`. See `tests/e2e/README.md`.
- **CI** (`.github/workflows/ci.yml`): lint → typecheck → unit → build → Playwright.

Before deploying to a real search, work through **`HUMAN_TEST_PLAN.md`** - it covers the
things automation can't (real-device GPS, iOS wake lock/background, multi-device realtime).

## Status & roadmap

This is a **Phase 0 POC**. Known follow-ups: replace placeholder distance-prior data with
vetted ISRID values; harden Supabase RLS (restrict verify/reject to coordinators);
reputation-weighted corroboration; sector assignment; Supabase Storage for sighting photos;
and a Capacitor native wrapper for true background GPS tracking.

## License

MIT - see `LICENSE`.
