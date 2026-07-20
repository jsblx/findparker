import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { DEFAULT_LAYER_TOGGLES, MapCanvas } from '../map/MapCanvas';
import { LayerToggles } from '../map/LayerToggles';
import { Legend } from '../map/Legend';
import { useIncidentSurfaces } from '../map/useIncidentSurfaces';
import '../map/map.css';
import type { LayerToggles as LayerTogglesState } from '../map/MapCanvas';

export function MapView() {
  const { id } = useParams<{ id: string }>();
  const [toggles, setToggles] = useState<LayerTogglesState>(DEFAULT_LAYER_TOGGLES);
  const {
    incident,
    trackPoints,
    watchtowers,
    sightings,
    promotedSightings,
    coverage,
    probability,
    searchNext,
    loading,
    error,
  } = useIncidentSurfaces(id ?? '');

  if (!id) {
    return (
      <div className="page">
        <p className="muted">No incident selected.</p>
      </div>
    );
  }

  const hasAnyData = trackPoints.length > 0 || watchtowers.length > 0 || sightings.length > 0;

  return (
    <div className="map-page">
      <MapCanvas
        ipp={incident?.ipp ?? null}
        category={incident?.subjectCategory ?? 'other'}
        coverage={coverage}
        probability={probability}
        searchNext={searchNext}
        sightings={promotedSightings}
        toggles={toggles}
      />

      {incident && (
        <>
          <LayerToggles toggles={toggles} onChange={setToggles} />
          <Legend />
        </>
      )}

      {loading && (
        <div className="map-panel map-status-banner">
          <p className="muted">Loading incident...</p>
        </div>
      )}

      {!loading && error && (
        <div className="map-panel map-status-banner">
          <h2>Couldn&apos;t load the map</h2>
          <p className="muted">{error.message}</p>
        </div>
      )}

      {!loading && !error && !incident && (
        <div className="map-panel map-status-banner">
          <h2>Incident not found</h2>
          <p className="muted">This incident doesn&apos;t exist or hasn&apos;t loaded yet.</p>
        </div>
      )}

      {!loading && !error && incident && !hasAnyData && (
        <div className="map-panel map-status-banner">
          <h2>No coverage yet</h2>
          <p className="muted">No coverage yet - start a search or set up the incident.</p>
        </div>
      )}
    </div>
  );
}
