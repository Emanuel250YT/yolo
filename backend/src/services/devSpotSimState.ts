/** Plazas ocupadas solo por la simulación DevTools (evita que reconcile las libere). */
const occupiedBySim = new Set<string>();

export function getDevSimOccupiedSpotIds(): ReadonlySet<string> {
  return occupiedBySim;
}

export function trackDevSimSpot(spotId: string) {
  occupiedBySim.add(spotId);
}

export function untrackDevSimSpot(spotId: string) {
  occupiedBySim.delete(spotId);
}

export function clearDevSimSpots() {
  occupiedBySim.clear();
}
