import { NavLink, Outlet, useParams } from 'react-router-dom';

function tabLinkClassName({ isActive }: { isActive: boolean }): string {
  return isActive ? 'tab-bar-link active' : 'tab-bar-link';
}

export function IncidentLayout() {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="incident-layout">
      <header className="incident-header">
        <span className="muted">Incident</span>
        <code>{id}</code>
      </header>
      <main className="incident-content">
        <Outlet />
      </main>
      <nav className="tab-bar">
        <NavLink to={`/incident/${id}/search`} className={tabLinkClassName}>
          Search
        </NavLink>
        <NavLink to={`/incident/${id}/map`} className={tabLinkClassName}>
          Map
        </NavLink>
        <NavLink to={`/incident/${id}/coordinator`} className={tabLinkClassName}>
          Coordinator
        </NavLink>
      </nav>
    </div>
  );
}
