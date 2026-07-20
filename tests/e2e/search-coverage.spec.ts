import { test, expect } from '@playwright/test';
import { signIn, createIncident, goToTab } from './helpers/app';
import { grantGeo, setPos, geoWalk } from './helpers/geo';

/**
 * Keeps the active-search window short by design: under Chromium's mocked geolocation, a
 * `watchPosition` subscription can end up re-registering on every render (see
 * tests/e2e/README.md's "known app issue" note), which floods the offline queue far faster
 * than a real device ever would. The counter still reliably goes from 0 to a positive number,
 * and stays positive/growing, well within a couple hundred ms - which is all this test needs -
 * but staying active for several extra seconds makes ending the session unreliable, so this
 * test doesn't linger.
 */
test('searcher starts a moving search, collects coverage points while walking, then ends it', async ({
  page,
  context,
}) => {
  await grantGeo(context);
  await setPos(context, 37.9235, -122.5965);

  await signIn(page, 'Searcher Sam', 'searcher');
  await createIncident(page, {
    name: 'Ridge trail search',
    category: 'hiker',
    lat: 37.9235,
    lng: -122.5965,
  });

  await goToTab(page, 'Search');

  await page.getByRole('button', { name: 'Start search' }).click();
  await expect(page.getByTestId('session-status')).toContainText('Active');

  const pointsLocator = page.getByTestId('points-collected');

  async function readPointsCollected(): Promise<number> {
    const text = await pointsLocator.textContent();
    const match = /Points collected: (\d+)/.exec(text ?? '');
    return match ? Number(match[1]) : 0;
  }

  // The very first GPS fix (from the position already mocked above) is emitted immediately,
  // so the counter should move above zero before any walking happens.
  await expect.poll(readPointsCollected, { timeout: 2000 }).toBeGreaterThan(0);
  const before = await readPointsCollected();

  await geoWalk(
    context,
    page,
    [
      [37.9235, -122.5965],
      [37.9238, -122.5968],
    ],
    { settleMs: 30 },
  );

  await expect.poll(readPointsCollected, { timeout: 2000 }).toBeGreaterThan(before);

  await page.getByRole('button', { name: 'End search' }).click();
  await expect(page.getByRole('button', { name: 'Start search' })).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId('session-status')).toHaveCount(0);
});
