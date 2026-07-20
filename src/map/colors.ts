/** Pure color-scale helpers shared by the map's deck.gl layers and its legend. */
import type { SightingStatus } from '../types';

export type RGBA = [number, number, number, number];

const COVERAGE_RGB: [number, number, number] = [37, 99, 235]; // blue-600
const COVERAGE_MAX_ALPHA = 220;

const PROBABILITY_LOW_RGB: [number, number, number] = [253, 224, 71]; // yellow-300
const PROBABILITY_HIGH_RGB: [number, number, number] = [185, 28, 28]; // red-700
const PROBABILITY_MAX_ALPHA = 230;

const SIGHTING_COLORS: Record<SightingStatus, RGBA> = {
  verified: [22, 163, 74, 235], // green-600, solid
  unverified: [234, 179, 8, 130], // amber-500, faded
  rejected: [120, 120, 120, 70], // grey, greyed out
};

const IPP_RGBA: RGBA = [11, 61, 46, 255]; // brand primary
const RING_RGBA: RGBA = [90, 90, 90, 160]; // neutral grey outline
const SEARCH_NEXT_RGBA: RGBA = [124, 58, 237, 220]; // violet-600 outline

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Coverage (probability-of-detection) fill color: transparent at pod=0, opaque blue at pod=1. */
export function coverageColor(pod: number): RGBA {
  const t = clamp01(pod);
  const [r, g, b] = COVERAGE_RGB;
  return [r, g, b, Math.round(t * COVERAGE_MAX_ALPHA)];
}

/** Remaining-probability heat color: yellow (low) to red (high), normalized against the surface's max. */
export function probabilityColor(p: number, max: number): RGBA {
  const t = max > 0 ? clamp01(p / max) : 0;
  const r = Math.round(lerp(PROBABILITY_LOW_RGB[0], PROBABILITY_HIGH_RGB[0], t));
  const g = Math.round(lerp(PROBABILITY_LOW_RGB[1], PROBABILITY_HIGH_RGB[1], t));
  const b = Math.round(lerp(PROBABILITY_LOW_RGB[2], PROBABILITY_HIGH_RGB[2], t));
  return [r, g, b, Math.round(t * PROBABILITY_MAX_ALPHA)];
}

/** Sighting marker color by verification status: verified is solid, unverified is faded, rejected is greyed. */
export function sightingColor(status: SightingStatus): RGBA {
  return SIGHTING_COLORS[status];
}

/** The Initial Planning Point marker color. */
export function ippColor(): RGBA {
  return IPP_RGBA;
}

/** Distance-ring outline color. */
export function ringColor(): RGBA {
  return RING_RGBA;
}

/** "Search here next" cell outline color. */
export function searchNextColor(): RGBA {
  return SEARCH_NEXT_RGBA;
}
