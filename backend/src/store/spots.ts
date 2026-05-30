import { getNow, getNowMs } from "../services/devClock.js";
import {
  paginatedResult,
  type PaginatedResult,
  type PaginationParams,
} from "../lib/pagination.js";
import { prisma } from "../lib/prisma.js";
import { distanceMeters, pointsAlongPolyline, polylineLengthMeters } from "../lib/polyline.js";
import { generateUniqueRef } from "../lib/shortRef.js";

export type SpotType = "pago" | "gratuita";

export function parseSpotType(raw: unknown): SpotType {
  return raw === "gratuita" ? "gratuita" : "pago";
}

type SpotRow = {
  id: string;
  ref: string | null;
  parkingZoneId: string | null;
  blockId: string | null;
  region: string | null;
  zone: string;
  label: string;
  row: number;
  col: number;
  address: string;
  lat: number | null;
  lng: number | null;
  capacity: number;
  occupied: number;
  spotType: SpotType;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
  block?: { name: string; street: string; code: string } | null;
  holds?: { id: string; userId: string; expiresAt: Date }[];
};

function mapSpotLive(s: SpotRow, viewerUserId?: string) {
  const activeHold = s.holds?.find((h) => h.expiresAt > getNow());
  const isHeld = Boolean(activeHold);
  const heldByMe = activeHold?.userId === viewerUserId;

  let status: "available" | "held" | "occupied" | "disabled" = "available";
  if (!s.enabled) status = "disabled";
  else if (s.occupied >= s.capacity) status = "occupied";
  else if (isHeld) status = "held";

  return {
    id: s.id,
    ref: s.ref,
    parkingZoneId: s.parkingZoneId,
    blockId: s.blockId,
    blockName: s.block?.name ?? null,
    blockStreet: s.block?.street ?? null,
    blockCode: s.block?.code ?? null,
    region: s.region,
    zone: s.zone,
    label: s.label,
    row: s.row,
    col: s.col,
    address: s.address,
    lat: s.lat,
    lng: s.lng,
    capacity: s.capacity,
    occupied: s.occupied,
    spotType: s.spotType ?? "pago",
    enabled: s.enabled,
    status,
    holdId: heldByMe ? activeHold?.id : null,
    holdExpiresAt: activeHold?.expiresAt.toISOString() ?? null,
    heldByMe,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

export async function expireStaleHolds() {
  const result = await prisma.spotHold.deleteMany({
    where: { expiresAt: { lte: getNow() } },
  });
  return { count: result.count };
}

async function ensureParkingFresh() {
  const { refreshParkingState } = await import("../services/expiry.js");
  await refreshParkingState();
}

export async function listSpotsLive(opts: {
  onlyAvailable?: boolean;
  blockId?: string;
  zoneCode?: string;
  viewerUserId?: string;
} = {}) {
  await ensureParkingFresh();

  const spots = await prisma.spot.findMany({
    where: {
      enabled: true,
      ...(opts.blockId ? { blockId: opts.blockId } : {}),
      ...(opts.zoneCode ? { zone: opts.zoneCode } : {}),
    },
    include: {
      block: { select: { name: true, street: true, code: true } },
      holds: {
        where: { expiresAt: { gt: getNow() } },
        select: { id: true, userId: true, expiresAt: true },
      },
    },
    orderBy: [{ blockId: "asc" }, { row: "asc" }, { col: "asc" }],
  });

  let mapped = spots.map((s) => mapSpotLive(s, opts.viewerUserId));
  if (opts.onlyAvailable) {
    mapped = mapped.filter((s) => s.status === "available");
  }
  return mapped;
}

export async function listSpots(opts: {
  onlyAvailable?: boolean;
  pagination?: PaginationParams;
  parkingZoneId?: string;
  zoneCode?: string;
  spotType?: SpotType;
} = {}): Promise<PaginatedResult<ReturnType<typeof mapSpotLive>> | ReturnType<typeof mapSpotLive>[]> {
  await ensureParkingFresh();

  const search = opts.pagination?.q
    ? {
        OR: [
          { label: { contains: opts.pagination.q, mode: "insensitive" as const } },
          { zone: { contains: opts.pagination.q, mode: "insensitive" as const } },
          { address: { contains: opts.pagination.q, mode: "insensitive" as const } },
          { ref: { contains: opts.pagination.q, mode: "insensitive" as const } },
        ],
      }
    : {};

  const where = {
    enabled: true,
    ...(opts.parkingZoneId ? { parkingZoneId: opts.parkingZoneId } : {}),
    ...(opts.zoneCode ? { zone: opts.zoneCode } : {}),
    ...(opts.spotType ? { spotType: opts.spotType } : {}),
    ...search,
  };

  if (!opts.pagination) {
    const spots = await prisma.spot.findMany({
      where,
      include: {
        block: { select: { name: true, street: true, code: true } },
        holds: {
          where: { expiresAt: { gt: getNow() } },
          select: { id: true, userId: true, expiresAt: true },
        },
      },
      orderBy: [{ blockId: "asc" }, { row: "asc" }, { col: "asc" }],
    });
    let mapped = spots.map((s) => mapSpotLive(s));
    if (opts.onlyAvailable) {
      mapped = mapped.filter((s) => s.status === "available");
    }
    return mapped;
  }

  const [total, spots] = await Promise.all([
    prisma.spot.count({ where }),
    prisma.spot.findMany({
      where,
      include: {
        block: { select: { name: true, street: true, code: true } },
        holds: {
          where: { expiresAt: { gt: getNow() } },
          select: { id: true, userId: true, expiresAt: true },
        },
      },
      orderBy: [{ blockId: "asc" }, { row: "asc" }, { col: "asc" }],
      skip: opts.pagination.skip,
      take: opts.pagination.take,
    }),
  ]);
  let mapped = spots.map((s) => mapSpotLive(s));
  if (opts.onlyAvailable) {
    mapped = mapped.filter((s) => s.status === "available");
  }
  return paginatedResult(mapped, total, opts.pagination);
}

export async function getSpot(id: string, viewerUserId?: string) {
  await ensureParkingFresh();
  const s = await prisma.spot.findUnique({
    where: { id },
    include: {
      block: { select: { name: true, street: true, code: true } },
      holds: {
        where: { expiresAt: { gt: getNow() } },
        select: { id: true, userId: true, expiresAt: true },
      },
    },
  });
  return s ? mapSpotLive(s, viewerUserId) : null;
}

export async function upsertSpot(payload: {
  id?: string;
  label?: string;
  zone?: string;
  region?: string;
  parkingZoneId?: string;
  blockId?: string;
  row?: number;
  col?: number;
  address?: string;
  lat?: number;
  lng?: number;
  capacity?: number;
  occupied?: number;
  spotType?: SpotType;
  enabled?: boolean;
}) {
  if (payload.id) {
    const s = await prisma.spot.update({
      where: { id: payload.id },
      data: {
        ...(payload.label !== undefined ? { label: payload.label } : {}),
        ...(payload.zone !== undefined ? { zone: payload.zone } : {}),
        ...(payload.region !== undefined ? { region: payload.region } : {}),
        ...(payload.parkingZoneId !== undefined
          ? { parkingZoneId: payload.parkingZoneId }
          : {}),
        ...(payload.blockId !== undefined ? { blockId: payload.blockId } : {}),
        ...(payload.row !== undefined ? { row: Number(payload.row) } : {}),
        ...(payload.col !== undefined ? { col: Number(payload.col) } : {}),
        ...(payload.address !== undefined ? { address: payload.address } : {}),
        ...(payload.lat !== undefined ? { lat: payload.lat } : {}),
        ...(payload.lng !== undefined ? { lng: payload.lng } : {}),
        ...(payload.capacity !== undefined
          ? { capacity: Number(payload.capacity) }
          : {}),
        ...(payload.occupied !== undefined
          ? { occupied: Number(payload.occupied) }
          : {}),
        ...(payload.spotType !== undefined
          ? { spotType: parseSpotType(payload.spotType) }
          : {}),
        ...(payload.enabled !== undefined ? { enabled: payload.enabled } : {}),
      },
      include: {
        block: { select: { name: true, street: true, code: true } },
        holds: true,
      },
    });
    return mapSpotLive(s);
  }

  if (!payload.label || !payload.zone) {
    throw new Error("label y zone son obligatorios.");
  }

  const s = await prisma.spot.create({
    data: {
      ref: await generateUniqueRef("spot"),
      label: payload.label,
      zone: payload.zone,
      region: payload.region ?? null,
      parkingZoneId: payload.parkingZoneId ?? null,
      blockId: payload.blockId ?? null,
      row: Number(payload.row) || 0,
      col: Number(payload.col) || 0,
      address: payload.address ?? "",
      lat: payload.lat ?? null,
      lng: payload.lng ?? null,
      capacity: Number(payload.capacity) || 1,
      occupied: Number(payload.occupied) || 0,
      spotType: parseSpotType(payload.spotType),
      enabled: payload.enabled !== false,
    },
    include: {
      block: { select: { name: true, street: true, code: true } },
      holds: true,
    },
  });
  return mapSpotLive(s);
}

export async function adjustOccupancy(spotId: string, delta: number) {
  const spot = await prisma.spot.findUnique({ where: { id: spotId } });
  if (!spot) return null;
  const occupied = Math.max(
    0,
    Math.min(spot.capacity, spot.occupied + delta),
  );
  const s = await prisma.spot.update({
    where: { id: spotId },
    data: { occupied },
    include: {
      block: { select: { name: true, street: true, code: true } },
      holds: true,
    },
  });
  return mapSpotLive(s);
}

/** Sincroniza `spot.occupied` con permisos/reservas vigentes (fuente de verdad). */
export async function reconcileSpotOccupancy(now = getNow()) {
  const nowMs = now.getTime();

  const holdingPermits = await prisma.permit.findMany({
    where: {
      spotId: { not: null },
      OR: [
        {
          status: "grace",
          graceUntil: { gt: now },
        },
        {
          status: "active",
          AND: [
            { OR: [{ endAt: null }, { endAt: { gt: now } }] },
            {
              OR: [
                { paymentMethod: "cash" },
                { paidAt: { not: null } },
              ],
            },
          ],
        },
      ],
    },
    select: { spotId: true },
  });

  const activeReservations = await prisma.reservation.findMany({
    where: { status: "confirmed" },
    select: { spotId: true, scheduledStart: true, durationMinutes: true },
  });

  const expected = new Map<string, number>();
  for (const p of holdingPermits) {
    if (!p.spotId) continue;
    expected.set(p.spotId, (expected.get(p.spotId) ?? 0) + 1);
  }
  for (const r of activeReservations) {
    if (r.scheduledStart.getTime() + r.durationMinutes * 60_000 <= nowMs) {
      continue;
    }
    expected.set(r.spotId, (expected.get(r.spotId) ?? 0) + 1);
  }

  const { getDevSimOccupiedSpotIds } = await import("../services/devSpotSimState.js");
  for (const spotId of getDevSimOccupiedSpotIds()) {
    expected.set(spotId, (expected.get(spotId) ?? 0) + 1);
  }

  const spotIds = new Set<string>([
    ...expected.keys(),
    ...(await prisma.spot.findMany({
      where: { occupied: { gt: 0 } },
      select: { id: true },
    })).map((s) => s.id),
  ]);

  let fixed = 0;
  for (const spotId of spotIds) {
    const spot = await prisma.spot.findUnique({
      where: { id: spotId },
      select: { id: true, capacity: true, occupied: true },
    });
    if (!spot) continue;
    const want = Math.min(spot.capacity, expected.get(spotId) ?? 0);
    if (spot.occupied !== want) {
      await prisma.spot.update({
        where: { id: spotId },
        data: { occupied: want },
      });
      fixed++;
    }
  }

  return { fixed, spotsChecked: spotIds.size };
}

export async function createSpotAtZonePoint(input: {
  zoneId: string;
  lat: number;
  lng: number;
  label?: string;
  spotType?: SpotType;
}) {
  const zone = await prisma.parkingZone.findUnique({
    where: { id: input.zoneId },
  });
  if (!zone) throw new Error("Zona no encontrada.");

  const count = await prisma.spot.count({
    where: { parkingZoneId: zone.id },
  });
  const index = count + 1;
  const label = input.label?.trim() || `P-${String(index).padStart(2, "0")}`;

  const s = await prisma.spot.create({
    data: {
      ref: await generateUniqueRef("spot"),
      blockId: null,
      parkingZoneId: zone.id,
      region: zone.region,
      zone: zone.code,
      label,
      row: Math.floor((index - 1) / 5),
      col: (index - 1) % 5,
      address: zone.name,
      lat: input.lat,
      lng: input.lng,
      capacity: 1,
      occupied: 0,
      spotType: parseSpotType(input.spotType),
      enabled: true,
    },
    include: {
      block: { select: { name: true, street: true, code: true } },
      holds: {
        where: { expiresAt: { gt: getNow() } },
        select: { id: true, userId: true, expiresAt: true },
      },
    },
  });
  return mapSpotLive(s);
}

export async function createSpotsAlongLine(input: {
  zoneId: string;
  points: { lat: number; lng: number }[];
  spacingM?: number;
  spotType?: SpotType;
}) {
  const zone = await prisma.parkingZone.findUnique({
    where: { id: input.zoneId },
  });
  if (!zone) throw new Error("Zona no encontrada.");

  const vertices = input.points.map(
    (p) => [p.lat, p.lng] as [number, number],
  );
  const spacingM = input.spacingM ?? 5;
  const positions = pointsAlongPolyline(vertices, spacingM);
  if (!positions.length) {
    throw new Error("No se pudieron calcular posiciones a lo largo de la calle.");
  }

  const lengthM = polylineLengthMeters(vertices);
  const startCount = await prisma.spot.count({
    where: { parkingZoneId: zone.id },
  });

  const spots = await prisma.$transaction(async (tx) => {
    const created = [];
    for (let i = 0; i < positions.length; i++) {
      const [lat, lng] = positions[i];
      const index = startCount + i + 1;
      const label = `P-${String(index).padStart(2, "0")}`;
      const s = await tx.spot.create({
        data: {
          ref: await generateUniqueRef("spot"),
          blockId: null,
          parkingZoneId: zone.id,
          region: zone.region,
          zone: zone.code,
          label,
          row: Math.floor((index - 1) / 5),
          col: (index - 1) % 5,
          address: zone.name,
          lat,
          lng,
          capacity: 1,
          occupied: 0,
          spotType: parseSpotType(input.spotType),
          enabled: true,
        },
        include: {
          block: { select: { name: true, street: true, code: true } },
          holds: {
            where: { expiresAt: { gt: getNow() } },
            select: { id: true, userId: true, expiresAt: true },
          },
        },
      });
      created.push(mapSpotLive(s));
    }
    return created;
  });

  return { spots, lengthM };
}

export async function createSpotAtPoint(input: {
  blockId: string;
  lat: number;
  lng: number;
  label?: string;
  spotType?: SpotType;
}) {
  const block = await prisma.parkingBlock.findUnique({
    where: { id: input.blockId },
    include: { zone: true, spots: true },
  });
  if (!block) throw new Error("Cuadra no encontrada.");

  const index = block.spots.length + 1;
  const label = input.label?.trim() || `P-${String(index).padStart(2, "0")}`;

  const s = await prisma.spot.create({
    data: {
      ref: await generateUniqueRef("spot"),
      blockId: block.id,
      parkingZoneId: block.zoneId,
      region: block.zone.region,
      zone: block.zone.code,
      label,
      row: Math.floor((index - 1) / 5),
      col: (index - 1) % 5,
      address: block.street || block.name,
      lat: input.lat,
      lng: input.lng,
      capacity: 1,
      occupied: 0,
      spotType: parseSpotType(input.spotType),
      enabled: true,
    },
    include: {
      block: { select: { name: true, street: true, code: true } },
      holds: {
        where: { expiresAt: { gt: getNow() } },
        select: { id: true, userId: true, expiresAt: true },
      },
    },
  });
  return mapSpotLive(s);
}

export async function setSpotOccupancy(
  spotId: string,
  occupied: boolean,
  actor: { id: string; role: string; zone?: string | null },
) {
  await expireStaleHolds();

  const spot = await prisma.spot.findUnique({ where: { id: spotId } });
  if (!spot || !spot.enabled) {
    throw new Error("Plaza no encontrada.");
  }

  if (actor.role === "permisionario" && actor.zone && spot.zone !== actor.zone) {
    throw new Error("No podés modificar plazas fuera de tu zona asignada.");
  }

  const activeHold = await prisma.spotHold.findFirst({
    where: { spotId, expiresAt: { gt: getNow() } },
  });
  if (activeHold) {
    throw new Error("La plaza tiene una reserva temporal activa.");
  }

  const s = await prisma.spot.update({
    where: { id: spotId },
    data: { occupied: occupied ? 1 : 0 },
    include: {
      block: { select: { name: true, street: true, code: true } },
      holds: {
        where: { expiresAt: { gt: getNow() } },
        select: { id: true, userId: true, expiresAt: true },
      },
    },
  });
  return mapSpotLive(s, actor.id);
}

type LiveSpot = ReturnType<typeof mapSpotLive>;

export function pickNearestAvailableSpot(
  spots: LiveSpot[],
  lat: number,
  lng: number,
): LiveSpot | null {
  let best: LiveSpot | null = null;
  let bestDist = Infinity;
  for (const s of spots) {
    if (s.status !== "available") continue;
    if (s.lat == null || s.lng == null) continue;
    const d = distanceMeters([lat, lng], [s.lat, s.lng]);
    if (d < bestDist) {
      bestDist = d;
      best = s;
    }
  }
  return best;
}

export async function resolvePermitSpot(opts: {
  zoneCode: string;
  spotId?: string | null;
  lat?: number | null;
  lng?: number | null;
}) {
  await expireStaleHolds();
  const spots = await listSpotsLive({ zoneCode: opts.zoneCode });

  if (opts.spotId) {
    const chosen = spots.find((s) => s.id === opts.spotId);
    if (!chosen) throw new Error("Plaza seleccionada no encontrada.");
    if (chosen.zone !== opts.zoneCode) {
      throw new Error("La plaza no pertenece a la zona del permiso.");
    }
    if (chosen.status !== "available") {
      throw new Error("La plaza seleccionada ya no está disponible.");
    }
    return chosen;
  }

  const lat = opts.lat;
  const lng = opts.lng;
  if (lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)) {
    const nearest = pickNearestAvailableSpot(spots, lat, lng);
    if (nearest) return nearest;
  }

  const fallback = spots.find((s) => s.status === "available");
  if (fallback) return fallback;

  throw new Error("No hay plazas libres en la zona.");
}

export async function occupySpotForPermit(
  spotId: string,
  actor: { id: string; role: string; zone?: string | null },
) {
  return setSpotOccupancy(spotId, true, actor);
}

export async function deleteSpot(spotId: string) {
  const spot = await prisma.spot.findUnique({ where: { id: spotId } });
  if (!spot) return false;
  await prisma.spot.delete({ where: { id: spotId } });
  return true;
}

export async function migrateLegacySpotsToBlocks() {
  const blockCount = await prisma.parkingBlock.count();
  if (blockCount > 0) return;

  const zones = await prisma.parkingZone.findMany();
  for (const z of zones) {
    const orphanSpots = await prisma.spot.findMany({
      where: { zone: z.code, blockId: null },
      orderBy: { label: "asc" },
    });
    if (!orphanSpots.length) continue;

    const block = await prisma.parkingBlock.create({
      data: {
        ref: await generateUniqueRef("parkingBlock"),
        zoneId: z.id,
        code: `${z.code}-c1`,
        name: `Cuadra ${z.name}`,
        street: z.description || z.name,
        lat: -24.7859,
        lng: -65.4115,
      },
    });

    for (let i = 0; i < orphanSpots.length; i++) {
      const row = Math.floor(i / 4);
      const col = i % 4;
      await prisma.spot.update({
        where: { id: orphanSpots[i].id },
        data: {
          blockId: block.id,
          parkingZoneId: z.id,
          region: z.region,
          row,
          col,
          capacity: 1,
        },
      });
    }
  }
}

export async function seedSpotsIfEmpty() {
  /* sin plazas precargadas — se marcan desde el mapa */
}
