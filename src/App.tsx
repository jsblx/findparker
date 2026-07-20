import { Route, Routes } from 'react-router-dom';
import { Landing } from './pages/Landing';
import { IncidentLayout } from './pages/IncidentLayout';
import { SearcherView } from './pages/SearcherView';
import { MapView } from './pages/MapView';
import { CoordinatorView } from './pages/CoordinatorView';
import { AuthGate } from './components/AuthGate';

export function App() {
  return (
    <AuthGate>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/incident/:id" element={<IncidentLayout />}>
          <Route path="search" element={<SearcherView />} />
          <Route path="map" element={<MapView />} />
          <Route path="coordinator" element={<CoordinatorView />} />
        </Route>
      </Routes>
    </AuthGate>
  );
}
