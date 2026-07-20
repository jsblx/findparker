import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../data';
import { useCurrentUser } from '../CurrentUserContext';
import type { Incident, Role, SubjectCategory } from '../types';

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
  const { profile, setProfile } = useCurrentUser();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<Role>('searcher');
  const [name, setName] = useState('');
  const [subjectCategory, setSubjectCategory] = useState<SubjectCategory>('hiker');

  useEffect(() => {
    data.listIncidents().then(setIncidents);
  }, [data]);

  async function handleSignIn(event: FormEvent) {
    event.preventDefault();
    if (!displayName.trim()) return;
    const signedIn = await data.signInAnonymously(displayName.trim(), role);
    setProfile(signedIn);
  }

  async function handleCreateIncident(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    const incident = await data.createIncident({
      name: name.trim(),
      subjectCategory,
      ipp: { lat: 37.7749, lng: -122.4194 },
    });
    setIncidents(await data.listIncidents());
    navigate(`/incident/${incident.id}/${role === 'coordinator' ? 'coordinator' : 'search'}`);
  }

  function openIncident(incident: Incident) {
    navigate(`/incident/${incident.id}/${role === 'coordinator' ? 'coordinator' : 'search'}`);
  }

  if (!profile) {
    return (
      <div className="page">
        <h1>FindParker</h1>
        <p className="muted">Coordinate volunteer search-and-rescue in the field.</p>
        <form className="stack" onSubmit={handleSignIn}>
          <label htmlFor="displayName">Your name</label>
          <input
            id="displayName"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g. Jamie"
            required
          />
          <label htmlFor="role">Your role</label>
          <select id="role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
            <option value="searcher">Searcher</option>
            <option value="coordinator">Coordinator</option>
          </select>
          <button type="submit" className="primary">
            Continue
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="page">
      <h1>FindParker</h1>
      <p className="muted">
        Signed in as <strong>{profile.displayName}</strong> ({profile.role})
      </p>

      <section>
        <h2>Incidents</h2>
        {incidents.length === 0 && <p className="muted">No incidents yet.</p>}
        <ul className="list">
          {incidents.map((incident) => (
            <li key={incident.id}>
              <button className="list-item" onClick={() => openIncident(incident)}>
                <span>{incident.name}</span>
                <span className="badge">{incident.status}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Start a new incident</h2>
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
          <button type="submit" className="primary">
            Create incident
          </button>
        </form>
      </section>
    </div>
  );
}
