import { polylineLengthMeters, pointsAlongPolyline } from "../utils/zoneGeo";

export { polylineLengthMeters, pointsAlongPolyline };

export function estimateSpotCount(
  points: [number, number][],
  spacingM = 5,
): number {
  return pointsAlongPolyline(points, spacingM).length;
}

export function formatMeters(m: number): string {
  if (m >= 1000) return `${(m / 1000).toFixed(2)} km`;
  return `${Math.round(m)} m`;
}
