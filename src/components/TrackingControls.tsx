/**
 * Presentational tracking UI: takes a `useSearchSession` result (as flattened props) plus
 * start/end handlers, so it can be unit-tested without real GPS/wake-lock/visibility APIs.
 * Owns only the local, browser-API-free UI state for the mode/radius picker shown before start.
 */
import { useState } from 'react';
import type { SessionMode } from '../types';
import type { SessionStatus } from '../tracking';

export interface TrackingControlsProps {
  status: SessionStatus;
  pointsCollected: number;
  queued: number;
  wakeLockActive: boolean;
  supported: { geolocation: boolean; wakeLock: boolean };
  error: string | null;
  onStart: (mode: SessionMode, watchtowerRadiusM: number) => void;
  onEnd: () => void;
}

const DEFAULT_WATCHTOWER_RADIUS_M = 100;

export function TrackingControls({
  status,
  pointsCollected,
  queued,
  wakeLockActive,
  supported,
  error,
  onStart,
  onEnd,
}: TrackingControlsProps) {
  const [mode, setMode] = useState<SessionMode>('moving');
  const [radiusM, setRadiusM] = useState(DEFAULT_WATCHTOWER_RADIUS_M);
  const idle = status === 'idle';

  return (
    <div className="tracking-controls stack">
      <div className="mode-toggle" role="radiogroup" aria-label="Search mode">
        <label className={mode === 'moving' ? 'mode-option active' : 'mode-option'}>
          <input
            type="radio"
            name="mode"
            value="moving"
            checked={mode === 'moving'}
            disabled={!idle}
            onChange={() => setMode('moving')}
          />
          Moving
        </label>
        <label className={mode === 'watchtower' ? 'mode-option active' : 'mode-option'}>
          <input
            type="radio"
            name="mode"
            value="watchtower"
            checked={mode === 'watchtower'}
            disabled={!idle}
            onChange={() => setMode('watchtower')}
          />
          Watchtower
        </label>
      </div>

      {mode === 'watchtower' && idle && (
        <>
          <label htmlFor="watchtowerRadius">Watchtower radius (m)</label>
          <input
            id="watchtowerRadius"
            type="number"
            min={10}
            value={radiusM}
            onChange={(e) => setRadiusM(Number(e.target.value) || DEFAULT_WATCHTOWER_RADIUS_M)}
          />
        </>
      )}

      {idle ? (
        <button type="button" className="primary" onClick={() => onStart(mode, radiusM)}>
          Start search
        </button>
      ) : (
        <button type="button" className="danger" onClick={onEnd}>
          End search
        </button>
      )}

      {!idle && (
        <div className="status-panel">
          <p data-testid="session-status">
            Status: <strong>{status === 'paused' ? 'Paused' : 'Active'}</strong>
          </p>
          <p data-testid="points-collected">Points collected: {pointsCollected}</p>
          <p>Queued (offline): {queued}</p>
          <p>Screen wake lock: {wakeLockActive ? 'active' : 'inactive'}</p>
        </div>
      )}

      <div className="support-panel muted small">
        <p>GPS: {supported.geolocation ? 'supported' : 'not supported on this device'}</p>
        <p>Wake lock: {supported.wakeLock ? 'supported' : 'not supported on this device'}</p>
      </div>

      {status === 'paused' && (
        <p className="warning-banner" role="status">
          Tracking paused - reopen or keep this screen open to resume.
        </p>
      )}

      {error && (
        <p className="error-banner" role="alert">
          {error}
        </p>
      )}

      <p className="muted hint">Keep this screen on while searching for the most accurate coverage.</p>
    </div>
  );
}
