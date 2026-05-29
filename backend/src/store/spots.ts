import { prisma } from "../lib/prisma.js";

function mapSpot(s: {
  id: string;
  label: string;
  zone: string;
  address: string;
  capacity: number;
  occupied: number;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...s,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

export async function listSpots(opts: { onlyAvailable?: boolean } = {}) {
  const spots = await prisma.spot.findMany({
    where: { enabled: true },
    orderBy: { label: "asc" },
  });
  let list = spots;
  if (opts.onlyAvailable) {
    list = list.filter((s) => s.occupied < s.capacity);
  }
  return list.map(mapSpot);
}

export async function getSpot(id: string) {
  const s = await prisma.spot.findUnique({ where: { id } });
  return s ? mapSpot(s) : null;
}

export async function upsertSpot(payload: {
  id?: string;
  label?: string;
  zone?: string;
  address?: string;
  capacity?: number;
  occupied?: number;
  enabled?: boolean;
}) {
  if (payload.id) {
    const s = await prisma.spot.update({
      where: { id: payload.id },
      data: {
        ...(payload.label !== undefined ? { label: payload.label } : {}),
        ...(payload.zone !== undefined ? { zone: payload.zone } : {}),
        ...(payload.address !== undefined ? { address: payload.address } : {}),
        ...(payload.capacity !== undefined
          ? { capacity: Number(payload.capacity) }
          : {}),
        ...(payload.occupied !== undefined
          ? { occupied: Number(payload.occupied) }
          : {}),
        ...(payload.enabled !== undefined ? { enabled: payload.enabled } : {}),
      },
    });
    return mapSpot(s);
  }

  if (!payload.label || !payload.zone) {
    throw new Error("label y zone son obligatorios.");
  }

  const s = await prisma.spot.create({
    data: {
      label: payload.label,
      zone: payload.zone,
      address: payload.address ?? "",
      capacity: Number(payload.capacity) || 10,
      occupied: Number(payload.occupied) || 0,
      enabled: payload.enabled !== false,
    },
  });
  return mapSpot(s);
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
  });
  return mapSpot(s);
}

export async function seedSpotsIfEmpty() {
  const count = await prisma.spot.count();
  if (count > 0) return;

  const zones = [
    {
      zone: "microcentro",
      label: "Cuadra Centro 1",
      address: "España y Buenos Aires",
    },
    {
      zone: "microcentro",
      label: "Cuadra Centro 2",
      address: "Caseros y Mitre",
    },
    {
      zone: "paseo-balcarce",
      label: "Paseo Balcarce A",
      address: "Balcarce 100",
    },
    { zone: "paseo-guemes", label: "Paseo Güemes B", address: "Güemes 200" },
    {
      zone: "plaza-alvarado",
      label: "Plaza Alvarado",
      address: "Av. Figueroa",
    },
  ];

  await prisma.spot.createMany({
    data: zones.map((z) => ({
      label: z.label,
      zone: z.zone,
      address: z.address,
      capacity: 12,
      occupied: Math.floor(Math.random() * 8),
      enabled: true,
    })),
  });
}
