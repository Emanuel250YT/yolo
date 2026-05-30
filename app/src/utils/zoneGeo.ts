import type { Spot } from "../types";

/** Centro de Salta capital */
export const SALTA_CENTER: [number, number] = [-24.7859, -65.4115];

export interface ZoneGeo {
  code: string;
  name: string;
  polygon: [number, number][];
  center: [number, number];
}

export function polygonCenter(polygon: [number, number][]): [number, number] {
  if (!polygon.length) return SALTA_CENTER;
  const lat = polygon.reduce((a, p) => a + p[0], 0) / polygon.length;
  const lng = polygon.reduce((a, p) => a + p[1], 0) / polygon.length;
  return [lat, lng];
}

/** Ray casting — polygon vertices as [lat, lng] */
export function pointInPolygon(
  lat: number,
  lng: number,
  polygon: [number, number][],
): boolean {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [yi, xi] = polygon[i];
    const [yj, xj] = polygon[j];
    const intersect =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function pointInAnyPolygon(
  lat: number,
  lng: number,
  polygons: [number, number][][],
): boolean {
  return polygons.some((p) => pointInPolygon(lat, lng, p));
}

export function distanceMeters(
  a: [number, number],
  b: [number, number],
): number {
  const R = 6371000;
  const [lat1, lng1] = a;
  const [lat2, lng2] = b;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

export const STREET_SPOT_RADIUS_M = 120;

export function normalizePolygonRing(
  points: [number, number][] | unknown[],
): [number, number][] {
  return points
    .map((p) => {
      if (Array.isArray(p) && p.length >= 2) {
        return [Number(p[0]), Number(p[1])] as [number, number];
      }
      if (p && typeof p === "object" && "lat" in p && "lng" in p) {
        const o = p as { lat: unknown; lng: unknown };
        return [Number(o.lat), Number(o.lng)] as [number, number];
      }
      return null;
    })
    .filter(
      (p): p is [number, number] =>
        p != null && !Number.isNaN(p[0]) && !Number.isNaN(p[1]),
    );
}

export function extractZonePolygonRings(
  z: { polygons?: { points: [number, number][] }[] | unknown },
): [number, number][][] {
  const raw = z.polygons;
  if (!Array.isArray(raw) || !raw.length) return [];

  if (
    Array.isArray(raw[0]) &&
    typeof (raw[0] as unknown[])[0] === "number"
  ) {
    const ring = normalizePolygonRing(raw as unknown[]);
    return ring.length >= 3 ? [ring] : [];
  }

  return raw
    .filter(
      (p): p is { points: [number, number][] } =>
        Boolean(p) &&
        typeof p === "object" &&
        Array.isArray((p as { points?: unknown }).points),
    )
    .map((p) => normalizePolygonRing(p.points))
    .filter((ring) => ring.length >= 3);
}

export function zoneGeoFromParkingZone(
  z: { code: string; name: string; polygons: { points: [number, number][] }[] },
): ZoneGeo | null {
  const rings = extractZonePolygonRings(z);
  const polygon = rings[0];
  if (!polygon) return null;
  return {
    code: z.code,
    name: z.name,
    polygon,
    center: polygonCenter(polygon),
  };
}

export function resolveZoneGeoList(
  zones: { code: string; name: string; polygons: { points: [number, number][] }[]; enabled?: boolean }[],
): ZoneGeo[] {
  return zones
    .filter((z) => z.enabled !== false)
    .map(zoneGeoFromParkingZone)
    .filter((z): z is ZoneGeo => z != null);
}

export function spotsInZone(
  spots: Spot[],
  zone: { code: string; id?: string },
  polygon?: [number, number][],
): Spot[] {
  const code = zone.code.toLowerCase();
  let inZone = spots.filter((s) => {
    if (s.zone?.toLowerCase() === code) return true;
    if (zone.id && s.parkingZoneId === zone.id) return true;
    return false;
  });
  if (!inZone.length && polygon?.length) {
    inZone = spots.filter(
      (s) =>
        s.lat != null &&
        s.lng != null &&
        pointInPolygon(s.lat, s.lng, polygon),
    );
  }
  return inZone;
}

export function zoneOccupancy(
  spots: Spot[],
  zone: { code: string; id?: string },
  polygon?: [number, number][],
) {
  const inZone = spotsInZone(spots, zone, polygon);
  if (!inZone.length) return 0;
  const taken = inZone.filter((s) => {
    if (s.status) return s.status === "occupied" || s.status === "held";
    return s.occupied >= s.capacity;
  }).length;
  return taken / inZone.length;
}

export function heatColor(ratio: number) {
  if (ratio < 0.25) return { fill: "#22c55e", label: "Baja" };
  if (ratio < 0.5) return { fill: "#84cc16", label: "Moderada" };
  if (ratio < 0.75) return { fill: "#f97316", label: "Alta" };
  return { fill: "#ef4444", label: "Muy alta" };
}

export function heatFillOpacity(ratio: number) {
  return 0.35 + ratio * 0.4;
}

function interpolatePoint(
  a: [number, number],
  b: [number, number],
  fraction: number,
): [number, number] {
  return [
    a[0] + (b[0] - a[0]) * fraction,
    a[1] + (b[1] - a[1]) * fraction,
  ];
}

export function polylineLengthMeters(points: [number, number][]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += distanceMeters(points[i - 1], points[i]);
  }
  return total;
}

/** Posiciones cada `spacingM` metros a lo largo de la polilínea (incluye inicio). */
export function pointsAlongPolyline(
  points: [number, number][],
  spacingM: number,
): [number, number][] {
  if (points.length < 2 || spacingM <= 0) {
    return points.length ? [points[0]] : [];
  }

  const total = polylineLengthMeters(points);
  if (total <= 0) return [points[0]];

  const result: [number, number][] = [];
  let distAlong = 0;
  let nextMark = 0;
  let segStart = 0;

  while (segStart < points.length - 1) {
    const a = points[segStart];
    const b = points[segStart + 1];
    const segLen = distanceMeters(a, b);

    while (nextMark <= distAlong + segLen && nextMark <= total + 0.01) {
      const t = segLen > 0 ? (nextMark - distAlong) / segLen : 0;
      result.push(interpolatePoint(a, b, Math.max(0, Math.min(1, t))));
      nextMark += spacingM;
    }

    distAlong += segLen;
    segStart++;
  }

  if (!result.length) result.push(points[0]);
  return result;
}
