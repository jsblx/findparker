# FindParker - Human Test Plan

This is the checklist to work through **before deploying FindParker for a real search**.
Automated tests (`npm run test`, `npm run test:e2e`) already cover the signals math, tracking
logic, data provider, and core UI flows. This document covers what automation **cannot**:
real-device GPS, iOS Safari wake lock / background behavior, multi-device realtime, and the
end-to-end field experience. Do the phones-and-walking parts outdoors with 2+ real devices.

Legend: ☐ = to test. Note the device/OS/browser for each result.

---

## 0. Prerequisites

- ☐ Backend chosen: in-memory (single device demo only) **or** Supabase (required for
  multi-device / realtime / persistence). For a real search you MUST use Supabase.
- ☐ Supabase project reachable; `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` set; migrations
  + seed applied (`npx supabase db reset` locally, or run migrations on the hosted project).
- ☐ App served over **HTTPS** on a public URL (geolocation + wake lock require a secure
  context on real phones - `localhost` is exempt but a LAN IP is not).
- ☐ Test devices ready: at least one iOS (Safari) and one Android (Chrome). Bring a power bank.

---

## 1. Install / PWA

- ☐ Open the URL on a phone; "Add to Home Screen" works (iOS Safari share sheet; Android
  Chrome install prompt).
- ☐ Launch from the home-screen icon: opens standalone (no browser chrome), correct name/icon.
- ☐ Offline load: after first visit, put the phone in airplane mode and relaunch - the app
  shell still loads (service worker cache).

## 2. Sign-in & identity

- ☐ First launch shows the sign-in screen (name + role).
- ☐ Sign in as a searcher; reload the page - you stay signed in (localStorage), no sign-in flash.
- ☐ Sign out returns to the sign-in screen.
- ☐ (Supabase) Kill network, then reload while signed in - app falls back to the sign-in
  screen rather than hanging on a blank/loading state.

## 3. Incident setup (coordinator)

- ☐ Create an incident: name, subject category, IPP via **Use current location** (grant the
  permission) - lat/lng populate from the real fix.
- ☐ Create an incident with **manual** lat/lng.
- ☐ On the Map tab, the distance rings render centered on the IPP and grow with subject
  category (compare e.g. `child_1_6` vs `hiker`).
- ☐ Coordinator can edit IPP / subject category and see rings move; a non-coordinator cannot.

## 4. Searcher tracking - THE CRITICAL REAL-DEVICE TESTS

Do these **outdoors, walking**, one phone per tester.

- ☐ Grant location permission. Start a **Moving** search.
- ☐ **Points accumulate at a sane rate** - roughly one every ~15s, NOT hundreds per second
  (regression check for the throttle/re-subscribe bug). Walk ~100-200m.
- ☐ **Coverage appears on the map** along your actual path, as a band (not a hairline), and
  matches where you really walked.
- ☐ **Wake lock**: with the search active, the screen does **not** auto-sleep. Status shows
  wake lock active.
  - ☐ iOS Safari specifically (wake lock is historically finicky): confirm it holds; note iOS
    version.
- ☐ **Background / lock behavior**: lock the phone or switch apps mid-search. On return, the
  status shows **Paused** and then resumes; confirm **no bogus straight-line coverage** was
  drawn across the gap (honest under-reporting is correct; false coverage is dangerous).
- ☐ **Dead-zone / offline**: enable airplane mode mid-walk, keep walking, then re-enable
  network. Queued-point count rises while offline and drains after reconnect; no coverage is
  lost (requires Supabase to be meaningful).
- ☐ **End search**: status returns to idle promptly (does not hang); final points are flushed.
- ☐ **Battery sanity**: note battery drain over a ~20-30 min active search; confirm it's
  tolerable with the screen on.
- ☐ **Watchtower mode**: start a Watchtower session; a stationary coverage disc of the chosen
  radius appears at your location and persists.

## 5. Sightings & verification

- ☐ As any user, report a sighting (location via current GPS, type, confidence, notes, photo).
  It appears **unverified** and does NOT change the probability surface.
- ☐ **Coordinator verify**: coordinator verifies it - it flips to **verified (coordinator)**
  and the probability surface visibly shifts toward it; "search next" re-ranks.
- ☐ **Coordinator reject**: a rejected sighting is excluded and never influences the surface.
- ☐ **Corroboration (needs 2 devices + Supabase)**: two *different* users submit sightings
  close in space and time - both auto-flip to **verified (corroboration)** without coordinator
  action, and the surface updates. Submit two from the *same* user - they stay unverified.
- ☐ A coordinator-rejected sighting stays rejected even if a corroborating report arrives.

## 6. Multi-device realtime (needs 2 devices + Supabase)

- ☐ Device A runs a search; Device B has the Map tab open for the same incident - B sees A's
  coverage appear **live** (within a few seconds), no manual refresh.
- ☐ A new verified sighting on one device appears on the other live.
- ☐ Two searchers on overlapping ground can see each other's coverage and avoid re-searching
  the same cells ("search next" points them elsewhere).

## 7. Map & "search here next"

- ☐ Toggle each layer (coverage, probability, rings, sightings, search-next) on/off.
- ☐ Heavily search one area, then confirm its coverage intensity is high and the
  probability/"search next" de-emphasizes it in favor of un-searched, plausible cells.
- ☐ Legend clearly explains the colors; verified vs unverified sightings are visually distinct.
- ☐ Time decay: revisit an incident hours later (or with seeded backdated data) - older
  coverage reads as faded relative to fresh coverage.

## 8. Robustness / edge cases

- ☐ Deny location permission - the app shows a clear error, doesn't crash, and other tabs
  still work.
- ☐ Low-accuracy GPS (urban canyon / indoors) - very inaccurate fixes are filtered out rather
  than drawing wild coverage.
- ☐ Poor connectivity - the app degrades gracefully (queues, retries) without data loss or
  silent failures.
- ☐ Many concurrent searchers (load test if possible before a large deployment): confirm the
  map and realtime stay responsive; check Supabase realtime connection limits for your plan.

## 9. Data correctness spot-check

- ☐ Pick a cell you personally searched and confirm it shows as covered; pick one you did not
  and confirm it does not.
- ☐ Confirm the IPP and every sighting marker sit at their true real-world locations.

---

## Deploy checklist (before going live)

- ☐ **Replace placeholder distance-prior values** in `src/signals/prior.ts` with vetted
  ISRID / Koester "Lost Person Behavior" data. (The current values are approximate and
  flagged in-code.)
- ☐ **Harden Supabase RLS**: restrict sighting verify/reject to coordinators; consider
  rate-limiting inserts. (Migration ships permissive with TODOs.)
- ☐ Host the PWA (Netlify / Cloudflare Pages) on your domain with HTTPS; point env vars at the
  hosted Supabase project.
- ☐ Set `VITE_MAPTILER_KEY` (or self-host tiles) for a real basemap.
- ☐ Confirm the "defer to authorities / call emergency services" disclaimer is visible.
- ☐ Decide data-retention / privacy handling for volunteer location data; close incidents when
  done.
- ☐ Brief coordinators and volunteers on the workflow (this doc's sections 3-6).

## Known limitations to communicate

- Background GPS on mobile web is unreliable (esp. iOS): tracking is **foreground + screen-on
  only**. True background needs the (deferred) native wrapper.
- Sighting photos are stored inline (data URL) in this POC; Supabase Storage is a follow-up.
- Corroboration is unweighted by reporter reputation (a follow-up); coordinators can always
  override.
