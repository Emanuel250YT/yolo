import { prisma } from "../lib/prisma.js";
import {
  clearDevSimSpots,
  getDevSimOccupiedSpotIds,
  trackDevSimSpot,
  untrackDevSimSpot,
} from "./devSpotSimState.js";

const MIN_INTERVAL_MS = 5_000;
const MAX_INTERVAL_MS = 60_000;

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

let timer: ReturnType<typeof setTimeout> | null = null;
let running = false;
let config: DevSpotSimConfig | null = null;
let lastTickAt: Date | null = null;
let lastAction: string | null = null;
let nextTickAt: Date | null = null;

function randomDelayMs() {
  return MIN_INTERVAL_MS + Math.floor(Math.random() * (MAX_INTERVAL_MS - MIN_INTERVAL_MS + 1));
}

function scheduleNext() {
  if (!running) return;
  const delay = randomDelayMs();
  nextTickAt = new Date(Date.now() + delay);
  timer = setTimeout(() => {
    void tick().finally(() => {
      if (running) scheduleNext();
    });
  }, delay);
}

async function listFreeSpotsInZone(zoneCode: string, exclude: ReadonlySet<string>) {
  const spots = await prisma.spot.findMany({
    where: {
      zone: zoneCode,
      enabled: true,
      occupied: 0,
    },
    select: { id: true },
  });
  return spots.filter((s) => !exclude.has(s.id));
}

async function occupySpot(spotId: string) {
  await prisma.spot.update({
    where: { id: spotId },
    data: { occupied: 1 },
  });
  trackDevSimSpot(spotId);
}

async function releaseSpot(spotId: string) {
  await prisma.spot.update({
    where: { id: spotId },
    data: { occupied: 0 },
  });
  untrackDevSimSpot(spotId);
}

async function tick() {
  if (!running || !config) return;

  const simSet = getDevSimOccupiedSpotIds();

  const simCount = (
    await prisma.spot.findMany({
      where: { id: { in: [...simSet] }, zone: config.zoneCode },
      select: { id: true },
    })
  ).length;

  lastTickAt = new Date();

  if (simCount < config.targetCount) {
    const free = await listFreeSpotsInZone(config.zoneCode, simSet);
    if (free.length === 0) {
      lastAction = "Sin plazas libres en la zona";
      return;
    }
    const pick = free[Math.floor(Math.random() * free.length)];
    await occupySpot(pick.id);
    lastAction = `Ocupada ${pick.id.slice(0, 8)}… (${simCount + 1}/${config.targetCount})`;
    return;
  }

  const simSpots = await prisma.spot.findMany({
    where: { id: { in: [...simSet] }, zone: config.zoneCode },
    select: { id: true },
  });
  if (simSpots.length === 0) {
    lastAction = "Sin plazas simuladas en la zona";
    return;
  }

  const free = await listFreeSpotsInZone(config.zoneCode, simSet);
  if (free.length === 0) {
    lastAction = "Zona llena · esperando liberación";
    return;
  }

  const toRelease = simSpots[Math.floor(Math.random() * simSpots.length)];
  const toOccupy = free[Math.floor(Math.random() * free.length)];
  await releaseSpot(toRelease.id);
  await occupySpot(toOccupy.id);
  lastAction = `Rotación · ${config.targetCount} plazas activas`;
}

export function getDevSpotSimStatus(): DevSpotSimStatus {
  const simSet = getDevSimOccupiedSpotIds();
  return {
    running,
    zoneCode: config?.zoneCode ?? null,
    targetCount: config?.targetCount ?? 0,
    occupiedCount: simSet.size,
    lastTickAt: lastTickAt?.toISOString() ?? null,
    lastAction,
    nextTickAt: nextTickAt?.toISOString() ?? null,
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

  config = { zoneCode: zone.code, targetCount };
  running = true;
  lastAction = "Simulación iniciada";
  void tick().finally(() => {
    if (running) scheduleNext();
  });

  return getDevSpotSimStatus();
}

export async function stopDevSpotSimulation() {
  running = false;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  nextTickAt = null;

  const simIds = [...getDevSimOccupiedSpotIds()];
  for (const spotId of simIds) {
    try {
      await releaseSpot(spotId);
    } catch {
      untrackDevSimSpot(spotId);
    }
  }
  clearDevSimSpots();
  config = null;
  lastAction = simIds.length > 0 ? `Detenida · ${simIds.length} plazas liberadas` : "Detenida";

  return getDevSpotSimStatus();
}
