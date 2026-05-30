import { prisma } from "../lib/prisma.js";

export async function syncUserParkingZones(
  userId: string,
  zoneIds: string[],
): Promise<{ parkingZoneId: string | null; zone: string | null }> {
  const uniqueIds = [...new Set(zoneIds.filter(Boolean))];

  if (uniqueIds.length) {
    const zones = await prisma.parkingZone.findMany({
      where: { id: { in: uniqueIds }, enabled: true },
    });
    if (zones.length !== uniqueIds.length) {
      throw new Error("Una o más zonas no existen o están inactivas.");
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.userParkingZone.deleteMany({ where: { userId } });
    if (uniqueIds.length) {
      await tx.userParkingZone.createMany({
        data: uniqueIds.map((parkingZoneId) => ({ userId, parkingZoneId })),
      });
    }
  });

  if (!uniqueIds.length) {
    await prisma.user.update({
      where: { id: userId },
      data: { parkingZoneId: null, zone: null },
    });
    return { parkingZoneId: null, zone: null };
  }

  const primary = await prisma.parkingZone.findUnique({
    where: { id: uniqueIds[0] },
  });

  await prisma.user.update({
    where: { id: userId },
    data: {
      parkingZoneId: primary?.id ?? null,
      zone: primary?.code ?? null,
    },
  });

  return {
    parkingZoneId: primary?.id ?? null,
    zone: primary?.code ?? null,
  };
}

export async function getUserAssignedZoneIds(userId: string): Promise<string[]> {
  const rows = await prisma.userParkingZone.findMany({
    where: { userId },
    select: { parkingZoneId: true },
    orderBy: { assignedAt: "asc" },
  });
  return rows.map((r) => r.parkingZoneId);
}

export async function getUserAssignedZoneCodes(userId: string): Promise<string[]> {
  const rows = await prisma.userParkingZone.findMany({
    where: { userId },
    include: { parkingZone: { select: { code: true } } },
    orderBy: { assignedAt: "asc" },
  });
  return rows.map((r) => r.parkingZone.code);
}

export async function userCanAccessZone(
  userId: string,
  zone: { id: string; code: string },
  legacy?: { parkingZoneId?: string | null; zone?: string | null },
): Promise<boolean> {
  const assigned = await prisma.userParkingZone.findFirst({
    where: {
      userId,
      OR: [{ parkingZoneId: zone.id }, { parkingZone: { code: zone.code } }],
    },
  });
  if (assigned) return true;
  if (legacy?.parkingZoneId === zone.id) return true;
  if (legacy?.zone === zone.code) return true;
  return false;
}
