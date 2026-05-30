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

export function zoneGeoFromParkingZone(
  z: { code: string; name: string; polygons: { points: [number, number][] }[] },
): ZoneGeo | null {
  const poly = z.polygons.find((p) => p.points.length >= 3);
  if (!poly) return null;
  const polygon = poly.points.map(
    ([lat, lng]) => [Number(lat), Number(lng)] as [number, number],
  );
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

export function zoneOccupancy(spots: Spot[], zoneCode: string) {
  const inZone = spots.filter((s) => s.zone === zoneCode);
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
