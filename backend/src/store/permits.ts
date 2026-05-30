import type { PaymentMethod, PermitStatus, Prisma, VehicleType } from "../prisma/client.js";
import {
  paginatedResult,
  type PaginatedResult,
  type PaginationParams,
} from "../lib/pagination.js";
import { prisma } from "../lib/prisma.js";
import { generateUniqueRef } from "../lib/shortRef.js";
import { calculateAmount } from "../services/pricing.js";
import { getNowMs } from "../services/devClock.js";
import { expireStalePermits } from "../services/expiry.js";
import type { AuthActor } from "../types/api.js";
import { getTariffs } from "./tariffs.js";
import { addHistoryEntry } from "./history.js";
import { createPaymentOrder } from "./paymentOrders.js";
import { isMercadoPagoLinked } from "./mercadopago.js";
import { occupySpotForPermit, resolvePermitSpot, adjustOccupancy } from "./spots.js";

const PERMIT_ROLES = new Set(["admin", "permisionario", "municipio"]);

const permitInclude = {
  permisionario: { select: { ref: true } },
  spot: { select: { id: true, label: true, ref: true } },
} as const;

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
  spotId: string | null;
  spot?: { id: string; label: string; ref: string | null } | null;
  locationLat: number | null;
  locationLng: number | null;
  status: PermitStatus;
  graceUntil: Date | null;
  startAt: Date;
  endAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  const {
    permisionario,
    spot,
    startAt,
    endAt,
    paidAt,
    graceUntil,
    createdAt,
    updatedAt,
    ...rest
  } = p;
  return {
    ...rest,
    permisionarioRef: permisionario?.ref ?? null,
    spotLabel: spot?.label ?? null,
    startAt: startAt.toISOString(),
    endAt: endAt?.toISOString() ?? null,
    graceUntil: graceUntil?.toISOString() ?? null,
    paidAt: paidAt?.toISOString() ?? null,
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
  };
}

function permitSearchWhere(q?: string): Prisma.PermitWhereInput | undefined {
  if (!q) return undefined;
  return {
    OR: [
      { plate: { contains: q, mode: "insensitive" } },
      { zone: { contains: q, mode: "insensitive" } },
      { permisionarioName: { contains: q, mode: "insensitive" } },
      { ref: { contains: q, mode: "insensitive" } },
    ],
  };
}

export async function listPermits(opts: {
  permisionarioId?: string;
  plates?: string[];
  status?: PermitStatus;
  pagination?: PaginationParams;
} = {}): Promise<PaginatedResult<ReturnType<typeof mapPermit>> | ReturnType<typeof mapPermit>[]> {
  await expireStalePermits();
  const where: Prisma.PermitWhereInput = {
    ...(opts.permisionarioId ? { permisionarioId: opts.permisionarioId } : {}),
    ...(opts.plates?.length ? { plate: { in: opts.plates } } : {}),
    ...(opts.status ? { status: opts.status } : {}),
    ...(opts.pagination?.q ? permitSearchWhere(opts.pagination.q) : {}),
  };

  if (!opts.pagination) {
    const permits = await prisma.permit.findMany({
      where,
      include: permitInclude,
      orderBy: { createdAt: "desc" },
    });
    return permits.map(mapPermit);
  }

  const [total, permits] = await Promise.all([
    prisma.permit.count({ where }),
    prisma.permit.findMany({
      where,
      include: permitInclude,
      orderBy: { createdAt: "desc" },
      skip: opts.pagination.skip,
      take: opts.pagination.take,
    }),
  ]);
  return paginatedResult(permits.map(mapPermit), total, opts.pagination);
}

function controlDeadlineMs(p: {
  status: string;
  endAt: Date | null;
  graceUntil: Date | null;
}) {
  if (p.status === "grace" && p.graceUntil) {
    return p.graceUntil.getTime();
  }
  return p.endAt?.getTime() ?? Number.POSITIVE_INFINITY;
}

/** Permisos activos o en tolerancia, del más próximo a vencer al que más le queda. */
export async function listControlPermits(actor: AuthActor) {
  await expireStalePermits();
  const where: Prisma.PermitWhereInput = {
    status: { in: ["active", "grace"] },
    ...(actor.role === "permisionario"
      ? { permisionarioId: actor.id }
      : {}),
  };
  const permits = await prisma.permit.findMany({
    where,
    include: permitInclude,
  });
  permits.sort((a, b) => controlDeadlineMs(a) - controlDeadlineMs(b));
  return permits.map(mapPermit);
}

export async function getPermit(id: string) {
  await expireStalePermits();
  const p = await prisma.permit.findUnique({
    where: { id },
    include: permitInclude,
  });
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
    spotId?: string;
    lat?: number;
    lng?: number;
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

  const startAt = input.startAt ? new Date(input.startAt) : new Date();
  const endAt = input.endAt
    ? new Date(input.endAt)
    : new Date(startAt.getTime() + durationMinutes * 60_000);

  const zone = input.zone?.trim() || actor.zone || "microcentro";

  const locationLat =
    input.lat != null && Number.isFinite(Number(input.lat))
      ? Number(input.lat)
      : null;
  const locationLng =
    input.lng != null && Number.isFinite(Number(input.lng))
      ? Number(input.lng)
      : null;

  const resolvedSpot = await resolvePermitSpot({
    zoneCode: zone,
    spotId: input.spotId,
    lat: locationLat,
    lng: locationLng,
  });

  const isFreeSpot = resolvedSpot.spotType === "gratuita";
  if (isFreeSpot && paymentMethod === "mercadopago") {
    throw new Error(
      "Las plazas gratuitas solo se registran en efectivo ($0).",
    );
  }

  const pricing = calculateAmount({
    vehicleType,
    minutes: durationMinutes,
    digitalPayment: paymentMethod === "mercadopago",
    tariffs,
    free: isFreeSpot,
  });

  const permit = await prisma.permit.create({
    data: {
      ref: await generateUniqueRef("permit"),
      permisionarioId: actor.id,
      permisionarioName: actor.name,
      permisionarioLegajo: actor.legajo ?? null,
      plate: input.plate.trim().toUpperCase(),
      zone,
      vehicleType,
      notes: input.notes?.trim() || null,
      durationMinutes,
      pricing,
      paymentMethod,
      paidAt: paymentMethod === "cash" ? new Date() : null,
      spotId: resolvedSpot.id,
      locationLat,
      locationLng,
      startAt,
      endAt,
    },
    include: permitInclude,
  });

  const mapped = mapPermit(permit);

  if (paymentMethod === "cash") {
    await occupySpotForPermit(resolvedSpot.id, {
      id: actor.id,
      role: actor.role,
      zone: actor.zone ?? null,
    });
  }

  if (paymentMethod === "mercadopago") {
    const permisionario = await prisma.user.findUnique({
      where: { id: actor.id },
    });
    if (!permisionario || !isMercadoPagoLinked(permisionario)) {
      throw new Error("Vinculá Mercado Pago en Mi cuenta antes de cobrar digitalmente.");
    }

    const payment = await createPaymentOrder({
      kind: "permit",
      entityId: permit.id,
      permisionarioId: actor.id,
      title: `Permiso SEM · ${permit.plate}`,
      description: `Estacionamiento ${permit.zone} · ${durationMinutes} min`,
      amount: pricing.net,
      metadata: {
        plate: permit.plate,
        zone: permit.zone,
        permitRef: permit.ref,
      },
    });

    await addHistoryEntry({
      permitId: permit.id,
      userId: actor.id,
      userName: actor.name,
      action: "create",
      entityRef: permit.ref,
      entityLabel: permit.plate,
      after: JSON.parse(JSON.stringify(mapped)) as Prisma.InputJsonValue,
      observation: `Permiso creado · pago MP pendiente · $${pricing.net} · orden ${payment.orderId} · plaza ${resolvedSpot.label}`,
    });

    return { permit: mapped, payment };
  }

  await addHistoryEntry({
    permitId: permit.id,
    userId: actor.id,
    userName: actor.name,
    action: "create",
    entityRef: permit.ref,
    entityLabel: permit.plate,
    after: JSON.parse(JSON.stringify(mapped)) as Prisma.InputJsonValue,
    observation: `Pago ${paymentMethod === "cash" ? "en efectivo" : "MercadoPago"} · $${pricing.net} · plaza ${resolvedSpot.label}`,
  });

  return { permit: mapped };
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
  if (patch.status !== undefined) {
    data.status = patch.status;
    if (
      (patch.status === "completed" || patch.status === "cancelled") &&
      patch.status !== existing.status
    ) {
      data.graceUntil = null;
      if (existing.spotId) {
        await adjustOccupancy(existing.spotId, -1);
      }
    }
  }
  if (patch.endAt !== undefined) {
    data.endAt = patch.endAt ? new Date(String(patch.endAt)) : null;
  }

  const permit = await prisma.permit.update({
    where: { id },
    data,
    include: permitInclude,
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

async function assertPermitAccess(
  permit: { permisionarioId: string },
  actor: AuthActor,
) {
  if (
    actor.role === "permisionario" &&
    permit.permisionarioId !== actor.id
  ) {
    throw new Error("No autorizado.");
  }
}

export async function completePermitCheckout(id: string, actor: AuthActor) {
  await expireStalePermits();
  const existing = await prisma.permit.findUnique({
    where: { id },
    include: permitInclude,
  });
  if (!existing) return null;

  await assertPermitAccess(existing, actor);

  if (existing.status !== "active" && existing.status !== "grace") {
    throw new Error("Solo se puede cerrar un permiso activo o en tolerancia.");
  }

  const before = mapPermit(existing);
  const permit = await prisma.permit.update({
    where: { id },
    data: { status: "completed", graceUntil: null },
    include: permitInclude,
  });

  if (existing.spotId) {
    await adjustOccupancy(existing.spotId, -1);
  }

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
    observation: "Vehículo retirado · plaza liberada",
  });

  return mapped;
}

export async function extendPermitSession(
  id: string,
  input: { durationMinutes?: number; hours?: number },
  actor: AuthActor,
) {
  await expireStalePermits();
  const existing = await prisma.permit.findUnique({
    where: { id },
    include: permitInclude,
  });
  if (!existing) return null;

  await assertPermitAccess(existing, actor);

  if (existing.status !== "grace") {
    throw new Error(
      "Solo podés extender durante los 15 minutos posteriores al vencimiento.",
    );
  }

  if (existing.graceUntil && existing.graceUntil.getTime() <= getNowMs()) {
    throw new Error("Venció el plazo de tolerancia para extender.");
  }

  const spotRecord = existing.spotId
    ? await prisma.spot.findUnique({
        where: { id: existing.spotId },
        select: { spotType: true },
      })
    : null;

  const durationMinutes =
    input.durationMinutes != null
      ? Number(input.durationMinutes)
      : input.hours != null
        ? Number(input.hours) * 60
        : 60;

  if (!Number.isFinite(durationMinutes) || durationMinutes < 15) {
    throw new Error("Indicá una duración válida (mínimo 15 minutos).");
  }

  const isFreeSpot = spotRecord?.spotType === "gratuita";
  const tariffs = await getTariffs();
  const extensionPricing = calculateAmount({
    vehicleType: existing.vehicleType,
    minutes: durationMinutes,
    digitalPayment: true,
    tariffs,
    free: isFreeSpot,
  });

  const newEndAt = new Date(getNowMs() + durationMinutes * 60_000);
  const before = mapPermit(existing);

  const permit = await prisma.permit.update({
    where: { id },
    data: {
      status: "active",
      endAt: newEndAt,
      graceUntil: null,
      durationMinutes: existing.durationMinutes + durationMinutes,
    },
    include: permitInclude,
  });

  const mapped = mapPermit(permit);
  let payment: Awaited<ReturnType<typeof createPaymentOrder>> | undefined;

  if (extensionPricing.net > 0) {
    const permisionario = await prisma.user.findUnique({
      where: { id: actor.id },
    });
    if (!permisionario || !isMercadoPagoLinked(permisionario)) {
      throw new Error(
        "Vinculá Mercado Pago en Mi cuenta para registrar extensiones con cobro digital.",
      );
    }

    payment = await createPaymentOrder({
      kind: "permit",
      entityId: permit.id,
      permisionarioId: actor.id,
      title: `Extensión SEM · ${permit.plate}`,
      description: `Estacionamiento ${permit.zone} · +${durationMinutes} min`,
      amount: extensionPricing.net,
      metadata: {
        extension: true,
        durationMinutes,
        plate: permit.plate,
        zone: permit.zone,
        permitRef: permit.ref,
      },
    });
  }

  await addHistoryEntry({
    permitId: id,
    userId: actor.id,
    userName: actor.name,
    action: "update",
    entityRef: permit.ref,
    entityLabel: permit.plate,
    before: JSON.parse(JSON.stringify(before)) as Prisma.InputJsonValue,
    after: JSON.parse(JSON.stringify(mapped)) as Prisma.InputJsonValue,
    observation: payment
      ? `Sesión extendida +${durationMinutes} min · pago pendiente · orden ${payment.orderId}`
      : `Sesión extendida +${durationMinutes} min · sin cargo`,
  });

  return { permit: mapped, payment };
}
