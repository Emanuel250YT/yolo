import { prisma } from "../lib/prisma.js";
import { generateUniqueRef } from "../lib/shortRef.js";

function mapBlock(b: {
  id: string;
  ref: string | null;
  zoneId: string;
  code: string;
  name: string;
  street: string;
  lat: number | null;
  lng: number | null;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
  zone?: { code: string; name: string; region: string };
}) {
  return {
    id: b.id,
    ref: b.ref,
    zoneId: b.zoneId,
    zoneCode: b.zone?.code,
    zoneName: b.zone?.name,
    region: b.zone?.region,
    code: b.code,
    name: b.name,
    street: b.street,
    lat: b.lat,
    lng: b.lng,
    enabled: b.enabled,
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
  };
}

export async function listParkingBlocks(opts?: { zoneId?: string }) {
  const rows = await prisma.parkingBlock.findMany({
    where: {
      enabled: true,
      ...(opts?.zoneId ? { zoneId: opts.zoneId } : {}),
    },
    include: { zone: { select: { code: true, name: true, region: true } } },
    orderBy: [{ zone: { name: "asc" } }, { name: "asc" }],
  });
  return rows.map(mapBlock);
}

export async function createParkingBlock(input: {
  zoneId: string;
  code: string;
  name: string;
  street?: string;
  lat?: number;
  lng?: number;
}) {
  const code = input.code.trim().toLowerCase().replace(/\s+/g, "-");
  if (!code || !input.name?.trim()) {
    throw new Error("Código y nombre de cuadra son obligatorios.");
  }
  const block = await prisma.parkingBlock.create({
    data: {
      ref: await generateUniqueRef("parkingBlock"),
      zoneId: input.zoneId,
      code,
      name: input.name.trim(),
      street: input.street?.trim() ?? "",
      lat: input.lat ?? null,
      lng: input.lng ?? null,
    },
    include: { zone: { select: { code: true, name: true, region: true } } },
  });
  return mapBlock(block);
}

export async function createBlockSpotGrid(input: {
  blockId: string;
  rows: number;
  cols: number;
  prefix?: string;
}) {
  const block = await prisma.parkingBlock.findUnique({
    where: { id: input.blockId },
    include: { zone: true },
  });
  if (!block) throw new Error("Cuadra no encontrada.");

  const rows = Math.max(1, Math.min(20, Number(input.rows) || 1));
  const cols = Math.max(1, Math.min(30, Number(input.cols) || 1));
  const prefix = (input.prefix ?? "P").trim().toUpperCase();

  const created = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const label = `${prefix}-${String(r * cols + c + 1).padStart(2, "0")}`;
      const spot = await prisma.spot.create({
        data: {
          ref: await generateUniqueRef("spot"),
          blockId: block.id,
          parkingZoneId: block.zoneId,
          region: block.zone.region,
          zone: block.zone.code,
          label,
          row: r,
          col: c,
          address: block.street || block.name,
          lat: block.lat,
          lng: block.lng,
          capacity: 1,
          occupied: 0,
          enabled: true,
        },
      });
      created.push(spot);
    }
  }
  return created.length;
}

export async function deleteParkingBlock(id: string) {
  const block = await prisma.parkingBlock.findUnique({ where: { id } });
  if (!block) return false;
  await prisma.parkingBlock.delete({ where: { id } });
  return true;
}
