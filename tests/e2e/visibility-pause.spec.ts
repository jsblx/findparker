import { test, expect } from '@playwright/test';
import { signIn, createIncident, goToTab } from './helpers/app';
import { grantGeo, setPos } from './helpers/geo';

/**
 * Drives document.visibilityState directly (there's no real "switch tabs" affordance in a
 * single Playwright page) and dispatches visibilitychange, which is exactly what
 * useVisibility/useSearchSession listen for. Best-effort per the task brief: if this proves
 * flaky in headless CI, convert to test.fixme and rely on tests/e2e/README.md plus
 * src/tracking/useSearchSession.test.ts (which covers the same pause/resume transition against
 * an injected fake VisibilityDoc) instead.
 */
test('active search pauses when the tab is hidden and resumes when visible again', async ({ page, context }) => {
  await grantGeo(context);
  await setPos(context, 37.9235, -122.5965);

  await signIn(page, 'Searcher Alex', 'searcher');
  await createIncident(page, {
    name: 'Valley search',
    category: 'hiker',
    lat: 37.9235,
    lng: -122.5965,
  });

  await goToTab(page, 'Search');
  await page.getByRole('button', { name: 'Start search' }).click();
  await expect(page.getByTestId('session-status')).toContainText('Active');

  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });

  await expect(page.getByTestId('session-status')).toContainText('Paused');
  await expect(page.getByText(/tracking paused/i)).toBeVisible();

  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
  });

  await expect(page.getByTestId('session-status')).toContainText('Active');
});
