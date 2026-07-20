import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../data';
import { useCurrentUser } from '../CurrentUserContext';
import { SignInScreen } from '../components/SignInScreen';
import type { Incident, SubjectCategory } from '../types';

const SUBJECT_CATEGORIES: SubjectCategory[] = [
  'autistic_child',
  'dementia',
  'child_1_6',
  'child_7_12',
  'hiker',
  'despondent',
  'other',
];

export function Landing() {
  const data = useData();
  const navigate = useNavigate();
  const { profile, signOut } = useCurrentUser();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [name, setName] = useState('');
  const [subjectCategory, setSubjectCategory] = useState<SubjectCategory>('hiker');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  useEffect(() => {
    data.listIncidents().then(setIncidents);
  }, [data]);

  function useCurrentLocation() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocationError('Geolocation is not supported on this device.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(String(pos.coords.latitude));
        setLng(String(pos.coords.longitude));
        setLocating(false);
        setLocationError(null);
      },
      (err) => {
        setLocating(false);
        setLocationError(err.message || 'Could not get current location.');
      },
    );
  }

  async function handleCreateIncident(event: FormEvent) {
    event.preventDefault();
    const parsedLat = Number(lat);
    const parsedLng = Number(lng);
    if (!name.trim() || Number.isNaN(parsedLat) || Number.isNaN(parsedLng)) return;
    const incident = await data.createIncident({
      name: name.trim(),
      subjectCategory,
      ipp: { lat: parsedLat, lng: parsedLng },
    });
    setIncidents(await data.listIncidents());
    navigate(`/incident/${incident.id}/map`);
  }

  function openIncident(incident: Incident) {
    navigate(`/incident/${incident.id}/map`);
  }

  if (!profile) {
    return <SignInScreen />;
  }

  return (
    <div className="page">
      <h1>FindParker</h1>
      <p className="muted">
        Signed in as <strong>{profile.displayName}</strong> ({profile.role}){' '}
        <button type="button" onClick={signOut}>
          Sign out
        </button>
      </p>

      <section>
        <h2>Incidents</h2>
        {incidents.length === 0 && <p className="muted">No incidents yet.</p>}
        <ul className="list">
          {incidents.map((incident) => (
            <li key={incident.id}>
              <button className="list-item" onClick={() => openIncident(incident)}>
                <span>
                  <strong>{incident.name}</strong>
                  <br />
                  <span className="muted small">{incident.subjectCategory.replace(/_/g, ' ')}</span>
                </span>
                <span className="badge">{incident.status}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Start a new incident</h2>
        <p className="muted small">
          Any signed-in volunteer can create an incident for this POC, but in the field the coordinator normally
          owns incident setup.
        </p>
        <form className="stack" onSubmit={handleCreateIncident}>
          <label htmlFor="incidentName">Incident name</label>
          <input
            id="incidentName"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Mount Tam - missing hiker"
            required
          />
          <label htmlFor="subjectCategory">Subject category</label>
          <select
            id="subjectCategory"
            value={subjectCategory}
            onChange={(e) => setSubjectCategory(e.target.value as SubjectCategory)}
          >
            {SUBJECT_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category.replace(/_/g, ' ')}
              </option>
            ))}
          </select>

          <span className="muted small">Initial planning point (IPP)</span>
          <button type="button" onClick={useCurrentLocation} disabled={locating}>
            {locating ? 'Locating...' : 'Use current location'}
          </button>
          <label htmlFor="ippLat">Latitude</label>
          <input id="ippLat" type="number" step="any" value={lat} onChange={(e) => setLat(e.target.value)} required />
          <label htmlFor="ippLng">Longitude</label>
          <input id="ippLng" type="number" step="any" value={lng} onChange={(e) => setLng(e.target.value)} required />
          {locationError && <p className="error-banner">{locationError}</p>}

          <button type="submit" className="primary">
            Create incident
          </button>
        </form>
      </section>
    </div>
  );
}
