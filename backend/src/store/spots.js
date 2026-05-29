import { randomUUID } from "crypto";
import { loadJson, saveJson } from "../db/persist.js";

const FILE = "spots";

function load() {
  return loadJson(FILE, { spots: [] });
}

function save(data) {
  saveJson(FILE, data);
}

export function listSpots({ onlyAvailable } = {}) {
  let spots = load().spots.filter((s) => s.enabled !== false);
  if (onlyAvailable) {
    spots = spots.filter((s) => s.occupied < s.capacity);
  }
  return spots;
}

export function getSpot(id) {
  return load().spots.find((s) => s.id === id) ?? null;
}

export function upsertSpot(payload) {
  const data = load();
  if (payload.id) {
    const idx = data.spots.findIndex((s) => s.id === payload.id);
    if (idx === -1) return null;
    data.spots[idx] = { ...data.spots[idx], ...payload, updatedAt: new Date().toISOString() };
    save(data);
    return data.spots[idx];
  }
  const spot = {
    id: randomUUID(),
    label: payload.label,
    zone: payload.zone,
    address: payload.address ?? "",
    capacity: Number(payload.capacity) || 10,
    occupied: Number(payload.occupied) || 0,
    enabled: payload.enabled !== false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  data.spots.push(spot);
  save(data);
  return spot;
}

export function adjustOccupancy(spotId, delta) {
  const data = load();
  const spot = data.spots.find((s) => s.id === spotId);
  if (!spot) return null;
  spot.occupied = Math.max(0, Math.min(spot.capacity, spot.occupied + delta));
  spot.updatedAt = new Date().toISOString();
  save(data);
  return spot;
}

export function seedSpotsIfEmpty() {
  const data = load();
  if (data.spots.length > 0) return;
  const zones = [
    { zone: "microcentro", label: "Cuadra Centro 1", address: "España y Buenos Aires" },
    { zone: "microcentro", label: "Cuadra Centro 2", address: "Caseros y Mitre" },
    { zone: "paseo-balcarce", label: "Paseo Balcarce A", address: "Balcarce 100" },
    { zone: "paseo-guemes", label: "Paseo Güemes B", address: "Güemes 200" },
    { zone: "plaza-alvarado", label: "Plaza Alvarado", address: "Av. Figueroa" },
  ];
  for (const z of zones) {
    data.spots.push({
      id: randomUUID(),
      label: z.label,
      zone: z.zone,
      address: z.address,
      capacity: 12,
      occupied: Math.floor(Math.random() * 8),
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
  save(data);
}
