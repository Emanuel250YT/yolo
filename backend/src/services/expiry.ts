import { PERMIT_GRACE_MS } from "../config/permits.js";
import { getNow, isSimulatedClockActive } from "./devClock.js";
import { prisma } from "../lib/prisma.js";
import { expireStalePaymentOrders } from "../store/paymentOrders.js";
import { adjustOccupancy, expireStaleHolds } from "../store/spots.js";

export async function expireStalePermits(now = getNow()) {
  const toGrace = await prisma.permit.findMany({
    where: {
      status: "active",
      endAt: { lte: now },
    },
    select: { id: true, endAt: true },
  });

  if (toGrace.length > 0) {
    for (const permit of toGrace) {
      const graceUntil = new Date(
        (permit.endAt?.getTime() ?? now.getTime()) + PERMIT_GRACE_MS,
      );
      await prisma.permit.update({
        where: { id: permit.id },
        data: { status: "grace", graceUntil },
      });
    }
  }

  const toCancel = await prisma.permit.findMany({
    where: {
      status: "grace",
      graceUntil: { lte: now },
    },
    select: { id: true, spotId: true },
  });

  if (toCancel.length > 0) {
    await prisma.permit.updateMany({
      where: { id: { in: toCancel.map((p) => p.id) } },
      data: { status: "cancelled", graceUntil: null },
    });

    await prisma.paymentOrder.updateMany({
      where: {
        kind: "permit",
        entityId: { in: toCancel.map((p) => p.id) },
        status: "pending",
      },
      data: { status: "cancelled" },
    });

    for (const permit of toCancel) {
      if (permit.spotId) {
        await adjustOccupancy(permit.spotId, -1);
      }
    }
  }

  return { count: toGrace.length + toCancel.length };
}

export async function expireStaleReservations(now = getNow()) {
  const active = await prisma.reservation.findMany({
    where: { status: "confirmed" },
    select: {
      id: true,
      spotId: true,
      scheduledStart: true,
      durationMinutes: true,
    },
  });

  const toExpire = active.filter(
    (r) =>
      r.scheduledStart.getTime() + r.durationMinutes * 60_000 <= now.getTime(),
  );

  if (toExpire.length === 0) return { count: 0 };

  for (const r of toExpire) {
    await prisma.reservation.update({
      where: { id: r.id },
      data: { status: "cancelled", cancelledAt: now },
    });
    await adjustOccupancy(r.spotId, -1);
  }

  return { count: toExpire.length };
}

export interface ActiveExpiryResult {
  at: string;
  simulated: boolean;
  permitsExpired: number;
  holdsExpired: number;
  paymentOrdersExpired: number;
  reservationsExpired: number;
}

export async function expireAllActiveRecords(): Promise<ActiveExpiryResult> {
  const now = getNow();
  const [permits, holds, paymentOrders, reservations] = await Promise.all([
    expireStalePermits(now),
    expireStaleHolds(),
    expireStalePaymentOrders(),
    expireStaleReservations(now),
  ]);

  return {
    at: now.toISOString(),
    simulated: isSimulatedClockActive(),
    permitsExpired: permits.count,
    holdsExpired: holds.count,
    paymentOrdersExpired: paymentOrders.count,
    reservationsExpired: reservations.count,
  };
}

/** @deprecated Use expireAllActiveRecords */
export async function expireStaleRecords() {
  const result = await expireAllActiveRecords();
  return { permitsExpired: result.permitsExpired };
}
