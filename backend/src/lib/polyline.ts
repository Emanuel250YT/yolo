/** Distancia en metros entre dos puntos [lat, lng]. */
export function distanceMeters(a: [number, number], b: [number, number]): number {
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

export function polylineLengthMeters(points: [number, number][]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += distanceMeters(points[i - 1], points[i]);
  }
  return total;
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
