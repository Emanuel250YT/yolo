import { prisma } from "../lib/prisma.js";
import { generateUniqueRef } from "../lib/shortRef.js";

export type ParkingPolygon = { points: [number, number][] };

function parsePolygons(raw: unknown): ParkingPolygon[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (p): p is { points: [number, number][] } =>
        Boolean(p) &&
        typeof p === "object" &&
        Array.isArray((p as ParkingPolygon).points),
    )
    .map((p) => ({
      points: p.points.map(([lat, lng]) => [
        Number(lat),
        Number(lng),
      ]) as [number, number][],
    }));
}

function mapZone(z: {
  id: string;
  ref: string | null;
  code: string;
  name: string;
  region: string;
  description: string;
  imageMimeType: string | null;
  imageBase64: string | null;
  imageWidth: number | null;
  imageHeight: number | null;
  polygons: unknown;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  const polygons = parsePolygons(z.polygons);
  return {
    id: z.id,
    ref: z.ref,
    code: z.code,
    name: z.name,
    region: z.region,
    description: z.description,
    imageMimeType: z.imageMimeType,
    hasImage: Boolean(z.imageBase64),
    imageWidth: z.imageWidth,
    imageHeight: z.imageHeight,
    polygons,
    slotCount: polygons.filter((p) => p.points.length >= 3).length,
    enabled: z.enabled,
    createdAt: z.createdAt.toISOString(),
    updatedAt: z.updatedAt.toISOString(),
  };
}

function mapZoneDetail(z: Parameters<typeof mapZone>[0]) {
  const base = mapZone(z);
  return {
    ...base,
    imageBase64: z.imageBase64,
  };
}

export async function listParkingZones(opts?: { includeImage?: boolean }) {
  const rows = await prisma.parkingZone.findMany({
    orderBy: { name: "asc" },
  });
  if (opts?.includeImage) {
    return rows.map(mapZoneDetail);
  }
  return rows.map(mapZone);
}

export async function getParkingZone(id: string) {
  const z = await prisma.parkingZone.findUnique({ where: { id } });
  return z ? mapZoneDetail(z) : null;
}

export async function getParkingZoneByCode(code: string) {
  const z = await prisma.parkingZone.findUnique({
    where: { code: code.trim().toLowerCase() },
  });
  return z ? mapZoneDetail(z) : null;
}

function normalizeCode(code: string) {
  return code
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

function stripBase64(data: string) {
  const m = /^data:([^;]+);base64,(.+)$/i.exec(data.trim());
  if (m) return { mime: m[1], data: m[2] };
  return { mime: null as string | null, data: data.trim() };
}

export async function createParkingZone(input: {
  code: string;
  name: string;
  region?: string;
  description?: string;
  imageMimeType?: string;
  imageBase64?: string;
  imageWidth?: number;
  imageHeight?: number;
  polygons?: ParkingPolygon[];
  enabled?: boolean;
}) {
  const code = normalizeCode(input.code);
  if (!code) throw new Error("El código de zona es obligatorio.");
  if (!input.name?.trim()) throw new Error("El nombre es obligatorio.");

  let imageMimeType = input.imageMimeType ?? null;
  let imageBase64: string | null = null;
  if (input.imageBase64) {
    const parsed = stripBase64(input.imageBase64);
    imageBase64 = parsed.data;
    imageMimeType = parsed.mime ?? imageMimeType ?? "image/jpeg";
  }

  const polygons = parsePolygons(input.polygons ?? []);

  const z = await prisma.parkingZone.create({
    data: {
      ref: await generateUniqueRef("parkingZone"),
      code,
      name: input.name.trim(),
      region: input.region?.trim() || "Centro",
      description: input.description?.trim() ?? "",
      imageMimeType,
      imageBase64,
      imageWidth: input.imageWidth ?? null,
      imageHeight: input.imageHeight ?? null,
      polygons,
      enabled: input.enabled !== false,
    },
  });
  return mapZoneDetail(z);
}

export async function updateParkingZone(
  id: string,
  input: {
    code?: string;
    name?: string;
    region?: string;
    description?: string;
    imageMimeType?: string;
    imageBase64?: string | null;
    imageWidth?: number;
    imageHeight?: number;
    polygons?: ParkingPolygon[];
    enabled?: boolean;
  },
) {
  const existing = await prisma.parkingZone.findUnique({ where: { id } });
  if (!existing) return null;

  let imageMimeType = existing.imageMimeType;
  let imageBase64 = existing.imageBase64;
  if (input.imageBase64 === null) {
    imageBase64 = null;
    imageMimeType = null;
  } else if (input.imageBase64) {
    const parsed = stripBase64(input.imageBase64);
    imageBase64 = parsed.data;
    imageMimeType = parsed.mime ?? input.imageMimeType ?? imageMimeType;
  }

  const z = await prisma.parkingZone.update({
    where: { id },
    data: {
      ...(input.code !== undefined
        ? { code: normalizeCode(input.code) }
        : {}),
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.region !== undefined ? { region: input.region.trim() } : {}),
      ...(input.description !== undefined
        ? { description: input.description.trim() }
        : {}),
      ...(input.imageWidth !== undefined
        ? { imageWidth: input.imageWidth }
        : {}),
      ...(input.imageHeight !== undefined
        ? { imageHeight: input.imageHeight }
        : {}),
      ...(input.polygons !== undefined
        ? { polygons: parsePolygons(input.polygons) }
        : {}),
      ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
      imageMimeType,
      imageBase64,
    },
  });
  return mapZoneDetail(z);
}

export async function deleteParkingZone(id: string) {
  const existing = await prisma.parkingZone.findUnique({ where: { id } });
  if (!existing) return false;

  const assigned = await prisma.user.count({
    where: { parkingZoneId: id },
  });
  if (assigned > 0) {
    throw new Error(
      `No se puede eliminar: ${assigned} permisionario(s) tienen esta zona asignada.`,
    );
  }

  await prisma.parkingZone.delete({ where: { id } });
  return true;
}

const DEFAULT_ZONES: {
  code: string;
  name: string;
  region: string;
  description: string;
  polygon: [number, number][];
}[] = [
  {
    code: "microcentro",
    name: "Microcentro",
    region: "Centro",
    description: "Zona diurna microcentro",
    polygon: [
      [-24.7838, -65.4148],
      [-24.7838, -65.4082],
      [-24.7882, -65.4082],
      [-24.7882, -65.4148],
    ],
  },
  {
    code: "paseo-balcarce",
    name: "Paseo Balcarce",
    region: "Centro",
    description: "",
    polygon: [
      [-24.7882, -65.4105],
      [-24.7882, -65.407],
      [-24.7908, -65.407],
      [-24.7908, -65.4105],
    ],
  },
  {
    code: "paseo-guemes",
    name: "Paseo Güemes",
    region: "Norte",
    description: "",
    polygon: [
      [-24.7812, -65.4182],
      [-24.7812, -65.4148],
      [-24.7838, -65.4148],
      [-24.7838, -65.4182],
    ],
  },
  {
    code: "plaza-alvarado",
    name: "Plaza Alvarado",
    region: "Sur",
    description: "",
    polygon: [
      [-24.79, -65.4158],
      [-24.79, -65.4126],
      [-24.7924, -65.4126],
      [-24.7924, -65.4158],
    ],
  },
  {
    code: "locales-diversión",
    name: "Locales de diversión",
    region: "Este",
    description: "Turno nocturno",
    polygon: [
      [-24.7775, -65.4112],
      [-24.7775, -65.4078],
      [-24.7801, -65.4078],
      [-24.7801, -65.4112],
    ],
  },
];

export async function migrateZonePolygonsIfEmpty() {
  const zones = await prisma.parkingZone.findMany();
  const byCode = new Map(DEFAULT_ZONES.map((z) => [z.code, z.polygon]));

  for (const z of zones) {
    const existing = parsePolygons(z.polygons);
    if (existing.some((p) => p.points.length >= 3)) continue;
    const points = byCode.get(z.code);
    if (!points) continue;
    await prisma.parkingZone.update({
      where: { id: z.id },
      data: { polygons: [{ points }] },
    });
  }
}

export async function seedParkingZonesIfEmpty() {
  const count = await prisma.parkingZone.count();
  if (count > 0) return;

  for (const z of DEFAULT_ZONES) {
    await prisma.parkingZone.create({
      data: {
        code: z.code,
        name: z.name,
        region: z.region ?? "Centro",
        description: z.description,
        polygons: z.polygon.length >= 3 ? [{ points: z.polygon }] : [],
        enabled: true,
      },
    });
  }
  console.log("[SEM] Zonas de parking iniciales creadas.");
}

/** Vincula permisionarios existentes por código en `zone` */
export async function linkUsersToParkingZones() {
  const zones = await prisma.parkingZone.findMany();
  const byCode = new Map(zones.map((z) => [z.code, z.id]));

  const users = await prisma.user.findMany({
    where: { role: "permisionario", zone: { not: null } },
  });

  for (const u of users) {
    if (!u.zone || u.parkingZoneId) continue;
    const id = byCode.get(u.zone);
    if (id) {
      await prisma.user.update({
        where: { id: u.id },
        data: { parkingZoneId: id },
      });
    }
  }
}
