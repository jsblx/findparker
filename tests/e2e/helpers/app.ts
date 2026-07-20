/** High-level page-driving helpers shared across FindParker E2E specs. */
import { expect, type Page } from '@playwright/test';
import type { Role, SubjectCategory, SightingType } from '../../../src/types';

/** Signs in via the POC-simple name+role form and waits for the signed-in Landing page. */
export async function signIn(page: Page, name: string, role: Role = 'searcher'): Promise<void> {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'FindParker' })).toBeVisible();
  await page.getByLabel('Your name').fill(name);
  await page.getByLabel('Your role').selectOption(role);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText(`Signed in as`)).toBeVisible();
  await expect(page.getByText(name, { exact: false })).toBeVisible();
}

export interface CreateIncidentOptions {
  name: string;
  category?: SubjectCategory;
  lat: number;
  lng: number;
}

/** Creates an incident from the Landing page's "Start a new incident" form (manual lat/lng IPP) and waits to land on its map tab. */
export async function createIncident(page: Page, opts: CreateIncidentOptions): Promise<string> {
  await page.getByLabel('Incident name').fill(opts.name);
  if (opts.category) {
    await page.getByLabel('Subject category').selectOption(opts.category);
  }
  await page.getByLabel('Latitude', { exact: true }).fill(String(opts.lat));
  await page.getByLabel('Longitude', { exact: true }).fill(String(opts.lng));
  await page.getByRole('button', { name: 'Create incident' }).click();
  await page.waitForURL(/\/incident\/[^/]+\/map/);
  const match = /\/incident\/([^/]+)\/map/.exec(page.url());
  if (!match) throw new Error(`Unexpected URL after creating incident: ${page.url()}`);
  return match[1];
}

export type IncidentTab = 'Search' | 'Map' | 'Coordinator';

/** Switches tabs within the current incident via the bottom tab bar. */
export async function goToTab(page: Page, tab: IncidentTab): Promise<void> {
  await page.getByRole('link', { name: tab }).click();
  await expect(page).toHaveURL(new RegExp(`/incident/[^/]+/${tab.toLowerCase()}`));
}

export interface ReportSightingOptions {
  lat: number;
  lng: number;
  type?: SightingType;
  notes?: string;
}

/** Opens the "Report sighting" modal (available from any incident tab), fills it in, and submits it. */
export async function reportSighting(page: Page, opts: ReportSightingOptions): Promise<void> {
  await page.getByRole('button', { name: 'Report sighting' }).click();
  await expect(page.getByRole('heading', { name: 'Report a sighting' })).toBeVisible();

  await page.getByLabel('Latitude', { exact: true }).fill(String(opts.lat));
  await page.getByLabel('Longitude', { exact: true }).fill(String(opts.lng));
  if (opts.type) {
    await page.getByLabel('Type').selectOption(opts.type);
  }
  if (opts.notes) {
    await page.getByLabel('Notes').fill(opts.notes);
  }

  await page.getByRole('button', { name: 'Submit sighting' }).click();
  await expect(page.getByRole('heading', { name: 'Sighting reported' })).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();
}
