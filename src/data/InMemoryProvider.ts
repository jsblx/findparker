import type { DataProvider } from './DataProvider';
import type {
  Incident,
  Profile,
  Role,
  SearchSession,
  SessionMode,
  Sighting,
  TrackPoint,
  Watchtower,
} from '../types';

export interface InMemorySeed {
  currentUser?: Profile;
  incidents?: Incident[];
  sessions?: SearchSession[];
  trackPoints?: TrackPoint[];
  watchtowers?: Watchtower[];
  sightings?: Sighting[];
}

let idCounter = 0;

function nextId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

/**
 * Fully working in-memory DataProvider backed by plain arrays. Powers local dev without a
 * backend, and drives E2E tests. `subscribe` fakes realtime by notifying listeners
 * synchronously whenever a mutating method is called.
 */
export class InMemoryProvider implements DataProvider {
  private currentUser: Profile | null;
  private incidents: Incident[];
  private sessions: SearchSession[];
  private trackPoints: TrackPoint[];
  private watchtowers: Watchtower[];
  private sightings: Sighting[];
  private listeners: Map<string, Set<() => void>> = new Map();

  constructor(seed?: InMemorySeed) {
    this.currentUser = seed?.currentUser ?? null;
    this.incidents = seed?.incidents ?? [];
    this.sessions = seed?.sessions ?? [];
    this.trackPoints = seed?.trackPoints ?? [];
    this.watchtowers = seed?.watchtowers ?? [];
    this.sightings = seed?.sightings ?? [];
  }

  private notify(incidentId: string): void {
    for (const listener of this.listeners.get(incidentId) ?? []) {
      listener();
    }
  }

  async getCurrentUser(): Promise<Profile | null> {
    return this.currentUser;
  }

  async signInAnonymously(displayName: string, role: Role): Promise<Profile> {
    const profile: Profile = { id: nextId('user'), displayName, role };
    this.currentUser = profile;
    return profile;
  }

  async setRole(role: Role): Promise<Profile> {
    if (!this.currentUser) {
      throw new Error('Cannot set role: no current user is signed in');
    }
    this.currentUser = { ...this.currentUser, role };
    return this.currentUser;
  }

  async listIncidents(): Promise<Incident[]> {
    return [...this.incidents].sort((a, b) => b.startedAt - a.startedAt);
  }

  async getIncident(id: string): Promise<Incident | null> {
    return this.incidents.find((i) => i.id === id) ?? null;
  }

  async createIncident(
    input: Omit<Incident, 'id' | 'startedAt' | 'status'> & Partial<Pick<Incident, 'status'>>,
  ): Promise<Incident> {
    const incident: Incident = {
      id: nextId('incident'),
      startedAt: Date.now(),
      status: input.status ?? 'active',
      name: input.name,
      subjectCategory: input.subjectCategory,
      ipp: input.ipp,
    };
    this.incidents.push(incident);
    this.notify(incident.id);
    return incident;
  }

  async updateIncident(id: string, patch: Partial<Incident>): Promise<Incident> {
    const index = this.incidents.findIndex((i) => i.id === id);
    if (index === -1) {
      throw new Error(`Incident not found: ${id}`);
    }
    const updated = { ...this.incidents[index], ...patch, id };
    this.incidents[index] = updated;
    this.notify(id);
    return updated;
  }

  async startSession(incidentId: string, mode: SessionMode): Promise<SearchSession> {
    if (!this.currentUser) {
      throw new Error('Cannot start session: no current user is signed in');
    }
    const session: SearchSession = {
      id: nextId('session'),
      incidentId,
      userId: this.currentUser.id,
      mode,
      startedAt: Date.now(),
      endedAt: null,
    };
    this.sessions.push(session);
    this.notify(incidentId);
    return session;
  }

  async endSession(sessionId: string): Promise<void> {
    const index = this.sessions.findIndex((s) => s.id === sessionId);
    if (index === -1) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    const session = { ...this.sessions[index], endedAt: Date.now() };
    this.sessions[index] = session;
    this.notify(session.incidentId);
  }

  async appendTrackPoints(
    sessionId: string,
    points: Array<Omit<TrackPoint, 'id' | 'sessionId'>>,
  ): Promise<void> {
    const session = this.sessions.find((s) => s.id === sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    for (const point of points) {
      this.trackPoints.push({ ...point, id: nextId('track'), sessionId });
    }
    this.notify(session.incidentId);
  }

  async listTrackPoints(incidentId: string): Promise<TrackPoint[]> {
    const sessionIds = new Set(
      this.sessions.filter((s) => s.incidentId === incidentId).map((s) => s.id),
    );
    return this.trackPoints.filter((t) => sessionIds.has(t.sessionId));
  }

  async addWatchtower(input: Omit<Watchtower, 'id'>): Promise<Watchtower> {
    const watchtower: Watchtower = { ...input, id: nextId('watchtower') };
    this.watchtowers.push(watchtower);
    this.notify(watchtower.incidentId);
    return watchtower;
  }

  async listWatchtowers(incidentId: string): Promise<Watchtower[]> {
    return this.watchtowers.filter((w) => w.incidentId === incidentId);
  }

  async submitSighting(
    input: Omit<Sighting, 'id' | 'status' | 'verifiedBy' | 'verifiedVia' | 'corroboratesId'>,
  ): Promise<Sighting> {
    const sighting: Sighting = {
      ...input,
      id: nextId('sighting'),
      status: 'unverified',
      verifiedBy: null,
      verifiedVia: null,
      corroboratesId: null,
    };
    this.sightings.push(sighting);
    this.notify(sighting.incidentId);
    return sighting;
  }

  async listSightings(incidentId: string): Promise<Sighting[]> {
    return this.sightings.filter((s) => s.incidentId === incidentId);
  }

  async verifySighting(id: string, coordinatorId: string): Promise<Sighting> {
    const index = this.sightings.findIndex((s) => s.id === id);
    if (index === -1) {
      throw new Error(`Sighting not found: ${id}`);
    }
    const updated: Sighting = {
      ...this.sightings[index],
      status: 'verified',
      verifiedVia: 'coordinator',
      verifiedBy: coordinatorId,
    };
    this.sightings[index] = updated;
    this.notify(updated.incidentId);
    return updated;
  }

  async rejectSighting(id: string, coordinatorId: string): Promise<Sighting> {
    const index = this.sightings.findIndex((s) => s.id === id);
    if (index === -1) {
      throw new Error(`Sighting not found: ${id}`);
    }
    const updated: Sighting = {
      ...this.sightings[index],
      status: 'rejected',
      verifiedVia: null,
      verifiedBy: coordinatorId,
    };
    this.sightings[index] = updated;
    this.notify(updated.incidentId);
    return updated;
  }

  subscribe(incidentId: string, onChange: () => void): () => void {
    if (!this.listeners.has(incidentId)) {
      this.listeners.set(incidentId, new Set());
    }
    const set = this.listeners.get(incidentId)!;
    set.add(onChange);
    return () => {
      set.delete(onChange);
    };
  }
}
