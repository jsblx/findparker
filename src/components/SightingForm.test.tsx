import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DataProviderContext, InMemoryProvider } from '../data';
import { SightingForm } from './SightingForm';

async function setup() {
  const provider = new InMemoryProvider();
  const profile = await provider.signInAnonymously('Jamie', 'searcher');
  const incident = await provider.createIncident({
    name: 'Test incident',
    subjectCategory: 'hiker',
    ipp: { lat: 1, lng: 2 },
  });
  return { provider, profile, incident };
}

describe('SightingForm', () => {
  it('submits a sighting with the right shape, defaulting to unverified', async () => {
    const { provider, profile, incident } = await setup();

    render(
      <DataProviderContext.Provider value={provider}>
        <SightingForm incidentId={incident.id} reportedBy={profile.id} />
      </DataProviderContext.Provider>,
    );

    fireEvent.change(screen.getByLabelText(/latitude/i), { target: { value: '10.5' } });
    fireEvent.change(screen.getByLabelText(/longitude/i), { target: { value: '20.5' } });
    fireEvent.change(screen.getByLabelText(/type/i), { target: { value: 'clothing' } });
    fireEvent.change(screen.getByLabelText(/confidence/i), { target: { value: '0.75' } });
    fireEvent.change(screen.getByLabelText(/notes/i), { target: { value: 'Red jacket near the ridge' } });

    fireEvent.click(screen.getByRole('button', { name: /submit sighting/i }));

    await waitFor(async () => {
      expect(await provider.listSightings(incident.id)).toHaveLength(1);
    });

    const [sighting] = await provider.listSightings(incident.id);
    expect(sighting).toMatchObject({
      incidentId: incident.id,
      reportedBy: profile.id,
      lat: 10.5,
      lng: 20.5,
      type: 'clothing',
      confidence: 0.75,
      notes: 'Red jacket near the ridge',
      status: 'unverified',
      verifiedVia: null,
      verifiedBy: null,
      corroboratesId: null,
    });

    expect(await screen.findByText(/sighting reported/i)).toBeInTheDocument();
  });

  it('blocks submission without a location', async () => {
    const { provider, profile, incident } = await setup();

    render(
      <DataProviderContext.Provider value={provider}>
        <SightingForm incidentId={incident.id} reportedBy={profile.id} />
      </DataProviderContext.Provider>,
    );

    fireEvent.click(screen.getByRole('button', { name: /submit sighting/i }));

    expect(await screen.findByText(/enter a location/i)).toBeInTheDocument();
    expect(await provider.listSightings(incident.id)).toHaveLength(0);
  });
});
