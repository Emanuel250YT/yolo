import { getNow, getNowMs } from "../services/devClock.js";
import type { VehicleType } from "../prisma/client.js";
import { SPOT_HOLD_MS } from "../config/reservations.js";
import { calculateAmount } from "../services/pricing.js";
import { getTariffs } from "./tariffs.js";
import { prisma } from "../lib/prisma.js";
import { generateUniqueRef } from "../lib/shortRef.js";
import { createReservation, validateSchedule } from "./reservations.js";
import { expireStaleHolds } from "./spots.js";
import { createPaymentOrder } from "./paymentOrders.js";
import {
  findMercadoPagoCollectorForZone,
  isMercadoPagoLinked,
} from "./mercadopago.js";

export async function createSpotHold(
  spotId: string,
  user: { id: string; name: string },
  input: {
    plate: string;
    vehicleType?: string;
    scheduledStart: string | Date;
    durationHours?: number;
    durationMinutes?: number;
    digitalPayment?: boolean;
  },
) {
  await expireStaleHolds();

  const spot = await prisma.spot.findUnique({ where: { id: spotId } });
  if (!spot || !spot.enabled) {
    throw new Error("Plaza no disponible.");
  }
  if (spot.occupied >= spot.capacity) {
    throw new Error("La plaza ya está ocupada.");
  }

  const activeHold = await prisma.spotHold.findFirst({
    where: {
      spotId,
      expiresAt: { gt: getNow() },
    },
  });
  if (activeHold && activeHold.userId !== user.id) {
    throw new Error("La plaza está reservada temporalmente por otro usuario.");
  }
  if (activeHold) {
    await prisma.spotHold.delete({ where: { id: activeHold.id } });
  }

  validateSchedule(input.scheduledStart);

  const durationMinutes =
    input.durationHours != null
      ? Math.max(1, Math.min(23, Number(input.durationHours))) * 60
      : Math.max(15, Math.min(23 * 60, Number(input.durationMinutes) || 60));

  const tariffs = await getTariffs();
  const pricing = calculateAmount({
    vehicleType: input.vehicleType === "motorcycle" ? "motorcycle" : "auto",
    minutes: durationMinutes,
    digitalPayment: Boolean(input.digitalPayment),
    tariffs,
    free: spot.spotType === "gratuita",
  });

  const expiresAt = new Date(getNowMs() + SPOT_HOLD_MS);

  const hold = await prisma.spotHold.create({
    data: {
      ref: await generateUniqueRef("spotHold"),
      spotId,
      userId: user.id,
      userName: user.name,
      plate: input.plate.trim().toUpperCase(),
      vehicleType:
        input.vehicleType === "motorcycle" ? "motorcycle" : ("auto" as VehicleType),
      scheduledStart: new Date(input.scheduledStart),
      durationMinutes,
      digitalPayment: Boolean(input.digitalPayment),
      pricing,
      expiresAt,
    },
  });

  return {
    hold: {
      id: hold.id,
      ref: hold.ref,
      spotId: hold.spotId,
      plate: hold.plate,
      vehicleType: hold.vehicleType,
      scheduledStart: hold.scheduledStart.toISOString(),
      durationMinutes: hold.durationMinutes,
      digitalPayment: hold.digitalPayment,
      pricing: hold.pricing,
      expiresAt: hold.expiresAt.toISOString(),
      createdAt: hold.createdAt.toISOString(),
    },
    paymentDeadlineMs: SPOT_HOLD_MS,
  };
}

export async function confirmSpotHold(
  holdId: string,
  user: { id: string; name: string },
  paymentMethod: "cash" | "mercadopago" = "cash",
) {
  await expireStaleHolds();

  const hold = await prisma.spotHold.findUnique({ where: { id: holdId } });
  if (!hold) throw new Error("La reserva temporal expiró. Elegí otra plaza.");
  if (hold.userId !== user.id) throw new Error("No autorizado.");
  if (hold.expiresAt.getTime() <= getNowMs()) {
    await prisma.spotHold.delete({ where: { id: holdId } });
    throw new Error("Se agotaron los 10 minutos para pagar. Elegí la plaza nuevamente.");
  }

  const digital =
    paymentMethod === "mercadopago" ? true : hold.digitalPayment;

  if (paymentMethod === "mercadopago") {
    const spot = await prisma.spot.findUnique({ where: { id: hold.spotId } });
    if (!spot) throw new Error("Plaza no encontrada.");

    const collector = await findMercadoPagoCollectorForZone(spot.zone);
    if (!collector || !isMercadoPagoLinked(collector)) {
      throw new Error(
        "No hay permisionario con Mercado Pago vinculado en esta zona.",
      );
    }

    const pricing = hold.pricing as { net?: number };
    const amount = Number(pricing?.net ?? 0);
    if (amount <= 0) {
      throw new Error("El monto a cobrar debe ser mayor a cero.");
    }

    const payment = await createPaymentOrder({
      kind: "spot_hold",
      entityId: hold.id,
      permisionarioId: collector.id,
      title: `Reserva SEM · ${hold.plate}`,
      description: `Plaza ${spot.label} · ${hold.durationMinutes} min`,
      amount,
      expiresAt: hold.expiresAt,
      metadata: {
        userId: user.id,
        userName: user.name,
        spotLabel: spot.label,
        zone: spot.zone,
        holdRef: hold.ref,
      },
    });

    return { payment, paymentMethod };
  }

  const reservation = await createReservation(
    {
      spotId: hold.spotId,
      plate: hold.plate,
      vehicleType: hold.vehicleType,
      scheduledStart: hold.scheduledStart.toISOString(),
      durationMinutes: hold.durationMinutes,
      digitalPayment: digital,
    },
    user,
  );

  await prisma.spotHold.delete({ where: { id: holdId } });

  return { reservation, paymentMethod };
}

export async function cancelSpotHold(holdId: string, userId: string) {
  const hold = await prisma.spotHold.findUnique({ where: { id: holdId } });
  if (!hold || hold.userId !== userId) return false;
  await prisma.spotHold.delete({ where: { id: holdId } });
  return true;
}

export async function getSpotHold(holdId: string, userId: string) {
  await expireStaleHolds();
  const hold = await prisma.spotHold.findUnique({ where: { id: holdId } });
  if (!hold || hold.userId !== userId) return null;
  if (hold.expiresAt.getTime() <= getNowMs()) {
    await prisma.spotHold.delete({ where: { id: holdId } });
    return null;
  }
  return {
    id: hold.id,
    spotId: hold.spotId,
    plate: hold.plate,
    expiresAt: hold.expiresAt.toISOString(),
    pricing: hold.pricing,
    durationMinutes: hold.durationMinutes,
  };
}
