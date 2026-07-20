import { test, expect } from '@playwright/test';
import { signIn, createIncident, goToTab, reportSighting } from './helpers/app';

test('coordinator reports a sighting, sees it unverified, then verifies it', async ({ page }) => {
  await signIn(page, 'Coordinator Jamie', 'coordinator');
  await createIncident(page, {
    name: 'Canyon search',
    category: 'hiker',
    lat: 37.9,
    lng: -122.6,
  });

  await goToTab(page, 'Coordinator');

  await reportSighting(page, {
    lat: 37.901,
    lng: -122.601,
    type: 'footprint',
    notes: 'Possible footprint near the creek crossing',
  });

  const card = page.getByTestId('sighting-card').first();
  await expect(card).toBeVisible();
  await expect(card.getByTestId('sighting-status-badge')).toHaveText('unverified');
  await expect(card.getByTestId('sighting-verified-via')).toHaveCount(0);

  await card.getByRole('button', { name: 'Verify' }).click();

  await expect(card.getByTestId('sighting-status-badge')).toHaveText('verified');
  await expect(card.getByTestId('sighting-verified-via')).toContainText('coordinator');
  await expect(card.getByRole('button', { name: 'Verify' })).toHaveCount(0);
});
