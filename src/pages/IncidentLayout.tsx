import { useEffect, useState } from 'react';
import { NavLink, Outlet, useParams } from 'react-router-dom';
import { useData } from '../data';
import { useCurrentUser } from '../CurrentUserContext';
import { SightingForm } from '../components/SightingForm';
import type { Incident, Role } from '../types';

function tabLinkClassName({ isActive }: { isActive: boolean }): string {
  return isActive ? 'tab-bar-link active' : 'tab-bar-link';
}

export function IncidentLayout() {
  const { id } = useParams<{ id: string }>();
  const incidentId = id ?? '';
  const data = useData();
  const { profile, setRole } = useCurrentUser();
  const [incident, setIncident] = useState<Incident | null>(null);
  const [showSightingForm, setShowSightingForm] = useState(false);

  useEffect(() => {
    let cancelled = false;
    function load() {
      data.getIncident(incidentId).then((found) => {
        if (!cancelled) setIncident(found);
      });
    }
    load();
    const unsubscribe = data.subscribe(incidentId, load);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [data, incidentId]);

  return (
    <div className="incident-layout">
      <header className="incident-header">
        <div className="incident-header-info">
          <strong>{incident?.name ?? 'Incident'}</strong>
          <span className="muted small">
            {incident ? incident.subjectCategory.replace(/_/g, ' ') : '...'}
            {incident ? ` - ${incident.status}` : ''}
          </span>
        </div>
        <div className="incident-header-actions">
          <select
            aria-label="Your role"
            value={profile?.role ?? 'searcher'}
            onChange={(e) => void setRole(e.target.value as Role)}
          >
            <option value="searcher">Searcher</option>
            <option value="coordinator">Coordinator</option>
          </select>
          <button type="button" className="primary" onClick={() => setShowSightingForm(true)}>
            Report sighting
          </button>
        </div>
      </header>

      <main className="incident-content">
        <Outlet />
      </main>

      <nav className="tab-bar">
        <NavLink to={`/incident/${incidentId}/search`} className={tabLinkClassName}>
          Search
        </NavLink>
        <NavLink to={`/incident/${incidentId}/map`} className={tabLinkClassName}>
          Map
        </NavLink>
        <NavLink to={`/incident/${incidentId}/coordinator`} className={tabLinkClassName}>
          Coordinator
        </NavLink>
      </nav>

      {showSightingForm && profile && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-sheet">
            <SightingForm incidentId={incidentId} reportedBy={profile.id} onClose={() => setShowSightingForm(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
