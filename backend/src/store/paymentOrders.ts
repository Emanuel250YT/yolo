import type { PaymentOrderKind, PaymentOrderStatus } from "../prisma/client.js";
import { prisma } from "../lib/prisma.js";
import { generateUniqueRef } from "../lib/shortRef.js";
import { paymentBrickUrl } from "../config/mercadopago.js";
import { createMercadoPagoPreference } from "../services/mercadopagoCheckout.js";
import { addHistoryEntry } from "./history.js";
import { createReservation } from "./reservations.js";

function mapOrder(o: {
  id: string;
  ref: string;
  kind: PaymentOrderKind;
  entityId: string;
  permisionarioId: string;
  preferenceId: string;
  initPoint: string | null;
  amount: number;
  currencyId: string;
  status: PaymentOrderStatus;
  title: string;
  description: string | null;
  mpPaymentId: string | null;
  paidAt: Date | null;
  expiresAt: Date | null;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: o.id,
    orderId: o.ref,
    kind: o.kind,
    entityId: o.entityId,
    permisionarioId: o.permisionarioId,
    preferenceId: o.preferenceId,
    initPoint: o.initPoint,
    amount: o.amount,
    currencyId: o.currencyId,
    status: o.status,
    title: o.title,
    description: o.description,
    mpPaymentId: o.mpPaymentId,
    paidAt: o.paidAt?.toISOString() ?? null,
    expiresAt: o.expiresAt?.toISOString() ?? null,
    metadata: o.metadata,
    paymentUrl: paymentBrickUrl(o.ref),
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
  };
}

export async function getPaymentOrderByRef(ref: string) {
  const order = await prisma.paymentOrder.findUnique({ where: { ref } });
  return order ? mapOrder(order) : null;
}

export async function createPaymentOrder(input: {
  kind: PaymentOrderKind;
  entityId: string;
  permisionarioId: string;
  title: string;
  description?: string;
  amount: number;
  expiresAt?: Date;
  metadata?: Record<string, unknown>;
}) {
  const ref = await generateUniqueRef("paymentOrder");
  const preference = await createMercadoPagoPreference({
    permisionarioId: input.permisionarioId,
    orderRef: ref,
    title: input.title,
    description: input.description,
    amount: input.amount,
  });

  const order = await prisma.paymentOrder.create({
    data: {
      ref,
      kind: input.kind,
      entityId: input.entityId,
      permisionarioId: input.permisionarioId,
      preferenceId: preference.preferenceId,
      initPoint: preference.initPoint,
      amount: input.amount,
      title: input.title,
      description: input.description ?? null,
      expiresAt: input.expiresAt ?? new Date(Date.now() + 24 * 60 * 60 * 1000),
      metadata: (input.metadata ?? undefined) as import("../prisma/client.js").Prisma.InputJsonValue | undefined,
    },
  });

  return mapOrder(order);
}

async function fulfillPermitPayment(order: {
  entityId: string;
  ref: string;
  mpPaymentId: string | null;
}) {
  const permit = await prisma.permit.findUnique({ where: { id: order.entityId } });
  if (!permit) return;

  await prisma.permit.update({
    where: { id: permit.id },
    data: { paidAt: new Date() },
  });

  await addHistoryEntry({
    permitId: permit.id,
    userId: permit.permisionarioId,
    userName: permit.permisionarioName,
    action: "update",
    entityRef: permit.ref,
    entityLabel: permit.plate,
    observation: `Pago Mercado Pago confirmado · orden ${order.ref}${order.mpPaymentId ? ` · pago ${order.mpPaymentId}` : ""}`,
  });
}

async function fulfillSpotHoldPayment(order: {
  entityId: string;
  metadata: unknown;
}) {
  const hold = await prisma.spotHold.findUnique({ where: { id: order.entityId } });
  if (!hold) return;

  const meta = (order.metadata ?? {}) as {
    userId?: string;
    userName?: string;
  };

  if (!meta.userId || !meta.userName) return;

  await createReservation(
    {
      spotId: hold.spotId,
      plate: hold.plate,
      vehicleType: hold.vehicleType,
      scheduledStart: hold.scheduledStart.toISOString(),
      durationMinutes: hold.durationMinutes,
      digitalPayment: true,
    },
    { id: meta.userId, name: meta.userName },
  );

  await prisma.spotHold.delete({ where: { id: hold.id } });
}

export async function markPaymentOrderPaid(
  orderRef: string,
  mpPaymentId: string | null,
  status: string,
) {
  const order = await prisma.paymentOrder.findUnique({ where: { ref: orderRef } });
  if (!order) throw new Error("Orden de pago no encontrada.");
  if (order.status === "paid") return mapOrder(order);

  const approved = status === "approved" || status === "authorized";
  if (!approved) {
    throw new Error(`Pago no aprobado (${status}).`);
  }

  const updated = await prisma.paymentOrder.update({
    where: { ref: orderRef },
    data: {
      status: "paid",
      paidAt: new Date(),
      mpPaymentId,
    },
  });

  if (updated.kind === "permit") {
    await fulfillPermitPayment(updated);
  } else if (updated.kind === "spot_hold") {
    await fulfillSpotHoldPayment(updated);
  }

  return mapOrder(updated);
}

export async function expireStalePaymentOrders() {
  await prisma.paymentOrder.updateMany({
    where: {
      status: "pending",
      expiresAt: { lt: new Date() },
    },
    data: { status: "expired" },
  });
}
