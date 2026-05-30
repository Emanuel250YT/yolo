import type { Spot } from "../types";
import { spotLiveStatus } from "./geo";

export const SPOT_TYPE_LABEL: Record<string, string> = {
  pago: "Pago",
  gratuita: "Gratuita",
};

export const SPOT_STATUS_COLOR: Record<string, string> = {
  available: "#22c55e",
  held: "#f59e0b",
  occupied: "#ef4444",
  disabled: "#94a3b8",
};

export const SPOT_STATUS_LABEL: Record<string, string> = {
  available: "Libre",
  held: "Reservada",
  occupied: "Ocupada",
  disabled: "No disponible",
};

export function resolveSpotLatLng(
  spot: Spot,
  index: number,
  fallback: [number, number],
): [number, number] {
  if (spot.lat != null && spot.lng != null) {
    return [spot.lat, spot.lng];
  }
  const offset = 0.000045;
  const col = spot.col ?? index % 5;
  const row = spot.row ?? Math.floor(index / 5);
  return [fallback[0] - row * offset, fallback[1] + col * offset];
}

export function spotStatusOf(spot: Spot) {
  return spot.status ?? spotLiveStatus(spot);
}

export function defaultImageBounds(
  center: [number, number],
  sizeM = 90,
): [[number, number], [number, number]] {
  const latDelta = sizeM / 111_000;
  const lngDelta =
    sizeM / (111_000 * Math.cos((center[0] * Math.PI) / 180));
  return [
    [center[0] - latDelta, center[1] - lngDelta],
    [center[0] + latDelta, center[1] + lngDelta],
  ];
}
