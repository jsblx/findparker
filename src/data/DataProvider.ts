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

/**
 * Data access seam for FindParker. Implemented by either a Supabase-backed provider
 * (real backend + realtime) or an in-memory provider (local dev, tests). The rest of
 * the app only ever depends on this interface, never on a concrete implementation.
 */
export interface DataProvider {
  /** Returns the currently signed-in user's profile, or null if not signed in. */
  getCurrentUser(): Promise<Profile | null>;

  /** POC-simple auth: creates/adopts an anonymous profile with the given display name and role. */
  signInAnonymously(displayName: string, role: Role): Promise<Profile>;

  /** Updates the current user's role (e.g. switching between searcher and coordinator). */
  setRole(role: Role): Promise<Profile>;

  /** Lists all known incidents, most relevant/recent first. */
  listIncidents(): Promise<Incident[]>;

  /** Fetches a single incident by id, or null if it doesn't exist. */
  getIncident(id: string): Promise<Incident | null>;

  /** Creates a new incident. `status` defaults to 'active' if omitted. */
  createIncident(
    input: Omit<Incident, 'id' | 'startedAt' | 'status'> & Partial<Pick<Incident, 'status'>>,
  ): Promise<Incident>;

  /** Applies a partial update to an incident (e.g. moving the IPP, closing it out). */
  updateIncident(id: string, patch: Partial<Incident>): Promise<Incident>;

  /** Starts a new search session for the current user against an incident. */
  startSession(incidentId: string, mode: SessionMode): Promise<SearchSession>;

  /** Marks a search session as ended (sets endedAt). */
  endSession(sessionId: string): Promise<void>;

  /** Appends GPS breadcrumb points to an existing session. */
  appendTrackPoints(sessionId: string, points: Array<Omit<TrackPoint, 'id' | 'sessionId'>>): Promise<void>;

  /** Lists all track points recorded across every session for an incident. */
  listTrackPoints(incidentId: string): Promise<TrackPoint[]>;

  /** Registers a stationary watchtower (fixed-position observer) for an incident. */
  addWatchtower(input: Omit<Watchtower, 'id'>): Promise<Watchtower>;

  /** Lists all watchtowers for an incident. */
  listWatchtowers(incidentId: string): Promise<Watchtower[]>;

  /** Submits a new sighting report. Always created as unverified, unattributed to any corroboration. */
  submitSighting(
    input: Omit<Sighting, 'id' | 'status' | 'verifiedBy' | 'verifiedVia' | 'corroboratesId'>,
  ): Promise<Sighting>;

  /** Lists all sightings for an incident. */
  listSightings(incidentId: string): Promise<Sighting[]>;

  /** Marks a sighting as verified by a coordinator. */
  verifySighting(id: string, coordinatorId: string): Promise<Sighting>;

  /** Marks a sighting as rejected. */
  rejectSighting(id: string, coordinatorId: string): Promise<Sighting>;

  /**
   * Subscribes to realtime changes for an incident (any mutation to its sessions, track
   * points, watchtowers, or sightings). Returns an unsubscribe function.
   */
  subscribe(incidentId: string, onChange: () => void): () => void;
}
