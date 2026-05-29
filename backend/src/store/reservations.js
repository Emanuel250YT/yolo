import { randomUUID } from "crypto";
import { MAX_RESERVATION_ADVANCE_MS } from "../config/auth.js";
import { calculateAmount } from "../services/pricing.js";
import { adjustOccupancy, getSpot } from "./spots.js";
import { loadJson, saveJson } from "../db/persist.js";

const FILE = "reservations";

function load() {
  return loadJson(FILE, { reservations: [] });
}

function save(data) {
  saveJson(FILE, data);
}

export function validateSchedule(scheduledStart) {
  const start = new Date(scheduledStart).getTime();
  const now = Date.now();
  if (Number.isNaN(start)) {
    throw new Error("Fecha de inicio inválida.");
  }
  if (start < now - 60_000) {
    throw new Error("No podés reservar en el pasado.");
  }
  if (start > now + MAX_RESERVATION_ADVANCE_MS) {
    throw new Error("Solo podés reservar con hasta 30 minutos de anticipación.");
  }
}

export function listReservations({ userId, status } = {}) {
  let list = load().reservations;
  if (userId) list = list.filter((r) => r.userId === userId);
  if (status) list = list.filter((r) => r.status === status);
  return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export function createReservation(
  { spotId, plate, vehicleType, scheduledStart, durationMinutes, digitalPayment },
  user,
) {
  validateSchedule(scheduledStart);

  const spot = getSpot(spotId);
  if (!spot || !spot.enabled) {
    throw new Error("Lugar de estacionamiento no disponible.");
  }
  if (spot.occupied >= spot.capacity) {
    throw new Error("No hay cupos libres en este lugar.");
  }

  const minutes = Math.max(15, Math.min(480, Number(durationMinutes) || 60));
  const pricing = calculateAmount({
    vehicleType: vehicleType === "motorcycle" ? "motorcycle" : "auto",
    minutes,
    digitalPayment: Boolean(digitalPayment),
  });

  const data = load();
  const reservation = {
    id: randomUUID(),
    userId: user.id,
    userName: user.name,
    spotId,
    spotLabel: spot.label,
    zone: spot.zone,
    plate: plate.trim().toUpperCase(),
    vehicleType: vehicleType === "motorcycle" ? "motorcycle" : "auto",
    scheduledStart: new Date(scheduledStart).toISOString(),
    durationMinutes: minutes,
    digitalPayment: Boolean(digitalPayment),
    pricing,
    status: "confirmed",
    createdAt: new Date().toISOString(),
  };
  data.reservations.push(reservation);
  save(data);
  adjustOccupancy(spotId, 1);
  return reservation;
}

export function cancelReservation(id, user) {
  const data = load();
  const idx = data.reservations.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  const r = data.reservations[idx];
  if (user.role !== "admin" && r.userId !== user.id) {
    throw new Error("No autorizado.");
  }
  if (r.status === "cancelled") return r;
  r.status = "cancelled";
  r.cancelledAt = new Date().toISOString();
  adjustOccupancy(r.spotId, -1);
  data.reservations[idx] = r;
  save(data);
  return r;
}
