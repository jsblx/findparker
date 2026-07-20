/**
 * Sighting moderation list, presentational: renders each sighting's EFFECTIVE status (taken
 * from `promotedSightings`, so a corroboration-promoted report reads as verified even though the
 * raw record is still `unverified`), and exposes Verify/Reject only to coordinators.
 */
import { haversineM } from '../signals';
import type { LatLng, Role, Sighting } from '../types';

export interface SightingListProps {
  sightings: Sighting[];
  promotedSightings: Sighting[];
  ipp: LatLng | null;
  role: Role;
  onVerify: (id: string) => void;
  onReject: (id: string) => void;
}

export function SightingList({ sightings, promotedSightings, ipp, role, onVerify, onReject }: SightingListProps) {
  if (sightings.length === 0) {
    return <p className="muted">No sightings reported yet.</p>;
  }

  const effectiveById = new Map(promotedSightings.map((s) => [s.id, s]));
  const isCoordinator = role === 'coordinator';

  const sorted = [...sightings].sort((a, b) => b.observedAt - a.observedAt);

  return (
    <ul className="list sighting-list">
      {sorted.map((raw) => {
        const effective = effectiveById.get(raw.id) ?? raw;
        const distanceM = ipp ? haversineM(ipp, { lat: effective.lat, lng: effective.lng }) : null;

        return (
          <li key={effective.id} className="sighting-card">
            <div className="sighting-card-header">
              <span className={`badge badge-${effective.status}`}>{effective.status}</span>
              {effective.verifiedVia && <span className="muted small">via {effective.verifiedVia}</span>}
              <span className="muted small">{new Date(effective.observedAt).toLocaleString()}</span>
            </div>
            <p>
              <strong>{effective.type}</strong> - confidence {Math.round(effective.confidence * 100)}%
              {distanceM !== null && ` - ${Math.round(distanceM)}m from IPP`}
            </p>
            <p className="muted small">Reported by {effective.reportedBy}</p>
            {effective.notes && <p>{effective.notes}</p>}
            {effective.photoUrl && <img src={effective.photoUrl} alt="Sighting" className="photo-thumbnail" />}
            {effective.status === 'unverified' &&
              (isCoordinator ? (
                <div className="form-actions">
                  <button type="button" className="primary" onClick={() => onVerify(effective.id)}>
                    Verify
                  </button>
                  <button type="button" className="danger" onClick={() => onReject(effective.id)}>
                    Reject
                  </button>
                </div>
              ) : (
                <p className="muted small">Coordinator only: verify/reject actions are hidden.</p>
              ))}
          </li>
        );
      })}
    </ul>
  );
}
