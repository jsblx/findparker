import { StrictMode, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import './index.css';
import { createDataProvider, DataProviderContext } from './data';
import { CurrentUserProvider } from './CurrentUserContext';

function Root() {
  const provider = useMemo(() => createDataProvider(), []);

  return (
    <DataProviderContext.Provider value={provider}>
      <CurrentUserProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </CurrentUserProvider>
    </DataProviderContext.Provider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
