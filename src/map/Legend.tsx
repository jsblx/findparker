/** Explains the map's color scales. Colors are pulled from colors.ts so the legend can never drift from the layers. */
import { coverageColor, probabilityColor, ringColor, searchNextColor, sightingColor } from './colors';
import type { RGBA } from './colors';

function rgba([r, g, b, a]: RGBA): string {
  return `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(2)})`;
}

export function Legend() {
  return (
    <div className="map-panel legend" aria-label="Map legend">
      <h2>Legend</h2>

      <div className="legend-row">
        <span className="legend-swatch" style={{ background: rgba(coverageColor(1)) }} />
        <span>Coverage (searched, decays over time)</span>
      </div>

      <div className="legend-row">
        <span className="legend-swatch" style={{ background: rgba(probabilityColor(1, 1)) }} />
        <span>Remaining probability (yellow to red = higher)</span>
      </div>

      <div className="legend-row">
        <span className="legend-outline" style={{ borderColor: rgba(ringColor()) }} />
        <span>Distance rings (p25/p50/p75/p95 from IPP)</span>
      </div>

      <div className="legend-row">
        <span className="legend-dot" style={{ background: rgba(sightingColor('verified')) }} />
        <span>Verified sighting</span>
      </div>

      <div className="legend-row">
        <span className="legend-dot" style={{ background: rgba(sightingColor('unverified')) }} />
        <span>Unverified sighting</span>
      </div>

      <div className="legend-row">
        <span className="legend-outline" style={{ borderColor: rgba(searchNextColor()) }} />
        <span>Search here next</span>
      </div>
    </div>
  );
}
