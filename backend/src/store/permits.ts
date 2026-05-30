import type { PaymentMethod, PermitStatus, Prisma, VehicleType } from "../prisma/client.js";
import { prisma } from "../lib/prisma.js";
import { generateUniqueRef } from "../lib/shortRef.js";
import { calculateAmount } from "../services/pricing.js";
import { expireStalePermits } from "../services/expiry.js";
import type { AuthActor } from "../types/api.js";
import { getTariffs } from "./tariffs.js";
import { addHistoryEntry } from "./history.js";

const PERMIT_ROLES = new Set(["admin", "permisionario", "municipio"]);

function mapPermit(p: {
  id: string;
  ref: string | null;
  permisionarioId: string;
  permisionario?: { ref: string | null } | null;
  permisionarioName: string;
  permisionarioLegajo: string | null;
  plate: string;
  zone: string;
  vehicleType: VehicleType;
  notes: string | null;
  durationMinutes: number;
  pricing: unknown;
  paymentMethod: PaymentMethod | null;
  paidAt: Date | null;
  status: PermitStatus;
  startAt: Date;
  endAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  const { permisionario, startAt, endAt, paidAt, createdAt, updatedAt, ...rest } = p;
  return {
    ...rest,
    permisionarioRef: permisionario?.ref ?? null,
    startAt: startAt.toISOString(),
    endAt: endAt?.toISOString() ?? null,
    paidAt: paidAt?.toISOString() ?? null,
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
  };
}

export async function listPermits(opts: {
  permisionarioId?: string;
  status?: PermitStatus;
} = {}) {
  await expireStalePermits();
  const permits = await prisma.permit.findMany({
    where: {
      ...(opts.permisionarioId
        ? { permisionarioId: opts.permisionarioId }
        : {}),
      ...(opts.status ? { status: opts.status } : {}),
    },
    include: {
      permisionario: { select: { ref: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return permits.map(mapPermit);
}

export async function getPermit(id: string) {
  await expireStalePermits();
  const p = await prisma.permit.findUnique({ where: { id } });
  return p ? mapPermit(p) : null;
}

export async function createPermit(
  input: {
    plate: string;
    zone?: string;
    vehicleType?: string;
    notes?: string;
    startAt?: string;
    endAt?: string | null;
    durationMinutes?: number;
    hours?: number;
    paymentMethod?: string;
  },
  actor: AuthActor,
) {
  if (!PERMIT_ROLES.has(actor.role)) {
    throw new Error("Sin permisos para crear permisos de estacionamiento.");
  }
  if (!input.plate?.trim()) throw new Error("La patente es obligatoria.");

  const durationMinutes =
    input.durationMinutes != null
      ? Number(input.durationMinutes)
      : input.hours != null
        ? Number(input.hours) * 60
        : 60;

  if (!Number.isFinite(durationMinutes) || durationMinutes < 15) {
    throw new Error("Indicá una duración válida (mínimo 15 minutos).");
  }

  const paymentMethod: PaymentMethod | null =
    input.paymentMethod === "mercadopago"
      ? "mercadopago"
      : input.paymentMethod === "cash"
        ? "cash"
        : null;

  if (!paymentMethod) {
    throw new Error("Seleccioná un método de pago.");
  }

  const vehicleType =
    input.vehicleType === "motorcycle" ? "motorcycle" : "auto";
  const tariffs = await getTariffs();
  const pricing = calculateAmount({
    vehicleType,
    minutes: durationMinutes,
    digitalPayment: paymentMethod === "mercadopago",
    tariffs,
  });

  const startAt = input.startAt ? new Date(input.startAt) : new Date();
  const endAt = input.endAt
    ? new Date(input.endAt)
    : new Date(startAt.getTime() + durationMinutes * 60_000);

  const permit = await prisma.permit.create({
    data: {
      ref: await generateUniqueRef("permit"),
      permisionarioId: actor.id,
      permisionarioName: actor.name,
      permisionarioLegajo: actor.legajo ?? null,
      plate: input.plate.trim().toUpperCase(),
      zone: input.zone?.trim() || actor.zone || "microcentro",
      vehicleType,
      notes: input.notes?.trim() || null,
      durationMinutes,
      pricing,
      paymentMethod,
      paidAt: new Date(),
      startAt,
      endAt,
    },
  });

  const mapped = mapPermit(permit);
  await addHistoryEntry({
    permitId: permit.id,
    userId: actor.id,
    userName: actor.name,
    action: "create",
    entityRef: permit.ref,
    entityLabel: permit.plate,
    after: JSON.parse(JSON.stringify(mapped)) as Prisma.InputJsonValue,
    observation: `Pago ${paymentMethod === "cash" ? "en efectivo" : "MercadoPago (simulado)"} · $${pricing.net}`,
  });

  return mapped;
}

function isStaff(actor: AuthActor) {
  return actor.role === "admin" || actor.role === "municipio";
}

export async function updatePermit(
  id: string,
  patch: Record<string, unknown>,
  actor: AuthActor,
) {
  const existing = await prisma.permit.findUnique({ where: { id } });
  if (!existing) return null;

  if (
    actor.role === "permisionario" &&
    existing.permisionarioId !== actor.id
  ) {
    throw new Error("No podés modificar permisos de otro permisionario.");
  }

  const before = mapPermit(existing);
  const data: Record<string, unknown> = {};

  if (patch.plate !== undefined) {
    data.plate = String(patch.plate).trim().toUpperCase();
  }
  if (patch.zone !== undefined && isStaff(actor)) data.zone = patch.zone;
  if (patch.vehicleType !== undefined) {
    data.vehicleType =
      patch.vehicleType === "motorcycle" ? "motorcycle" : "auto";
  }
  if (patch.notes !== undefined) data.notes = patch.notes;
  if (patch.status !== undefined) data.status = patch.status;
  if (patch.endAt !== undefined) {
    data.endAt = patch.endAt ? new Date(String(patch.endAt)) : null;
  }

  const permit = await prisma.permit.update({
    where: { id },
    data,
  });

  const mapped = mapPermit(permit);
  await addHistoryEntry({
    permitId: id,
    userId: actor.id,
    userName: actor.name,
    action: "update",
    entityRef: permit.ref,
    entityLabel: permit.plate,
    before: JSON.parse(JSON.stringify(before)) as Prisma.InputJsonValue,
    after: JSON.parse(JSON.stringify(mapped)) as Prisma.InputJsonValue,
    observation:
      typeof patch.observation === "string" ? patch.observation : null,
  });

  return mapped;
}

export async function addObservation(
  id: string,
  observation: string,
  actor: AuthActor,
) {
  const permit = await getPermit(id);
  if (!permit) return null;
  if (
    actor.role === "permisionario" &&
    permit.permisionarioId !== actor.id
  ) {
    throw new Error("No autorizado.");
  }
  if (!observation?.trim()) {
    throw new Error("La observación no puede estar vacía.");
  }

  await addHistoryEntry({
    permitId: id,
    userId: actor.id,
    userName: actor.name,
    action: "observation",
    observation: observation.trim(),
    after: { note: observation.trim() },
  });

  return permit;
}
