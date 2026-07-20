import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import type { DataProvider } from './DataProvider';
import type {
  Incident,
  Profile,
  Role,
  SearchSession,
  SessionMode,
  Sighting,
  SightingStatus,
  SightingType,
  SubjectCategory,
  TrackPoint,
  VerifiedVia,
  Watchtower,
} from '../types';

// Row shapes mirror the snake_case columns defined in supabase/migrations/*.sql.
// Generated geography columns (ipp, geog) are write-only from the app's point of
// view - they're derived by Postgres from the lat/lng columns, so rows never
// select or set them directly.

interface ProfileRow {
  id: string;
  display_name: string;
  role: Role;
}

interface IncidentRow {
  id: string;
  name: string;
  subject_category: SubjectCategory;
  ipp_lat: number;
  ipp_lng: number;
  started_at: string;
  status: 'active' | 'closed';
}

interface SearchSessionRow {
  id: string;
  incident_id: string;
  user_id: string;
  mode: SessionMode;
  started_at: string;
  ended_at: string | null;
}

interface TrackPointRow {
  id: string;
  session_id: string;
  lat: number;
  lng: number;
  accuracy_m: number;
  recorded_at: string;
}

interface WatchtowerRow {
  id: string;
  incident_id: string;
  session_id: string | null;
  lat: number;
  lng: number;
  radius_m: number;
  active_from: string;
  active_to: string | null;
}

interface SightingRow {
  id: string;
  incident_id: string;
  reported_by: string;
  lat: number;
  lng: number;
  observed_at: string;
  type: SightingType;
  confidence: number;
  status: SightingStatus;
  verified_by: string | null;
  verified_via: VerifiedVia;
  corroborates_id: string | null;
  notes: string;
  photo_url: string | null;
}

function toEpochMs(timestamptz: string): number {
  return new Date(timestamptz).getTime();
}

function toTimestamptz(epochMs: number): string {
  return new Date(epochMs).toISOString();
}

function mapProfile(row: ProfileRow): Profile {
  return { id: row.id, displayName: row.display_name, role: row.role };
}

function mapIncident(row: IncidentRow): Incident {
  return {
    id: row.id,
    name: row.name,
    subjectCategory: row.subject_category,
    ipp: { lat: row.ipp_lat, lng: row.ipp_lng },
    startedAt: toEpochMs(row.started_at),
    status: row.status,
  };
}

function mapSession(row: SearchSessionRow): SearchSession {
  return {
    id: row.id,
    incidentId: row.incident_id,
    userId: row.user_id,
    mode: row.mode,
    startedAt: toEpochMs(row.started_at),
    endedAt: row.ended_at !== null ? toEpochMs(row.ended_at) : null,
  };
}

function mapTrackPoint(row: TrackPointRow): TrackPoint {
  return {
    id: row.id,
    sessionId: row.session_id,
    lat: row.lat,
    lng: row.lng,
    accuracyM: row.accuracy_m,
    recordedAt: toEpochMs(row.recorded_at),
  };
}

function mapWatchtower(row: WatchtowerRow): Watchtower {
  return {
    id: row.id,
    incidentId: row.incident_id,
    sessionId: row.session_id,
    lat: row.lat,
    lng: row.lng,
    radiusM: row.radius_m,
    activeFrom: toEpochMs(row.active_from),
    activeTo: row.active_to !== null ? toEpochMs(row.active_to) : null,
  };
}

function mapSighting(row: SightingRow): Sighting {
  return {
    id: row.id,
    incidentId: row.incident_id,
    reportedBy: row.reported_by,
    lat: row.lat,
    lng: row.lng,
    observedAt: toEpochMs(row.observed_at),
    type: row.type,
    confidence: row.confidence,
    status: row.status,
    verifiedBy: row.verified_by,
    verifiedVia: row.verified_via,
    corroboratesId: row.corroborates_id,
    notes: row.notes,
    photoUrl: row.photo_url,
  };
}

/** Throws with a readable message when a Supabase call reports an error. */
function assertNoError(error: { message: string } | null, context: string): void {
  if (error) {
    throw new Error(`${context}: ${error.message}`);
  }
}

/**
 * Supabase-backed DataProvider. Talks to Postgres via PostgREST (through
 * @supabase/supabase-js), authenticates with Supabase's anonymous sign-in, and
 * uses Realtime channels for `subscribe`. Row <-> domain conversion happens at
 * this boundary only - the rest of the app never sees snake_case rows or
 * timestamptz strings.
 */
export class SupabaseProvider implements DataProvider {
  private client: SupabaseClient;

  constructor(url: string, anonKey: string) {
    this.client = createClient(url, anonKey);
  }

  private async requireUserId(): Promise<string> {
    const { data, error } = await this.client.auth.getSession();
    assertNoError(error, 'Failed to read auth session');
    const userId = data.session?.user.id;
    if (!userId) {
      throw new Error('No signed-in user: call signInAnonymously() first');
    }
    return userId;
  }

  async getCurrentUser(): Promise<Profile | null> {
    const { data: sessionData, error: sessionError } = await this.client.auth.getSession();
    assertNoError(sessionError, 'Failed to read auth session');
    const userId = sessionData.session?.user.id;
    if (!userId) {
      return null;
    }
    const { data, error } = await this.client
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    assertNoError(error, 'Failed to fetch profile');
    return data ? mapProfile(data as ProfileRow) : null;
  }

  async signInAnonymously(displayName: string, role: Role): Promise<Profile> {
    const { data: authData, error: authError } = await this.client.auth.signInAnonymously();
    assertNoError(authError, 'Anonymous sign-in failed');
    const userId = authData.user?.id;
    if (!userId) {
      throw new Error('Anonymous sign-in did not return a user');
    }
    const row: ProfileRow = { id: userId, display_name: displayName, role };
    const { data, error } = await this.client.from('profiles').upsert(row).select().single();
    assertNoError(error, 'Failed to create profile');
    return mapProfile(data as ProfileRow);
  }

  async setRole(role: Role): Promise<Profile> {
    const userId = await this.requireUserId();
    const { data, error } = await this.client
      .from('profiles')
      .update({ role })
      .eq('id', userId)
      .select()
      .single();
    assertNoError(error, 'Failed to update role');
    return mapProfile(data as ProfileRow);
  }

  async listIncidents(): Promise<Incident[]> {
    const { data, error } = await this.client
      .from('incidents')
      .select('*')
      .order('started_at', { ascending: false });
    assertNoError(error, 'Failed to list incidents');
    return ((data ?? []) as IncidentRow[]).map(mapIncident);
  }

  async getIncident(id: string): Promise<Incident | null> {
    const { data, error } = await this.client.from('incidents').select('*').eq('id', id).maybeSingle();
    assertNoError(error, 'Failed to fetch incident');
    return data ? mapIncident(data as IncidentRow) : null;
  }

  async createIncident(
    input: Omit<Incident, 'id' | 'startedAt' | 'status'> & Partial<Pick<Incident, 'status'>>,
  ): Promise<Incident> {
    const row = {
      name: input.name,
      subject_category: input.subjectCategory,
      ipp_lat: input.ipp.lat,
      ipp_lng: input.ipp.lng,
      status: input.status ?? 'active',
    };
    const { data, error } = await this.client.from('incidents').insert(row).select().single();
    assertNoError(error, 'Failed to create incident');
    return mapIncident(data as IncidentRow);
  }

  async updateIncident(id: string, patch: Partial<Incident>): Promise<Incident> {
    const row: Partial<IncidentRow> = {};
    if (patch.name !== undefined) row.name = patch.name;
    if (patch.subjectCategory !== undefined) row.subject_category = patch.subjectCategory;
    if (patch.ipp !== undefined) {
      row.ipp_lat = patch.ipp.lat;
      row.ipp_lng = patch.ipp.lng;
    }
    if (patch.startedAt !== undefined) row.started_at = toTimestamptz(patch.startedAt);
    if (patch.status !== undefined) row.status = patch.status;

    const { data, error } = await this.client.from('incidents').update(row).eq('id', id).select().single();
    assertNoError(error, 'Failed to update incident');
    return mapIncident(data as IncidentRow);
  }

  async startSession(incidentId: string, mode: SessionMode): Promise<SearchSession> {
    const userId = await this.requireUserId();
    const row = { incident_id: incidentId, user_id: userId, mode };
    const { data, error } = await this.client.from('search_sessions').insert(row).select().single();
    assertNoError(error, 'Failed to start session');
    return mapSession(data as SearchSessionRow);
  }

  async endSession(sessionId: string): Promise<void> {
    const { error } = await this.client
      .from('search_sessions')
      .update({ ended_at: toTimestamptz(Date.now()) })
      .eq('id', sessionId);
    assertNoError(error, 'Failed to end session');
  }

  async appendTrackPoints(
    sessionId: string,
    points: Array<Omit<TrackPoint, 'id' | 'sessionId'>>,
  ): Promise<void> {
    if (points.length === 0) {
      return;
    }
    const rows = points.map((point) => ({
      session_id: sessionId,
      lat: point.lat,
      lng: point.lng,
      accuracy_m: point.accuracyM,
      recorded_at: toTimestamptz(point.recordedAt),
    }));
    const { error } = await this.client.from('track_points').insert(rows);
    assertNoError(error, 'Failed to append track points');
  }

  async listTrackPoints(incidentId: string): Promise<TrackPoint[]> {
    // track_points has no incident_id column (it belongs to a session), so
    // resolve the incident's session ids first.
    const { data: sessions, error: sessionsError } = await this.client
      .from('search_sessions')
      .select('id')
      .eq('incident_id', incidentId);
    assertNoError(sessionsError, 'Failed to list sessions for incident');
    const sessionIds = ((sessions ?? []) as Array<{ id: string }>).map((s) => s.id);
    if (sessionIds.length === 0) {
      return [];
    }
    const { data, error } = await this.client
      .from('track_points')
      .select('*')
      .in('session_id', sessionIds)
      .order('recorded_at', { ascending: true });
    assertNoError(error, 'Failed to list track points');
    return ((data ?? []) as TrackPointRow[]).map(mapTrackPoint);
  }

  async addWatchtower(input: Omit<Watchtower, 'id'>): Promise<Watchtower> {
    const row = {
      incident_id: input.incidentId,
      session_id: input.sessionId,
      lat: input.lat,
      lng: input.lng,
      radius_m: input.radiusM,
      active_from: toTimestamptz(input.activeFrom),
      active_to: input.activeTo !== null ? toTimestamptz(input.activeTo) : null,
    };
    const { data, error } = await this.client.from('watchtowers').insert(row).select().single();
    assertNoError(error, 'Failed to add watchtower');
    return mapWatchtower(data as WatchtowerRow);
  }

  async listWatchtowers(incidentId: string): Promise<Watchtower[]> {
    const { data, error } = await this.client.from('watchtowers').select('*').eq('incident_id', incidentId);
    assertNoError(error, 'Failed to list watchtowers');
    return ((data ?? []) as WatchtowerRow[]).map(mapWatchtower);
  }

  async submitSighting(
    input: Omit<Sighting, 'id' | 'status' | 'verifiedBy' | 'verifiedVia' | 'corroboratesId'>,
  ): Promise<Sighting> {
    const row = {
      incident_id: input.incidentId,
      reported_by: input.reportedBy,
      lat: input.lat,
      lng: input.lng,
      observed_at: toTimestamptz(input.observedAt),
      type: input.type,
      confidence: input.confidence,
      notes: input.notes,
      photo_url: input.photoUrl,
    };
    const { data, error } = await this.client.from('sightings').insert(row).select().single();
    assertNoError(error, 'Failed to submit sighting');
    return mapSighting(data as SightingRow);
  }

  async listSightings(incidentId: string): Promise<Sighting[]> {
    const { data, error } = await this.client
      .from('sightings')
      .select('*')
      .eq('incident_id', incidentId)
      .order('observed_at', { ascending: false });
    assertNoError(error, 'Failed to list sightings');
    return ((data ?? []) as SightingRow[]).map(mapSighting);
  }

  async verifySighting(id: string, coordinatorId: string): Promise<Sighting> {
    const { data, error } = await this.client
      .from('sightings')
      .update({ status: 'verified', verified_by: coordinatorId, verified_via: 'coordinator' })
      .eq('id', id)
      .select()
      .single();
    assertNoError(error, 'Failed to verify sighting');
    return mapSighting(data as SightingRow);
  }

  async rejectSighting(id: string, coordinatorId: string): Promise<Sighting> {
    const { data, error } = await this.client
      .from('sightings')
      .update({ status: 'rejected', verified_by: coordinatorId, verified_via: null })
      .eq('id', id)
      .select()
      .single();
    assertNoError(error, 'Failed to reject sighting');
    return mapSighting(data as SightingRow);
  }

  subscribe(incidentId: string, onChange: () => void): () => void {
    // track_points has no incident_id column to filter on directly, so those
    // events aren't scoped to this incident; onChange just triggers a refetch,
    // which is harmless (if occasionally redundant across incidents) for a POC.
    const channel: RealtimeChannel = this.client
      .channel(`incident-${incidentId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'incidents', filter: `id=eq.${incidentId}` },
        () => onChange(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'search_sessions', filter: `incident_id=eq.${incidentId}` },
        () => onChange(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'watchtowers', filter: `incident_id=eq.${incidentId}` },
        () => onChange(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sightings', filter: `incident_id=eq.${incidentId}` },
        () => onChange(),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'track_points' }, () => onChange())
      .subscribe();

    return () => {
      void this.client.removeChannel(channel);
    };
  }
}
