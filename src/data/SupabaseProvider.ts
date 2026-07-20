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

const NOT_IMPLEMENTED = 'SupabaseProvider not implemented yet';

/**
 * Supabase-backed DataProvider. Stubbed for the foundation slice - a later slice fills in
 * the actual Supabase client calls (tables, RLS, realtime channels) behind this same
 * DataProvider contract so the rest of the app never has to change.
 */
export class SupabaseProvider implements DataProvider {
  constructor(_url: string, _anonKey: string) {}

  async getCurrentUser(): Promise<Profile | null> {
    throw new Error(NOT_IMPLEMENTED);
  }

  async signInAnonymously(_displayName: string, _role: Role): Promise<Profile> {
    throw new Error(NOT_IMPLEMENTED);
  }

  async setRole(_role: Role): Promise<Profile> {
    throw new Error(NOT_IMPLEMENTED);
  }

  async listIncidents(): Promise<Incident[]> {
    throw new Error(NOT_IMPLEMENTED);
  }

  async getIncident(_id: string): Promise<Incident | null> {
    throw new Error(NOT_IMPLEMENTED);
  }

  async createIncident(
    _input: Omit<Incident, 'id' | 'startedAt' | 'status'> & Partial<Pick<Incident, 'status'>>,
  ): Promise<Incident> {
    throw new Error(NOT_IMPLEMENTED);
  }

  async updateIncident(_id: string, _patch: Partial<Incident>): Promise<Incident> {
    throw new Error(NOT_IMPLEMENTED);
  }

  async startSession(_incidentId: string, _mode: SessionMode): Promise<SearchSession> {
    throw new Error(NOT_IMPLEMENTED);
  }

  async endSession(_sessionId: string): Promise<void> {
    throw new Error(NOT_IMPLEMENTED);
  }

  async appendTrackPoints(
    _sessionId: string,
    _points: Array<Omit<TrackPoint, 'id' | 'sessionId'>>,
  ): Promise<void> {
    throw new Error(NOT_IMPLEMENTED);
  }

  async listTrackPoints(_incidentId: string): Promise<TrackPoint[]> {
    throw new Error(NOT_IMPLEMENTED);
  }

  async addWatchtower(_input: Omit<Watchtower, 'id'>): Promise<Watchtower> {
    throw new Error(NOT_IMPLEMENTED);
  }

  async listWatchtowers(_incidentId: string): Promise<Watchtower[]> {
    throw new Error(NOT_IMPLEMENTED);
  }

  async submitSighting(
    _input: Omit<Sighting, 'id' | 'status' | 'verifiedBy' | 'verifiedVia' | 'corroboratesId'>,
  ): Promise<Sighting> {
    throw new Error(NOT_IMPLEMENTED);
  }

  async listSightings(_incidentId: string): Promise<Sighting[]> {
    throw new Error(NOT_IMPLEMENTED);
  }

  async verifySighting(_id: string, _coordinatorId: string): Promise<Sighting> {
    throw new Error(NOT_IMPLEMENTED);
  }

  async rejectSighting(_id: string, _coordinatorId: string): Promise<Sighting> {
    throw new Error(NOT_IMPLEMENTED);
  }

  subscribe(_incidentId: string, _onChange: () => void): () => void {
    throw new Error(NOT_IMPLEMENTED);
  }
}
