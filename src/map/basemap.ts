/** Resolves which MapLibre base style to use, preferring configured tile sources but always
 * falling back to a blank, keyless, network-free style so the app renders in tests/offline. */
import type { StyleSpecification } from 'maplibre-gl';

const BLANK_STYLE: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [
    {
      id: 'background',
      type: 'background',
      paint: { 'background-color': '#e9e9e4' },
    },
  ],
};

/**
 * Resolves the basemap style, in priority order:
 * 1. `VITE_MAPTILER_KEY` set -> a hosted MapTiler style URL.
 * 2. `VITE_MAP_STYLE` set -> used verbatim (a style URL or JSON string is left to MapLibre to parse).
 * 3. Neither set -> a blank inline style (no network, no key).
 */
export function resolveBasemapStyle(): string | StyleSpecification {
  const env = import.meta.env as Record<string, string | undefined>;
  const maptilerKey = env.VITE_MAPTILER_KEY;
  if (maptilerKey) {
    return `https://api.maptiler.com/maps/streets-v2/style.json?key=${maptilerKey}`;
  }

  const mapStyle = env.VITE_MAP_STYLE;
  if (mapStyle) {
    return mapStyle;
  }

  return BLANK_STYLE;
}
