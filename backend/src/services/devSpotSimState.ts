/** Reservas de simulación DevTools (plaza + reserva confirmada). */
export interface DevSimEntry {
  spotId: string;
  reservationId: string;
  expiresAtMs: number;
}

const entriesBySpot = new Map<string, DevSimEntry>();

export function getDevSimEntries(): ReadonlyMap<string, DevSimEntry> {
  return entriesBySpot;
}

export function getDevSimOccupiedSpotIds(): ReadonlySet<string> {
  return new Set(entriesBySpot.keys());
}

export function trackDevSimSpot(entry: DevSimEntry) {
  entriesBySpot.set(entry.spotId, entry);
}

export function untrackDevSimSpot(spotId: string) {
  entriesBySpot.delete(spotId);
}

export function clearDevSimSpots() {
  entriesBySpot.clear();
}
