import type { UserRole } from "../prisma/client.js";
import { MAX_RESERVATION_ADVANCE_MS } from "../config/auth.js";
import { calculateAmount } from "../services/pricing.js";
import { prisma } from "../lib/prisma.js";
import { generateUniqueRef } from "../lib/shortRef.js";
import { adjustOccupancy, getSpot } from "./spots.js";

export function validateSchedule(scheduledStart: string | Date) {
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

function mapReservation(r: {
  id: string;
  ref: string | null;
  userId: string;
  userName: string;
  user?: { ref: string | null } | null;
  spotId: string;
  spotLabel: string;
  spot?: { ref: string | null } | null;
  zone: string;
  plate: string;
  vehicleType: string;
  scheduledStart: Date;
  durationMinutes: number;
  digitalPayment: boolean;
  pricing: unknown;
  status: string;
  createdAt: Date;
}) {
  const { user, spot, scheduledStart, createdAt, ...rest } = r;
  return {
    ...rest,
    userRef: user?.ref ?? null,
    spotRef: spot?.ref ?? null,
    scheduledStart: scheduledStart.toISOString(),
    createdAt: createdAt.toISOString(),
  };
}

export async function listReservations(opts: {
  userId?: string;
  status?: string;
} = {}) {
  const list = await prisma.reservation.findMany({
    where: {
      ...(opts.userId ? { userId: opts.userId } : {}),
      ...(opts.status
        ? { status: opts.status as "confirmed" | "cancelled" }
        : {}),
    },
    include: {
      user: { select: { ref: true } },
      spot: { select: { ref: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return list.map(mapReservation);
}

export async function createReservation(
  input: {
    spotId: string;
    plate: string;
    vehicleType?: string;
    scheduledStart: string | Date;
    durationMinutes?: number;
    durationHours?: number;
    digitalPayment?: boolean;
  },
  user: { id: string; name: string },
) {
  validateSchedule(input.scheduledStart);

  const spot = await getSpot(input.spotId, user.id);
  if (!spot || !spot.enabled) {
    throw new Error("Lugar de estacionamiento no disponible.");
  }
  if (spot.status === "occupied") {
    throw new Error("No hay cupos libres en este lugar.");
  }
  if (spot.status === "held" && !spot.heldByMe) {
    throw new Error("La plaza está reservada temporalmente por otro usuario.");
  }

  const minutes =
    input.durationHours != null
      ? Math.max(1, Math.min(23, Number(input.durationHours))) * 60
      : Math.max(15, Math.min(23 * 60, Number(input.durationMinutes) || 60));
  const pricing = calculateAmount({
    vehicleType: input.vehicleType === "motorcycle" ? "motorcycle" : "auto",
    minutes,
    digitalPayment: Boolean(input.digitalPayment),
  });

  const reservation = await prisma.reservation.create({
    data: {
      ref: await generateUniqueRef("reservation"),
      userId: user.id,
      userName: user.name,
      spotId: input.spotId,
      spotLabel: spot.label,
      zone: spot.zone,
      plate: input.plate.trim().toUpperCase(),
      vehicleType:
        input.vehicleType === "motorcycle" ? "motorcycle" : "auto",
      scheduledStart: new Date(input.scheduledStart),
      durationMinutes: minutes,
      digitalPayment: Boolean(input.digitalPayment),
      pricing,
    },
  });

  await adjustOccupancy(input.spotId, 1);
  return mapReservation(reservation);
}

export async function cancelReservation(
  id: string,
  user: { id: string; role: UserRole },
) {
  const r = await prisma.reservation.findUnique({ where: { id } });
  if (!r) return null;
  if (user.role !== "admin" && r.userId !== user.id) {
    throw new Error("No autorizado.");
  }
  if (r.status === "cancelled") {
    return mapReservation(r);
  }

  const updated = await prisma.reservation.update({
    where: { id },
    data: { status: "cancelled", cancelledAt: new Date() },
  });

  await adjustOccupancy(r.spotId, -1);
  return mapReservation(updated);
}
