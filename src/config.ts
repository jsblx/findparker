/** Tunable constants for the signals engine, GPS sampling, and corroboration logic. */
export const CONFIG = {
  /** H3 resolution used to bucket all spatial data (coverage, sightings, probability surface). */
  H3_RES: 10,
  /** Radius (meters) around a searcher's breadcrumb considered "detected" for coverage purposes. */
  DETECTION_RADIUS_M: 25,
  /** Half-life (ms) for exponential decay of a coverage/probability signal's confidence over time. */
  DECAY_HALF_LIFE_MS: 3 * 60 * 60 * 1000,
  /** Radius (meters) within which two sightings can corroborate one another. */
  CORROBORATION_RADIUS_M: 150,
  /** Time window (ms) within which two sightings can corroborate one another. */
  CORROBORATION_WINDOW_MS: 30 * 60 * 1000,
  /** Assumed maximum speed (m/s) of the missing subject, used to bound plausible search area growth. */
  SUBJECT_MAX_SPEED_MPS: 1.5,
  /** Target interval (ms) between GPS breadcrumb samples during an active search session. */
  GPS_SAMPLE_INTERVAL_MS: 15000,
  /** GPS fixes with reported accuracy worse than this (meters) are discarded. */
  GPS_MAX_ACCURACY_M: 50,
} as const;

/** Exponential decay rate (per ms) derived from CONFIG.DECAY_HALF_LIFE_MS, for use in decay(t) = exp(-lambda * t). */
export function decayLambdaPerMs(): number {
  return Math.LN2 / CONFIG.DECAY_HALF_LIFE_MS;
}
