/** Sighting submission, available to any signed-in user (searcher or coordinator). Always creates an `unverified` report. */
import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { useData } from '../data';
import type { Sighting, SightingType } from '../types';

const SIGHTING_TYPES: SightingType[] = ['visual', 'clothing', 'footprint', 'other'];

export interface SightingFormProps {
  incidentId: string;
  reportedBy: string;
  onSubmitted?: (sighting: Sighting) => void;
  onClose?: () => void;
}

function toDatetimeLocalValue(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function SightingForm({ incidentId, reportedBy, onSubmitted, onClose }: SightingFormProps) {
  const data = useData();
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [type, setType] = useState<SightingType>('visual');
  const [confidence, setConfidence] = useState(0.5);
  const [notes, setNotes] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [observedAt, setObservedAt] = useState(() => Date.now());
  const [submitted, setSubmitted] = useState<Sighting | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function useCurrentLocation() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocationError('Geolocation is not supported on this device.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(String(pos.coords.latitude));
        setLng(String(pos.coords.longitude));
        setLocating(false);
        setLocationError(null);
      },
      (err) => {
        setLocating(false);
        setLocationError(err.message || 'Could not get current location.');
      },
    );
  }

  function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      setPhotoUrl(null);
      return;
    }
    // POC only: the photo is inlined as a data URL. A later enhancement should upload it to
    // Supabase Storage instead and store the resulting public URL in `photoUrl`.
    const reader = new FileReader();
    reader.onload = () => setPhotoUrl(typeof reader.result === 'string' ? reader.result : null);
    reader.readAsDataURL(file);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const parsedLat = Number(lat);
    const parsedLng = Number(lng);
    if (lat.trim() === '' || lng.trim() === '' || Number.isNaN(parsedLat) || Number.isNaN(parsedLng)) {
      setLocationError('Enter a location, or use current location.');
      return;
    }
    setSubmitting(true);
    try {
      const sighting = await data.submitSighting({
        incidentId,
        reportedBy,
        lat: parsedLat,
        lng: parsedLng,
        observedAt,
        type,
        confidence,
        notes,
        photoUrl,
      });
      setSubmitted(sighting);
      onSubmitted?.(sighting);
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="sighting-confirmation stack">
        <h2>Sighting reported</h2>
        <p>
          Thanks - your report is currently <strong>unverified</strong>. It will be verified automatically if
          another searcher corroborates it nearby, or by a coordinator.
        </p>
        <button type="button" className="primary" onClick={onClose}>
          Done
        </button>
      </div>
    );
  }

  return (
    <form className="sighting-form stack" onSubmit={handleSubmit}>
      <h2>Report a sighting</h2>

      <div className="location-fields">
        <button type="button" onClick={useCurrentLocation} disabled={locating}>
          {locating ? 'Locating...' : 'Use current location'}
        </button>
        <label htmlFor="sightingLat">Latitude</label>
        <input
          id="sightingLat"
          type="number"
          step="any"
          value={lat}
          onChange={(e) => setLat(e.target.value)}
          placeholder="e.g. 37.7749"
        />
        <label htmlFor="sightingLng">Longitude</label>
        <input
          id="sightingLng"
          type="number"
          step="any"
          value={lng}
          onChange={(e) => setLng(e.target.value)}
          placeholder="e.g. -122.4194"
        />
        {locationError && <p className="error-banner">{locationError}</p>}
      </div>

      <label htmlFor="sightingType">Type</label>
      <select id="sightingType" value={type} onChange={(e) => setType(e.target.value as SightingType)}>
        {SIGHTING_TYPES.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>

      <label htmlFor="sightingConfidence">Confidence: {confidence.toFixed(2)}</label>
      <input
        id="sightingConfidence"
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={confidence}
        onChange={(e) => setConfidence(Number(e.target.value))}
      />

      <label htmlFor="sightingObservedAt">Observed at</label>
      <input
        id="sightingObservedAt"
        type="datetime-local"
        value={toDatetimeLocalValue(observedAt)}
        onChange={(e) => {
          const ms = new Date(e.target.value).getTime();
          if (!Number.isNaN(ms)) setObservedAt(ms);
        }}
      />

      <label htmlFor="sightingNotes">Notes</label>
      <textarea id="sightingNotes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />

      <label htmlFor="sightingPhoto">Photo (optional)</label>
      <input id="sightingPhoto" type="file" accept="image/*" onChange={handlePhotoChange} />
      {photoUrl && <img src={photoUrl} alt="Sighting preview" className="photo-preview" />}

      <div className="form-actions">
        <button type="submit" className="primary" disabled={submitting}>
          {submitting ? 'Submitting...' : 'Submit sighting'}
        </button>
        {onClose && (
          <button type="button" onClick={onClose}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
