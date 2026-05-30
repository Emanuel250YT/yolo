import { prisma } from "../lib/prisma.js";

export class SafeDeleteError extends Error {
  constructor(
    message: string,
    public readonly blockers: string[] = [],
  ) {
    super(message);
    this.name = "SafeDeleteError";
  }
}

function formatBlockers(blockers: string[]) {
  if (!blockers.length) return "";
  return blockers.map((b) => `• ${b}`).join("\n");
}

export async function getSpotDeleteBlockers(spotId: string) {
  const spot = await prisma.spot.findUnique({ where: { id: spotId } });
  if (!spot) return { spot: null, blockers: ["Plaza no encontrada."] as string[] };

  const blockers: string[] = [];

  if (spot.occupied > 0) {
    blockers.push("La plaza está marcada como ocupada.");
  }

  const activeHolds = await prisma.spotHold.count({
    where: { spotId, expiresAt: { gt: new Date() } },
  });
  if (activeHolds > 0) {
    blockers.push(
      `${activeHolds} reserva(s) temporal(es) activa(s) de conductores.`,
    );
  }

  const activeReservations = await prisma.reservation.count({
    where: { spotId, status: "confirmed" },
  });
  if (activeReservations > 0) {
    blockers.push(`${activeReservations} reserva(s) confirmada(s).`);
  }

  const totalReservations = await prisma.reservation.count({ where: { spotId } });
  if (totalReservations > activeReservations) {
    blockers.push(
      `${totalReservations - activeReservations} reserva(s) en historial vinculadas a esta plaza.`,
    );
  }

  return { spot, blockers };
}

export async function deleteSpotForce(spotId: string) {
  const spot = await prisma.spot.findUnique({ where: { id: spotId } });
  if (!spot) return false;
  await prisma.spotHold.deleteMany({ where: { spotId } });
  await prisma.spot.delete({ where: { id: spotId } });
  return true;
}

export async function deleteSpotSafe(spotId: string) {
  const { spot, blockers } = await getSpotDeleteBlockers(spotId);
  if (!spot) return false;
  if (blockers.length) {
    throw new SafeDeleteError(
      `No se puede eliminar la plaza ${spot.label}:\n${formatBlockers(blockers)}`,
      blockers,
    );
  }
  await prisma.spotHold.deleteMany({ where: { spotId } });
  await prisma.spot.delete({ where: { id: spotId } });
  return true;
}

export async function deleteParkingBlockSafe(blockId: string) {
  const block = await prisma.parkingBlock.findUnique({
    where: { id: blockId },
    include: { zone: { select: { name: true } } },
  });
  if (!block) return false;

  const spots = await prisma.spot.findMany({ where: { blockId } });
  const blockers: string[] = [];

  for (const spot of spots) {
    const { blockers: spotBlockers } = await getSpotDeleteBlockers(spot.id);
    if (spotBlockers.length) {
      blockers.push(`Plaza ${spot.label}: ${spotBlockers[0]}`);
    }
  }

  if (blockers.length) {
    throw new SafeDeleteError(
      `No se puede eliminar la cuadra «${block.name}»:\n${formatBlockers(blockers)}`,
      blockers,
    );
  }

  await prisma.$transaction([
    prisma.spotHold.deleteMany({
      where: { spot: { blockId } },
    }),
    prisma.spot.deleteMany({ where: { blockId } }),
    prisma.parkingBlock.delete({ where: { id: blockId } }),
  ]);
  return true;
}

/** Elimina la zona aunque haya vínculos (desvincula usuarios, cierra permisos/reservas activas). */
export async function deleteParkingZoneForce(id: string) {
  const zone = await prisma.parkingZone.findUnique({ where: { id } });
  if (!zone) return false;
  return deleteParkingZoneCascade(id, zone.code);
}

async function deleteParkingZoneCascade(id: string, zoneCode?: string) {
  const zone =
    zoneCode != null
      ? { id, code: zoneCode }
      : await prisma.parkingZone.findUnique({ where: { id } });
  if (!zone) return false;

  await prisma.$transaction([
    prisma.user.updateMany({
      where: { parkingZoneId: id },
      data: { parkingZoneId: null, zone: null },
    }),
    prisma.permit.updateMany({
      where: { zone: zone.code, status: "active" },
      data: { status: "completed" },
    }),
    prisma.reservation.updateMany({
      where: { zone: zone.code, status: "confirmed" },
      data: { status: "cancelled", cancelledAt: new Date() },
    }),
    prisma.spotHold.deleteMany({
      where: { spot: { parkingZoneId: id } },
    }),
    prisma.spot.updateMany({
      where: { parkingZoneId: id },
      data: { occupied: 0 },
    }),
    prisma.spot.deleteMany({ where: { parkingZoneId: id } }),
    prisma.parkingBlock.deleteMany({ where: { zoneId: id } }),
    prisma.parkingZone.delete({ where: { id } }),
  ]);
  return true;
}

export async function getParkingZoneDeleteBlockers(id: string) {
  const zone = await prisma.parkingZone.findUnique({ where: { id } });
  if (!zone) return { zone: null, blockers: ["Zona no encontrada."] as string[] };

  const blockers: string[] = [];

  const permisionarios = await prisma.user.count({
    where: { parkingZoneId: id },
  });
  if (permisionarios > 0) {
    blockers.push(
      `${permisionarios} permisionario(s) tienen esta zona asignada.`,
    );
  }

  const activePermits = await prisma.permit.count({
    where: { zone: zone.code, status: "active" },
  });
  if (activePermits > 0) {
    blockers.push(`${activePermits} permiso(s) de estacionamiento activo(s).`);
  }

  const activeReservations = await prisma.reservation.count({
    where: { zone: zone.code, status: "confirmed" },
  });
  if (activeReservations > 0) {
    blockers.push(`${activeReservations} reserva(s) de conductores activa(s).`);
  }

  const occupiedSpots = await prisma.spot.count({
    where: { zone: zone.code, occupied: { gt: 0 } },
  });
  if (occupiedSpots > 0) {
    blockers.push(`${occupiedSpots} plaza(s) ocupada(s) en esta zona.`);
  }

  const activeHolds = await prisma.spotHold.count({
    where: {
      expiresAt: { gt: new Date() },
      spot: { zone: zone.code },
    },
  });
  if (activeHolds > 0) {
    blockers.push(`${activeHolds} plaza(s) con reserva temporal activa.`);
  }

  const spotsWithHistory = await prisma.spot.count({
    where: {
      zone: zone.code,
      reservations: { some: {} },
    },
  });
  if (spotsWithHistory > 0) {
    blockers.push(
      `${spotsWithHistory} plaza(s) con historial de reservas.`,
    );
  }

  return { zone, blockers };
}

export async function deleteParkingZoneSafe(id: string) {
  const { zone, blockers } = await getParkingZoneDeleteBlockers(id);
  if (!zone) return false;

  if (blockers.length) {
    throw new SafeDeleteError(
      `Hay advertencias antes de eliminar «${zone.name}»:\n${formatBlockers(blockers)}`,
      blockers,
    );
  }

  return deleteParkingZoneCascade(id, zone.code);
}
