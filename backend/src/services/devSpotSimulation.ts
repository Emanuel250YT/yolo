import { getNow, getNowMs } from "./devClock.js";
import { prisma } from "../lib/prisma.js";
import { generateUniqueRef } from "../lib/shortRef.js";
import { adjustOccupancy, listSpotsLive } from "../store/spots.js";
import {
  clearDevSimSpots,
  getDevSimEntries,
  getDevSimOccupiedSpotIds,
  trackDevSimSpot,
  untrackDevSimSpot,
  type DevSimEntry,
} from "./devSpotSimState.js";

const RELEASE_MIN_MS = 10_000;
const RELEASE_MAX_MS = 60_000;
const SIM_DURATION_MINUTES = 1;
const SIM_PLATE_PREFIX = "SIMDEV";

export interface DevSpotSimConfig {
  zoneCode: string;
  targetCount: number;
}

export interface DevSpotSimStatus {
  running: boolean;
  zoneCode: string | null;
  targetCount: number;
  occupiedCount: number;
  lastTickAt: string | null;
  lastAction: string | null;
  nextTickAt: string | null;
}

let running = false;
let config: DevSpotSimConfig | null = null;
let lastTickAt: Date | null = null;
let lastAction: string | null = null;
const releaseTimers = new Map<string, ReturnType<typeof setTimeout>>();

function randomReleaseDelayMs() {
  return (
    RELEASE_MIN_MS +
    Math.floor(Math.random() * (RELEASE_MAX_MS - RELEASE_MIN_MS + 1))
  );
}

function clearReleaseTimers() {
  for (const timer of releaseTimers.values()) {
    clearTimeout(timer);
  }
  releaseTimers.clear();
}

async function getDevSimUser() {
  const user = await prisma.user.findFirst({
    where: { role: { in: ["admin", "conductor"] }, active: true },
    orderBy: { createdAt: "asc" },
  });
  if (!user) {
    throw new Error("No hay usuario dev para crear reservas de simulación.");
  }
  return user;
}

async function listAvailableSpotsInZone(zoneCode: string) {
  const simIds = getDevSimOccupiedSpotIds();
  const live = await listSpotsLive({ zoneCode, onlyAvailable: true });
  return live.filter((s) => !simIds.has(s.id));
}

function scheduledStartForRelease(releaseDelayMs: number, nowMs = getNowMs()) {
  const endMs = nowMs + releaseDelayMs;
  const startMs = endMs - SIM_DURATION_MINUTES * 60_000;
  return new Date(startMs);
}

async function createSimReservation(
  spot: { id: string; label: string; zone: string },
  releaseDelayMs: number,
  index: number,
) {
  const user = await getDevSimUser();
  const nowMs = getNowMs();
  const scheduledStart = scheduledStartForRelease(releaseDelayMs, nowMs);
  const expiresAtMs = nowMs + releaseDelayMs;

  const reservation = await prisma.reservation.create({
    data: {
      ref: await generateUniqueRef("reservation"),
      userId: user.id,
      userName: user.name,
      spotId: spot.id,
      spotLabel: spot.label,
      zone: spot.zone,
      plate: `${SIM_PLATE_PREFIX}-${String(index + 1).padStart(3, "0")}`,
      vehicleType: "auto",
      scheduledStart,
      durationMinutes: SIM_DURATION_MINUTES,
      digitalPayment: false,
      pricing: {
        gross: 0,
        digitalDiscount: 0,
        net: 0,
        digitalPayment: false,
        minutes: SIM_DURATION_MINUTES,
      },
      status: "confirmed",
    },
  });

  await adjustOccupancy(spot.id, 1);

  const entry: DevSimEntry = {
    spotId: spot.id,
    reservationId: reservation.id,
    expiresAtMs,
  };
  trackDevSimSpot(entry);
  return entry;
}

async function releaseSimReservation(entry: DevSimEntry) {
  const updated = await prisma.reservation.updateMany({
    where: { id: entry.reservationId, status: "confirmed" },
    data: { status: "cancelled", cancelledAt: getNow() },
  });
  if (updated.count > 0) {
    await adjustOccupancy(entry.spotId, -1);
  }
  untrackDevSimSpot(entry.spotId);
}

function scheduleRelease(entry: DevSimEntry, releaseDelayMs: number) {
  const timer = setTimeout(() => {
    releaseTimers.delete(entry.spotId);
    void (async () => {
      try {
        await releaseSimReservation(entry);
        lastTickAt = new Date();
        const remaining = getDevSimOccupiedSpotIds().size;
        lastAction = `Reserva vencida · ${remaining} plazas ocupadas`;
        if (remaining === 0) {
          running = false;
          config = null;
          lastAction = "Simulación completada · reservas finalizadas";
        }
      } catch {
        untrackDevSimSpot(entry.spotId);
      }
    })();
  }, releaseDelayMs);
  releaseTimers.set(entry.spotId, timer);
}

export function getDevSpotSimStatus(): DevSpotSimStatus {
  const simSet = getDevSimOccupiedSpotIds();
  const entries = [...getDevSimEntries().values()];
  const nextExpiry =
    entries.length > 0
      ? Math.min(...entries.map((e) => e.expiresAtMs))
      : null;
  return {
    running,
    zoneCode: config?.zoneCode ?? null,
    targetCount: config?.targetCount ?? 0,
    occupiedCount: simSet.size,
    lastTickAt: lastTickAt?.toISOString() ?? null,
    lastAction,
    nextTickAt:
      nextExpiry != null ? new Date(nextExpiry).toISOString() : null,
  };
}

export async function startDevSpotSimulation(input: DevSpotSimConfig) {
  if (!input.zoneCode?.trim()) {
    throw new Error("Indicá una zona.");
  }
  const targetCount = Math.max(1, Math.min(500, Math.floor(input.targetCount)));
  const zone = await prisma.parkingZone.findFirst({
    where: { code: input.zoneCode.trim() },
  });
  if (!zone) throw new Error("Zona no encontrada.");

  await stopDevSpotSimulation();

  const available = await listAvailableSpotsInZone(zone.code);
  const picks = available.slice(0, targetCount);

  config = { zoneCode: zone.code, targetCount };
  running = picks.length > 0;
  lastTickAt = new Date();

  for (let i = 0; i < picks.length; i++) {
    const releaseDelayMs = randomReleaseDelayMs();
    const entry = await createSimReservation(picks[i], releaseDelayMs, i);
    scheduleRelease(entry, releaseDelayMs);
  }

  if (picks.length === 0) {
    running = false;
    config = null;
    lastAction = "Sin plazas libres en la zona";
  } else if (picks.length < targetCount) {
    lastAction = `${picks.length}/${targetCount} reservas creadas · vencen en 10–60 s c/u`;
  } else {
    lastAction = `${picks.length} reservas creadas · vencen en 10–60 s c/u`;
  }

  return getDevSpotSimStatus();
}

export async function stopDevSpotSimulation() {
  running = false;
  clearReleaseTimers();

  const entries = [...getDevSimEntries().values()];
  for (const entry of entries) {
    try {
      await releaseSimReservation(entry);
    } catch {
      untrackDevSimSpot(entry.spotId);
    }
  }
  clearDevSimSpots();
  config = null;
  lastAction =
    entries.length > 0
      ? `Detenida · ${entries.length} reservas canceladas`
      : "Detenida";

  return getDevSpotSimStatus();
}
