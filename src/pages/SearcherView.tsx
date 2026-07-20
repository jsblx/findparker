import { useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useData } from '../data';
import { useSearchSession } from '../tracking';
import { useIncidentSurfaces } from '../map/useIncidentSurfaces';
import { DEFAULT_LAYER_TOGGLES, MapCanvas } from '../map/MapCanvas';
import { TrackingControls } from '../components/TrackingControls';
import type { SessionMode } from '../types';
import '../map/map.css';

export function SearcherView() {
  const { id } = useParams<{ id: string }>();
  const incidentId = id ?? '';
  const data = useData();
  const session = useSearchSession({ provider: data, incidentId });
  const { incident, coverage, probability, searchNext, promotedSightings } = useIncidentSurfaces(incidentId);

  const watchtowerAddedForSessionRef = useRef<string | null>(null);
  const pendingWatchtowerRadiusRef = useRef(100);

  function handleStart(mode: SessionMode, watchtowerRadiusM: number) {
    pendingWatchtowerRadiusRef.current = watchtowerRadiusM;
    void session.start(mode);
  }

  // Once a watchtower-mode session becomes active, drop a stationary watchtower at the
  // searcher's current location - a single fix, distinct from the session's continuous GPS watch.
  useEffect(() => {
    const active = session.session;
    if (!active || session.status !== 'active' || active.mode !== 'watchtower') return;
    if (watchtowerAddedForSessionRef.current === active.id) return;
    watchtowerAddedForSessionRef.current = active.id;
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;

    const radiusM = pendingWatchtowerRadiusRef.current;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        void data.addWatchtower({
          incidentId,
          sessionId: active.id,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          radiusM,
          activeFrom: Date.now(),
          activeTo: null,
        });
      },
      () => {
        // Watchtower placement is best-effort; the session's own error surface already
        // reports GPS problems via useSearchSession/useGeolocation.
      },
    );
  }, [session.session, session.status, data, incidentId]);

  return (
    <div className="page searcher-page">
      <h1>Searcher</h1>

      <TrackingControls
        status={session.status}
        pointsCollected={session.pointsCollected}
        queued={session.queued}
        wakeLockActive={session.wakeLockActive}
        supported={session.supported}
        error={session.error}
        onStart={handleStart}
        onEnd={() => void session.end()}
      />

      <section className="embedded-map-section">
        <h2>Coverage map</h2>
        <div className="embedded-map">
          <MapCanvas
            ipp={incident?.ipp ?? null}
            category={incident?.subjectCategory ?? 'other'}
            coverage={coverage}
            probability={probability}
            searchNext={searchNext}
            sightings={promotedSightings}
            toggles={DEFAULT_LAYER_TOGGLES}
          />
        </div>
        <Link to={`/incident/${incidentId}/map`} className="muted">
          Open full map -&gt;
        </Link>
      </section>
    </div>
  );
}
