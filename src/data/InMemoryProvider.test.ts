import { describe, expect, it } from 'vitest';
import { InMemoryProvider } from './InMemoryProvider';

async function setup() {
  const provider = new InMemoryProvider();
  await provider.signInAnonymously('Jamie', 'coordinator');
  const incident = await provider.createIncident({
    name: 'Test incident',
    subjectCategory: 'hiker',
    ipp: { lat: 1, lng: 2 },
  });
  return { provider, incident };
}

describe('InMemoryProvider', () => {
  it('creates incidents with defaulted status and startedAt', async () => {
    const { incident } = await setup();
    expect(incident.status).toBe('active');
    expect(incident.startedAt).toBeGreaterThan(0);
  });

  it('submits sightings as unverified with no verifier or corroboration', async () => {
    const { provider, incident } = await setup();
    const sighting = await provider.submitSighting({
      incidentId: incident.id,
      reportedBy: 'user-1',
      lat: 1,
      lng: 2,
      observedAt: Date.now(),
      type: 'visual',
      confidence: 0.5,
      notes: '',
      photoUrl: null,
    });
    expect(sighting.status).toBe('unverified');
    expect(sighting.verifiedBy).toBeNull();
    expect(sighting.verifiedVia).toBeNull();
    expect(sighting.corroboratesId).toBeNull();
  });

  it('verifySighting sets status, verifiedVia, and verifiedBy', async () => {
    const { provider, incident } = await setup();
    const sighting = await provider.submitSighting({
      incidentId: incident.id,
      reportedBy: 'user-1',
      lat: 1,
      lng: 2,
      observedAt: Date.now(),
      type: 'visual',
      confidence: 0.5,
      notes: '',
      photoUrl: null,
    });
    const verified = await provider.verifySighting(sighting.id, 'coordinator-1');
    expect(verified.status).toBe('verified');
    expect(verified.verifiedVia).toBe('coordinator');
    expect(verified.verifiedBy).toBe('coordinator-1');
  });

  it('rejectSighting sets status to rejected', async () => {
    const { provider, incident } = await setup();
    const sighting = await provider.submitSighting({
      incidentId: incident.id,
      reportedBy: 'user-1',
      lat: 1,
      lng: 2,
      observedAt: Date.now(),
      type: 'visual',
      confidence: 0.5,
      notes: '',
      photoUrl: null,
    });
    const rejected = await provider.rejectSighting(sighting.id, 'coordinator-1');
    expect(rejected.status).toBe('rejected');
  });

  it('notifies subscribers on mutation and stops after unsubscribe', async () => {
    const { provider, incident } = await setup();
    let calls = 0;
    const unsubscribe = provider.subscribe(incident.id, () => {
      calls += 1;
    });

    await provider.startSession(incident.id, 'moving');
    expect(calls).toBe(1);

    unsubscribe();
    await provider.startSession(incident.id, 'moving');
    expect(calls).toBe(1);
  });

  it('appendTrackPoints and listTrackPoints round-trip', async () => {
    const { provider, incident } = await setup();
    const session = await provider.startSession(incident.id, 'moving');
    await provider.appendTrackPoints(session.id, [
      { lat: 1, lng: 2, accuracyM: 5, recordedAt: Date.now() },
    ]);
    const points = await provider.listTrackPoints(incident.id);
    expect(points).toHaveLength(1);
    expect(points[0].sessionId).toBe(session.id);
  });
});
