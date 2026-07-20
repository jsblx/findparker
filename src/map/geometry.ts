/** Pure geometry builders for map overlays: distance-ring circles around the IPP. */
import { DISTANCE_QUANTILES } from '../signals';
import type { LatLng, SubjectCategory } from '../types';

const EARTH_RADIUS_M = 6_371_000;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/** The point `distanceM` meters from `origin` along compass `bearingDeg` (0 = north), great-circle. */
function destinationPoint(origin: LatLng, bearingDeg: number, distanceM: number): LatLng {
  const angularDistance = distanceM / EARTH_RADIUS_M;
  const bearing = toRad(bearingDeg);
  const lat1 = toRad(origin.lat);
  const lng1 = toRad(origin.lng);

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angularDistance) + Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearing),
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(lat1),
      Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2),
    );

  return { lat: toDeg(lat2), lng: toDeg(lng2) };
}

/** A closed circle polygon of `segments` vertices, each `radiusM` meters from `center`. */
export function ringPolygon(center: LatLng, radiusM: number, segments = 64): LatLng[] {
  const points: LatLng[] = [];
  for (let i = 0; i < segments; i += 1) {
    const bearing = (360 * i) / segments;
    points.push(destinationPoint(center, bearing, radiusM));
  }
  return points;
}

export interface DistanceRing {
  label: string;
  radiusM: number;
  polygon: LatLng[];
}

/** The p25/p50/p75/p95 distance rings around the IPP for the incident's subject category prior. */
export function distanceRings(ipp: LatLng, category: SubjectCategory): DistanceRing[] {
  const q = DISTANCE_QUANTILES[category];
  return (
    [
      ['p25', q.p25],
      ['p50', q.p50],
      ['p75', q.p75],
      ['p95', q.p95],
    ] as const
  ).map(([label, radiusM]) => ({ label, radiusM, polygon: ringPolygon(ipp, radiusM) }));
}
