import { test, expect } from '@playwright/test';
import { signIn, createIncident } from './helpers/app';

test('sign in as coordinator, create an incident, land on its map with all three tabs', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push(err.message));

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'FindParker' })).toBeVisible();
  await expect(page.getByLabel('Your name')).toBeVisible();
  await expect(page.getByLabel('Your role')).toBeVisible();

  await signIn(page, 'Coordinator Casey', 'coordinator');

  await createIncident(page, {
    name: 'Mount Tam - missing hiker',
    category: 'hiker',
    lat: 37.9235,
    lng: -122.5965,
  });

  await expect(page).toHaveURL(/\/incident\/[^/]+\/map/);
  await expect(page.getByRole('link', { name: 'Search' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Map' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Coordinator' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Map' })).toHaveClass(/active/);

  expect(consoleErrors, `Unexpected console errors:\n${consoleErrors.join('\n')}`).toEqual([]);
});
