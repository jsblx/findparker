/**
 * Geolocation helpers for driving the app's GPS-dependent flows in Playwright.
 *
 * The app throttles accepted GPS fixes to at most one every `CONFIG.GPS_SAMPLE_INTERVAL_MS`
 * (see `useGeolocation`'s `lastEmitAtRef` check), using `Date.now()` for that comparison.
 * Waiting out that interval in real time would make every search-tracking test slow, so
 * `geoWalk` instead advances a fixed, mocked `Date.now()` (via Playwright's clock API)
 * between steps - `setTimeout`/`requestAnimationFrame` (and therefore React's rendering and
 * deck.gl/MapLibre's own animation) keep running on real wall-clock time, only `Date.now()`
 * jumps forward, so the throttle sees each step as far enough apart to accept the new fix.
 */
import type { BrowserContext, Page } from '@playwright/test';
import { CONFIG } from '../../../src/config';

export async function grantGeo(context: BrowserContext): Promise<void> {
  await context.grantPermissions(['geolocation']);
}

export async function setPos(context: BrowserContext, lat: number, lng: number): Promise<void> {
  await context.setGeolocation({ latitude: lat, longitude: lng });
}

export interface GeoWalkOptions {
  /** Simulated ms to advance between steps. Must exceed GPS_SAMPLE_INTERVAL_MS for every step to be accepted. */
  stepMs?: number;
  /** Real ms to wait after each fix so the app's async queue/flush chain and React re-render can settle. */
  settleMs?: number;
}

/**
 * Steps `context.setGeolocation` along `path`, advancing a mocked `Date.now()` by `stepMs`
 * between each fix so the app's watchPosition callback emits one breadcrumb per step instead
 * of being throttled away.
 */
export async function geoWalk(
  context: BrowserContext,
  page: Page,
  path: Array<[number, number]>,
  { stepMs = CONFIG.GPS_SAMPLE_INTERVAL_MS + 1000, settleMs = 200 }: GeoWalkOptions = {},
): Promise<void> {
  let simulatedNow = Date.now();
  await page.clock.setFixedTime(simulatedNow);

  for (const [lat, lng] of path) {
    await setPos(context, lat, lng);
    await page.waitForTimeout(settleMs);
    simulatedNow += stepMs;
    await page.clock.setFixedTime(simulatedNow);
  }
}
