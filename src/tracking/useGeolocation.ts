/**
 * Watches GPS position while enabled, discarding low-accuracy fixes and throttling how
 * often accepted fixes are forwarded to the caller. Wraps `navigator.geolocation` behind
 * a small interface so logic can be exercised in tests without a real browser.
 */
import { useEffect, useRef, useState } from 'react';
import { CONFIG } from '../config';

export interface GeoPositionLike {
  coords: {
    latitude: number;
    longitude: number;
    accuracy: number;
  };
}

export interface GeoPositionErrorLike {
  code: number;
  message: string;
}

/** The GeolocationPositionError.PERMISSION_DENIED code, duplicated here to avoid depending on lib.dom's error type. */
const PERMISSION_DENIED = 1;

export interface GeoApi {
  watchPosition(
    success: (position: GeoPositionLike) => void,
    error: (error: GeoPositionErrorLike) => void,
    options?: PositionOptions,
  ): number;
  clearWatch(id: number): void;
}

/** Default GeoApi backed by `navigator.geolocation`. Returns null when unsupported. */
export function createDefaultGeoApi(): GeoApi | null {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return null;
  }
  const geolocation = navigator.geolocation;
  return {
    watchPosition: (success, error, options) => geolocation.watchPosition(success, error, options),
    clearWatch: (id) => geolocation.clearWatch(id),
  };
}

export type GeoPermission = 'unknown' | 'granted' | 'denied';

export interface GeoPoint {
  lat: number;
  lng: number;
  accuracyM: number;
  recordedAt: number;
}

export interface UseGeolocationOptions {
  enabled: boolean;
  onPoint: (point: GeoPoint) => void;
  api?: GeoApi | null;
  sampleIntervalMs?: number;
  maxAccuracyM?: number;
  now?: () => number;
}

export interface UseGeolocationResult {
  supported: boolean;
  lastFix: GeoPoint | null;
  error: string | null;
  permission: GeoPermission;
}

export function useGeolocation(opts: UseGeolocationOptions): UseGeolocationResult {
  const {
    enabled,
    sampleIntervalMs = CONFIG.GPS_SAMPLE_INTERVAL_MS,
    maxAccuracyM = CONFIG.GPS_MAX_ACCURACY_M,
    now = Date.now,
  } = opts;
  const api = opts.api === undefined ? createDefaultGeoApi() : opts.api;
  const supported = api !== null;

  const [lastFix, setLastFix] = useState<GeoPoint | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [permission, setPermission] = useState<GeoPermission>('unknown');

  // Latest onPoint kept in a ref so the effect below doesn't need to re-subscribe every
  // time the caller passes a fresh function identity.
  const onPointRef = useRef(opts.onPoint);
  onPointRef.current = opts.onPoint;
  const lastEmitAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled || !api) {
      return;
    }

    lastEmitAtRef.current = null;

    const watchId = api.watchPosition(
      (position) => {
        const point: GeoPoint = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracyM: position.coords.accuracy,
          recordedAt: now(),
        };

        if (point.accuracyM > maxAccuracyM) {
          return;
        }

        setLastFix(point);
        setError(null);
        setPermission('granted');

        const lastEmitAt = lastEmitAtRef.current;
        if (lastEmitAt === null || point.recordedAt - lastEmitAt >= sampleIntervalMs) {
          lastEmitAtRef.current = point.recordedAt;
          onPointRef.current(point);
        }
      },
      (err) => {
        setError(err.message || 'Geolocation error');
        if (err.code === PERMISSION_DENIED) {
          setPermission('denied');
        }
      },
      { enableHighAccuracy: true },
    );

    return () => {
      api.clearWatch(watchId);
    };
  }, [enabled, api, maxAccuracyM, sampleIntervalMs, now]);

  return { supported, lastFix, error, permission };
}
