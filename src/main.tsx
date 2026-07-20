import { StrictMode, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import './index.css';
import { createDataProvider, DataProviderContext } from './data';
import { CurrentUserContext } from './CurrentUserContext';
import type { Profile } from './types';

function Root() {
  const provider = useMemo(() => createDataProvider(), []);
  const [profile, setProfile] = useState<Profile | null>(null);

  return (
    <DataProviderContext.Provider value={provider}>
      <CurrentUserContext.Provider value={{ profile, setProfile }}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </CurrentUserContext.Provider>
    </DataProviderContext.Provider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
