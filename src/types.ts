/** Shared domain types for FindParker. Timestamps are epoch milliseconds throughout. */

export type LatLng = { lat: number; lng: number };

export type SubjectCategory =
  | 'autistic_child'
  | 'dementia'
  | 'child_1_6'
  | 'child_7_12'
  | 'hiker'
  | 'despondent'
  | 'other';

export type Role = 'searcher' | 'coordinator';

export type SessionMode = 'moving' | 'watchtower';

export type SightingStatus = 'unverified' | 'verified' | 'rejected';

export type VerifiedVia = 'corroboration' | 'coordinator' | null;

export type SightingType = 'visual' | 'clothing' | 'footprint' | 'other';

export interface Profile {
  id: string;
  displayName: string;
  role: Role;
}

export interface Incident {
  id: string;
  name: string;
  subjectCategory: SubjectCategory;
  ipp: LatLng;
  startedAt: number;
  status: 'active' | 'closed';
}

export interface SearchSession {
  id: string;
  incidentId: string;
  userId: string;
  mode: SessionMode;
  startedAt: number;
  endedAt: number | null;
}

export interface TrackPoint {
  id: string;
  sessionId: string;
  lat: number;
  lng: number;
  accuracyM: number;
  recordedAt: number;
}

export interface Watchtower {
  id: string;
  incidentId: string;
  sessionId: string | null;
  lat: number;
  lng: number;
  radiusM: number;
  activeFrom: number;
  activeTo: number | null;
}

export interface Sighting {
  id: string;
  incidentId: string;
  reportedBy: string;
  lat: number;
  lng: number;
  observedAt: number;
  type: SightingType;
  confidence: number;
  status: SightingStatus;
  verifiedBy: string | null;
  verifiedVia: VerifiedVia;
  corroboratesId: string | null;
  notes: string;
  photoUrl: string | null;
}

export interface Sector {
  id: string;
  incidentId: string;
  polygon: LatLng[];
  assignedLabel: string;
  status: 'open' | 'in_progress' | 'done';
}
