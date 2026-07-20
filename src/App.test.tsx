import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from './App';
import { DataProviderContext, InMemoryProvider } from './data';
import { CurrentUserProvider } from './CurrentUserContext';

function renderApp(provider: InMemoryProvider) {
  return render(
    <DataProviderContext.Provider value={provider}>
      <CurrentUserProvider>
        <MemoryRouter initialEntries={['/']}>
          <App />
        </MemoryRouter>
      </CurrentUserProvider>
    </DataProviderContext.Provider>,
  );
}

describe('sign-in flow', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('shows the sign-in screen when no user is signed in', () => {
    renderApp(new InMemoryProvider());
    expect(screen.getByRole('heading', { name: /findparker/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/your name/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument();
  });

  it('signs in on submit and lands on the incident list', async () => {
    const provider = new InMemoryProvider();
    renderApp(provider);

    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: 'Jamie' } });
    fireEvent.change(screen.getByLabelText(/your role/i), { target: { value: 'coordinator' } });
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(async () => {
      const current = await provider.getCurrentUser();
      expect(current?.displayName).toBe('Jamie');
      expect(current?.role).toBe('coordinator');
    });

    expect(await screen.findByText(/signed in as/i)).toBeInTheDocument();
  });
});
