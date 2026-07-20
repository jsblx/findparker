import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { useData } from '../data';
import { useCurrentUser } from '../CurrentUserContext';
import { useIncidentSurfaces } from '../map/useIncidentSurfaces';
import { DEFAULT_LAYER_TOGGLES, MapCanvas } from '../map/MapCanvas';
import { SightingList } from '../components/SightingList';
import type { SubjectCategory } from '../types';
import '../map/map.css';

const SUBJECT_CATEGORIES: SubjectCategory[] = [
  'autistic_child',
  'dementia',
  'child_1_6',
  'child_7_12',
  'hiker',
  'despondent',
  'other',
];

export function CoordinatorView() {
  const { id } = useParams<{ id: string }>();
  const incidentId = id ?? '';
  const data = useData();
  const { profile } = useCurrentUser();
  const { incident, sightings, promotedSightings, coverage, probability, searchNext, loading } =
    useIncidentSurfaces(incidentId);

  const isCoordinator = profile?.role === 'coordinator';

  const [subjectCategory, setSubjectCategory] = useState<SubjectCategory>('other');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!incident) return;
    setSubjectCategory(incident.subjectCategory);
    setLat(String(incident.ipp.lat));
    setLng(String(incident.ipp.lng));
  }, [incident]);

  async function handleSaveSettings(event: FormEvent) {
    event.preventDefault();
    const parsedLat = Number(lat);
    const parsedLng = Number(lng);
    if (Number.isNaN(parsedLat) || Number.isNaN(parsedLng)) return;
    setSaving(true);
    try {
      await data.updateIncident(incidentId, { subjectCategory, ipp: { lat: parsedLat, lng: parsedLng } });
    } finally {
      setSaving(false);
    }
  }

  async function handleCloseIncident() {
    await data.updateIncident(incidentId, { status: 'closed' });
  }

  async function handleVerify(sightingId: string) {
    if (!profile) return;
    await data.verifySighting(sightingId, profile.id);
  }

  async function handleReject(sightingId: string) {
    if (!profile) return;
    await data.rejectSighting(sightingId, profile.id);
  }

  if (loading || !incident) {
    return (
      <div className="page">
        <p className="muted">{loading ? 'Loading incident...' : 'Incident not found.'}</p>
      </div>
    );
  }

  return (
    <div className="page coordinator-page">
      <h1>Coordinator</h1>

      <section>
        <h2>Incident settings</h2>
        {!isCoordinator && (
          <p className="muted small">Coordinator only: settings are managed by the coordinator.</p>
        )}
        <form className="stack" onSubmit={handleSaveSettings}>
          <label htmlFor="coordSubject">Subject category</label>
          <select
            id="coordSubject"
            value={subjectCategory}
            disabled={!isCoordinator}
            onChange={(e) => setSubjectCategory(e.target.value as SubjectCategory)}
          >
            {SUBJECT_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
          <label htmlFor="coordLat">IPP latitude</label>
          <input
            id="coordLat"
            type="number"
            step="any"
            value={lat}
            disabled={!isCoordinator}
            onChange={(e) => setLat(e.target.value)}
          />
          <label htmlFor="coordLng">IPP longitude</label>
          <input
            id="coordLng"
            type="number"
            step="any"
            value={lng}
            disabled={!isCoordinator}
            onChange={(e) => setLng(e.target.value)}
          />
          {isCoordinator && (
            <button type="submit" className="primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save changes'}
            </button>
          )}
        </form>
        {isCoordinator && incident.status === 'active' && (
          <button type="button" className="danger" onClick={() => void handleCloseIncident()}>
            Close incident
          </button>
        )}
        {incident.status === 'closed' && <span className="badge">Closed</span>}
      </section>

      <section>
        <h2>Map</h2>
        <div className="embedded-map">
          <MapCanvas
            ipp={incident.ipp}
            category={incident.subjectCategory}
            coverage={coverage}
            probability={probability}
            searchNext={searchNext}
            sightings={promotedSightings}
            toggles={DEFAULT_LAYER_TOGGLES}
          />
        </div>
      </section>

      <section>
        <h2>Sighting moderation</h2>
        <SightingList
          sightings={sightings}
          promotedSightings={promotedSightings}
          ipp={incident.ipp}
          role={profile?.role ?? 'searcher'}
          onVerify={(sightingId) => void handleVerify(sightingId)}
          onReject={(sightingId) => void handleReject(sightingId)}
        />
      </section>
    </div>
  );
}
