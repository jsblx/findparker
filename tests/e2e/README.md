# FindParker E2E tests

These Playwright specs drive the app through a real browser against the default
`InMemoryProvider` backend (no `VITE_SUPABASE_URL` configured - see `src/data/index.ts`). That
provider is a single in-process instance created once per page load (`main.tsx`'s
`useMemo(() => createDataProvider(), [])`), reset on reload, and never shared across separate
browser contexts. That shapes what these tests can and can't meaningfully assert.

## What's covered here

- `smoke.spec.ts` - sign-in screen loads, sign in as a coordinator, create an incident (manual
  IPP lat/lng), land on its map tab with all three tabs (Search/Map/Coordinator) present, no
  console errors along the way.
- `search-coverage.spec.ts` - sign in as a searcher, create an incident, start a moving search
  session, walk a mocked GPS path (see `helpers/geo.ts`), and assert the live "points collected"
  counter goes above zero and then increases; end the search and confirm it returns to idle.
- `sighting-verification.spec.ts` - sign in as a coordinator, create an incident, report a
  sighting, confirm it renders as `unverified`, click Verify, confirm it renders as `verified`
  with `via coordinator`.
- `visibility-pause.spec.ts` (best-effort) - during an active search, flip
  `document.visibilityState`/dispatch `visibilitychange` and assert the status panel shows
  `Paused`, then reverse it and assert it shows `Active` again. This ran reliably across
  repeated local runs; if it turns out to be flaky under headless Chromium in CI, convert it to
  `test.fixme` with a pointer back to this note - the same pause/resume transition is also
  covered deterministically in `src/tracking/useSearchSession.test.ts` against an injected fake
  `VisibilityDoc`.

All assertions target DOM text, testids, and counters - never map/canvas pixels, since
deck.gl/MapLibre render to WebGL and pixel-level assertions on that would be flaky and slow to
maintain for no real signal.

## Known app issue surfaced by this work: unthrottled GPS ingestion under a moving session

While writing `search-coverage.spec.ts`, starting a `moving`-mode session and simply leaving it
active (no explicit extra position changes) made "points collected" climb by hundreds per
second, and made "End search" take unpredictably long to settle the longer the session had been
running. Root cause: `useGeolocation`'s `api` (from `createDefaultGeoApi()`) is recreated as a
new object on every render when no `api` override is passed in (which is how `SearcherView`
calls it in practice), and `api` is a dependency of the effect that calls `watchPosition`. Since
`navigator.geolocation.watchPosition` invokes its success callback once immediately upon
(re-)registration with the last-known position, every render tears down and re-subscribes the
watch, which immediately fires again (because `lastEmitAtRef` is also reset on every
resubscribe) - a self-sustaining loop that ignores `CONFIG.GPS_SAMPLE_INTERVAL_MS` entirely and
is independent of the mocked-geolocation delivery rate. This reproduces with only a single
`context.setGeolocation` call and no further changes, so it isn't a test-environment artifact.

This is an app-logic bug (in `src/tracking/useGeolocation.ts`), out of scope for this E2E/CI
slice to fix, but worth flagging for the next pass: memoizing `createDefaultGeoApi()`'s result
(e.g. via a stable module-level singleton, or `useMemo`/`useRef`) would remove the
re-subscription churn and let the sample-interval throttle work as documented. In the meantime,
`search-coverage.spec.ts` intentionally keeps its active-session window short (assert quickly,
walk briefly, end promptly) rather than lingering, to stay clear of the runaway.

## What's intentionally deferred (needs a real Supabase stack)

The `InMemoryProvider` never fails a write and never shares state across browser contexts, so
the following behaviors can't be exercised meaningfully here. They're covered by unit tests
today and belong in a human test plan / a future Supabase-backed E2E job once Docker/Supabase
services are available in CI:

1. **Offline-queue failure/resync.** `InMemoryProvider.appendTrackPoints` always succeeds, so a
   real dropped-connection retry/backoff/resync path can't be observed end-to-end here. Covered
   by `src/tracking/offlineQueue.test.ts`.
2. **Cross-user corroboration auto-verify.** Two independent Playwright `BrowserContext`s each
   get their own `InMemoryProvider` instance (it's created once per page load, not shared
   globally), so a second searcher's sighting can never corroborate the first's in this setup.
   The same limitation applies to any scenario needing two signed-in users interacting with the
   *same* incident state (e.g. a searcher and a coordinator seeing each other's live updates in
   the same run) - each context's InMemoryProvider is isolated. Covered by the signals engine's
   corroboration unit tests (`src/signals/**`); exercising it across real separate sessions
   needs a shared Supabase-backed provider.
3. **Multi-device realtime propagation.** `InMemoryProvider.subscribe` fakes realtime by
   notifying listeners synchronously within the same instance; it can't demonstrate a change
   made on one device propagating over the network to another device's `SupabaseProvider`
   subscription. That requires `supabase start` (or hosted Supabase) plus at least two real
   browser contexts pointed at it.
