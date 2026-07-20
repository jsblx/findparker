/** Mobile-friendly checkbox panel for toggling each map overlay on/off. */
import type { LayerToggles as LayerTogglesState } from './MapCanvas';

const OPTIONS: Array<{ key: keyof LayerTogglesState; label: string }> = [
  { key: 'coverage', label: 'Coverage' },
  { key: 'probability', label: 'Probability' },
  { key: 'rings', label: 'Distance rings' },
  { key: 'sightings', label: 'Sightings' },
  { key: 'searchNext', label: 'Search next' },
];

export interface LayerTogglesProps {
  toggles: LayerTogglesState;
  onChange: (next: LayerTogglesState) => void;
}

export function LayerToggles({ toggles, onChange }: LayerTogglesProps) {
  function toggle(key: keyof LayerTogglesState) {
    onChange({ ...toggles, [key]: !toggles[key] });
  }

  return (
    <div className="map-panel layer-toggles" role="group" aria-label="Map layers">
      {OPTIONS.map((option) => (
        <label key={option.key} className="layer-toggle">
          <input
            type="checkbox"
            checked={toggles[option.key]}
            onChange={() => toggle(option.key)}
          />
          <span>{option.label}</span>
        </label>
      ))}
    </div>
  );
}
