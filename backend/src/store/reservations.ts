import type { UserRole } from "@prisma/client";
import { MAX_RESERVATION_ADVANCE_MS } from "../config/auth.js";
import { calculateAmount } from "../services/pricing.js";
import { prisma } from "../lib/prisma.js";
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
  userId: string;
  userName: string;
  spotId: string;
  spotLabel: string;
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
  return {
    id: r.id,
    userId: r.userId,
    userName: r.userName,
    spotId: r.spotId,
    spotLabel: r.spotLabel,
    zone: r.zone,
    plate: r.plate,
    vehicleType: r.vehicleType,
    scheduledStart: r.scheduledStart.toISOString(),
    durationMinutes: r.durationMinutes,
    digitalPayment: r.digitalPayment,
    pricing: r.pricing,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
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
    digitalPayment?: boolean;
  },
  user: { id: string; name: string },
) {
  validateSchedule(input.scheduledStart);

  const spot = await getSpot(input.spotId);
  if (!spot || !spot.enabled) {
    throw new Error("Lugar de estacionamiento no disponible.");
  }
  if (spot.occupied >= spot.capacity) {
    throw new Error("No hay cupos libres en este lugar.");
  }

  const minutes = Math.max(
    15,
    Math.min(480, Number(input.durationMinutes) || 60),
  );
  const pricing = calculateAmount({
    vehicleType: input.vehicleType === "motorcycle" ? "motorcycle" : "auto",
    minutes,
    digitalPayment: Boolean(input.digitalPayment),
  });

  const reservation = await prisma.reservation.create({
    data: {
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
