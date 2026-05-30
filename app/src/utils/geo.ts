import { getDevNowMs } from "../dev/devConfig";
import type { ParkingBlock, Spot } from "../types";

const R = 6371e3;

function toRad(d: number) {
  return (d * Math.PI) / 180;
}

export function distanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
) {
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1);
  const Δλ = toRad(lng2 - lng1);
  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function sortBlocksByDistance(
  blocks: ParkingBlock[],
  lat: number,
  lng: number,
) {
  return [...blocks].sort((a, b) => {
    const da =
      a.lat != null && a.lng != null
        ? distanceMeters(lat, lng, a.lat, a.lng)
        : Infinity;
    const db =
      b.lat != null && b.lng != null
        ? distanceMeters(lat, lng, b.lat, b.lng)
        : Infinity;
    return da - db;
  });
}

export type SpotLiveStatus = "available" | "held" | "occupied" | "disabled";

export function spotLiveStatus(spot: Spot): SpotLiveStatus {
  if (!spot.enabled) return "disabled";
  if (spot.occupied >= spot.capacity) return "occupied";
  if (spot.holdExpiresAt && new Date(spot.holdExpiresAt).getTime() > getDevNowMs()) {
    return "held";
  }
  return "available";
}

export function pickNearestAvailableSpot(
  spots: Spot[],
  lat: number,
  lng: number,
): Spot | null {
  let best: Spot | null = null;
  let bestDist = Infinity;
  for (const s of spots) {
    if (spotLiveStatus(s) !== "available") continue;
    if (s.lat == null || s.lng == null) continue;
    const d = distanceMeters(lat, lng, s.lat, s.lng);
    if (d < bestDist) {
      bestDist = d;
      best = s;
    }
  }
  return best;
}

export function groupSpotsByBlock(spots: Spot[]) {
  const map = new Map<string, Spot[]>();
  for (const s of spots) {
    const key = s.blockId ?? s.blockName ?? s.zone;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(s);
  }
  for (const arr of map.values()) {
    arr.sort(
      (a, b) => (a.row ?? 0) - (b.row ?? 0) || (a.col ?? 0) - (b.col ?? 0),
    );
  }
  return map;
}
