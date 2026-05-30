import { Router } from "express";
import type { Prisma, UserRole } from "../prisma/client.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import { listHistory, logHistory } from "../store/history.js";
import { listPermits } from "../store/permits.js";
import { listReservations } from "../store/reservations.js";
import {
  createBlockSpotGrid,
  createParkingBlock,
  listParkingBlocks,
} from "../store/parkingBlocks.js";
import {
  createParkingZone,
  getParkingZone,
  listParkingZones,
  updateParkingZone,
} from "../store/parkingZones.js";
import { listSessions } from "../store/sessions.js";
import {
  deleteParkingBlockSafe,
  deleteParkingZoneForce,
  deleteParkingZoneSafe,
  getParkingZoneDeleteBlockers,
  deleteSpotForce,
  deleteSpotSafe,
} from "../store/safeDelete.js";
import {
  createSpotAtPoint,
  createSpotAtZonePoint,
  createSpotsAlongLine,
  getSpot,
  listSpots,
  listSpotsLive,
  setSpotOccupancy,
  upsertSpot,
} from "../store/spots.js";
import { getDashboardStats } from "../store/dashboardStats.js";
import {
  createUser,
  findById,
  listUsers,
  parsePaginationQuery,
  setPassword,
  updateUser,
} from "../store/users.js";
import { asList, listCount, paginationMeta } from "../lib/pagination.js";
import { cleanDatabase } from "../store/dbClean.js";
import { isDevToolsEnabled } from "../config/devTools.js";

function asJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value == null) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

const router = Router();
router.use(authenticate, requireRole("admin"));

router.get("/dashboard", async (_req, res) => {
  res.json(await getDashboardStats());
});

router.get("/overview", async (_req, res) => {
  const [usersRaw, permitsRaw, spotsRaw, reservationsRaw, sessionsRaw, historyRaw, parkingZonesRaw] =
    await Promise.all([
      listUsers(),
      listPermits(),
      listSpots(),
      listReservations(),
      listSessions(),
      listHistory({ limit: 500 }),
      listParkingZones(),
    ]);
  res.json({
    users: listCount(usersRaw),
    permits: listCount(permitsRaw),
    spots: listCount(spotsRaw),
    reservations: listCount(reservationsRaw),
    sessions: listCount(sessionsRaw),
    history: listCount(historyRaw),
    parkingZones: listCount(parkingZonesRaw),
  });
});

router.get("/users", async (req, res) => {
  const pagination = parsePaginationQuery(req.query as Record<string, unknown>);
  const role =
    typeof req.query.role === "string" ? (req.query.role as UserRole) : undefined;
  const active =
    req.query.active === "true"
      ? true
      : req.query.active === "false"
        ? false
        : undefined;
  const result = await listUsers({ role, active, pagination });
  if (Array.isArray(result)) {
    return res.json({ users: result, total: result.length, page: 1, pageSize: result.length, hasMore: false, totalPages: 1 });
  }
  res.json({ users: result.items, ...paginationMeta(result) });
});

router.post("/users", async (req, res) => {
  try {
    if (req.body?.role === "municipio") {
      return res.status(400).json({
        error:
          "La cuenta Municipio se configura solo por variables de entorno.",
      });
    }
    const user = await createUser({
      email: req.body.email,
      password: req.body.password,
      name: req.body.name,
      role: req.body.role as UserRole,
      legajo: req.body.legajo,
      zone: req.body.zone,
      parkingZoneId: req.body.parkingZoneId,
      parkingZoneIds: req.body.parkingZoneIds,
      active: req.body.active !== false,
      activationPending: req.body.active === false,
      citizen: req.body.citizen,
    });
    const actor = req.user!;
    await logHistory({
      userId: actor.id,
      userName: actor.name,
      action: "create",
      entityType: "user",
      entityId: user.id,
      entityRef: user.ref,
      entityLabel: user.name,
      after: asJson(user),
      observation: `Usuario ${user.role} creado`,
    });
    res.status(201).json({ user });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error";
    res.status(400).json({ error: message });
  }
});

router.patch("/users/:id", async (req, res) => {
  try {
    const actor = req.user!;
    const target = await findById(req.params.id);
    if (!target) {
      return res.status(404).json({ error: "Usuario no encontrado." });
    }

    if (req.body?.active === false) {
      if (actor.id === target.id) {
        return res.status(400).json({
          error: "No podés desactivar tu propia cuenta.",
        });
      }
      if (target.role === "admin") {
        return res.status(400).json({
          error: "No se puede desactivar una cuenta de administrador.",
        });
      }
    }

    const user = await updateUser(req.params.id, req.body ?? {});
    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado." });
    }
    const action =
      req.body?.active === true
        ? "activate"
        : req.body?.active === false
          ? "deactivate"
          : "update";
    await logHistory({
      userId: actor.id,
      userName: actor.name,
      action,
      entityType: "user",
      entityId: user.id,
      entityRef: user.ref,
      entityLabel: user.name,
      before: asJson({ active: target.active, name: target.name }),
      after: asJson(user),
    });
    res.json({ user });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error";
    res.status(400).json({ error: message });
  }
});

router.post("/users/:id/password", async (req, res) => {
  try {
    const user = await setPassword(req.params.id, req.body?.password);
    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado." });
    }
    res.json({ message: "Contraseña actualizada.", user });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error";
    res.status(400).json({ error: message });
  }
});

router.get("/permits", async (req, res) => {
  const pagination = parsePaginationQuery(req.query as Record<string, unknown>);
  const status =
    typeof req.query.status === "string" ? (req.query.status as import("../prisma/client.js").PermitStatus) : undefined;
  const result = await listPermits({ status, pagination });
  if (Array.isArray(result)) {
    return res.json({ permits: result, total: result.length, page: 1, pageSize: result.length, hasMore: false, totalPages: 1 });
  }
  res.json({ permits: result.items, ...paginationMeta(result) });
});

router.get("/history", async (req, res) => {
  const pagination = parsePaginationQuery(req.query as Record<string, unknown>);
  const action = typeof req.query.action === "string" ? req.query.action : undefined;
  const entityType = typeof req.query.entityType === "string" ? req.query.entityType : undefined;
  const result = await listHistory({ action, entityType, pagination });
  if (Array.isArray(result)) {
    return res.json({ history: result, total: result.length, page: 1, pageSize: result.length, hasMore: false, totalPages: 1 });
  }
  res.json({ history: result.items, ...paginationMeta(result) });
});

router.get("/reservations", async (req, res) => {
  const pagination = parsePaginationQuery(req.query as Record<string, unknown>);
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const result = await listReservations({ status, pagination });
  if (Array.isArray(result)) {
    return res.json({ reservations: result, total: result.length, page: 1, pageSize: result.length, hasMore: false, totalPages: 1 });
  }
  res.json({ reservations: result.items, ...paginationMeta(result) });
});

router.get("/spots", async (req, res) => {
  const pagination = parsePaginationQuery(req.query as Record<string, unknown>);
  const parkingZoneId =
    typeof req.query.parkingZoneId === "string" ? req.query.parkingZoneId : undefined;
  const spotType =
    req.query.spotType === "gratuita" ? "gratuita" as const : req.query.spotType === "pago" ? "pago" as const : undefined;
  const result = await listSpots({ pagination, parkingZoneId, spotType });
  if (Array.isArray(result)) {
    return res.json({ spots: result, total: result.length, page: 1, pageSize: result.length, hasMore: false, totalPages: 1 });
  }
  res.json({ spots: result.items, ...paginationMeta(result) });
});

router.post("/spots", async (req, res) => {
  try {
    const spot = await upsertSpot(req.body ?? {});
    res.status(201).json({ spot });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error";
    res.status(400).json({ error: message });
  }
});

router.patch("/spots/:id", async (req, res) => {
  try {
    const spot = await upsertSpot({ ...req.body, id: req.params.id });
    res.json({ spot });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error";
    res.status(400).json({ error: message });
  }
});

router.get("/sessions", async (req, res) => {
  const pagination = parsePaginationQuery(req.query as Record<string, unknown>);
  const result = await listSessions({
    status: typeof req.query.status === "string" ? req.query.status : undefined,
    pagination,
  });
  if (Array.isArray(result)) {
    return res.json({ sessions: result, total: result.length, page: 1, pageSize: result.length, hasMore: false, totalPages: 1 });
  }
  res.json({ sessions: result.items, ...paginationMeta(result) });
});

router.get("/parking-zones", async (req, res) => {
  const pagination = parsePaginationQuery(req.query as Record<string, unknown>);
  const enabled =
    req.query.enabled === "true"
      ? true
      : req.query.enabled === "false"
        ? false
        : undefined;
  const result = await listParkingZones({ pagination, enabled });
  if (Array.isArray(result)) {
    return res.json({ zones: result, total: result.length, page: 1, pageSize: result.length, hasMore: false, totalPages: 1 });
  }
  res.json({ zones: result.items, ...paginationMeta(result) });
});

router.get("/parking-zones/:id", async (req, res) => {
  const zone = await getParkingZone(req.params.id);
  if (!zone) {
    return res.status(404).json({ error: "Zona no encontrada." });
  }
  res.json({ zone });
});

router.post("/parking-zones", async (req, res) => {
  try {
    const zone = await createParkingZone(req.body ?? {});
    const actor = req.user!;
    await logHistory({
      userId: actor.id,
      userName: actor.name,
      action: "create",
      entityType: "zone",
      entityId: zone.id,
      entityRef: zone.ref,
      entityLabel: zone.name,
      after: asJson(zone),
    });
    res.status(201).json({ zone });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error";
    res.status(400).json({ error: message });
  }
});

router.patch("/parking-zones/:id", async (req, res) => {
  try {
    const before = await getParkingZone(req.params.id);
    const zone = await updateParkingZone(req.params.id, req.body ?? {});
    if (!zone) {
      return res.status(404).json({ error: "Zona no encontrada." });
    }
    const actor = req.user!;
    await logHistory({
      userId: actor.id,
      userName: actor.name,
      action: "update",
      entityType: "zone",
      entityId: zone.id,
      entityRef: zone.ref,
      entityLabel: zone.name,
      before: asJson(before),
      after: asJson(zone),
    });
    res.json({ zone });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error";
    res.status(400).json({ error: message });
  }
});

router.get("/parking-zones/:id/delete-check", async (req, res) => {
  const { zone, blockers } = await getParkingZoneDeleteBlockers(req.params.id);
  if (!zone) {
    return res.status(404).json({ error: "Zona no encontrada." });
  }
  res.json({ blockers, canSafeDelete: blockers.length === 0 });
});

router.delete("/parking-zones/:id", async (req, res) => {
  try {
    const before = await getParkingZone(req.params.id);
    const ok = await deleteParkingZoneForce(req.params.id);
    if (!ok) {
      return res.status(404).json({ error: "Zona no encontrada." });
    }
    const actor = req.user!;
    await logHistory({
      userId: actor.id,
      userName: actor.name,
      action: "delete",
      entityType: "zone",
      entityId: req.params.id,
      entityRef: before?.ref,
      entityLabel: before?.name,
      before: asJson(before),
    });
    res.json({ message: "Zona eliminada." });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error";
    res.status(400).json({ error: message });
  }
});

router.post("/parking-zones/:id/spots", async (req, res) => {
  try {
    const lat = Number(req.body?.lat);
    const lng = Number(req.body?.lng);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return res.status(400).json({ error: "lat y lng son obligatorios." });
    }
    const spot = await createSpotAtZonePoint({
      zoneId: req.params.id,
      lat,
      lng,
      label: req.body?.label,
      spotType: req.body?.spotType,
    });
    const actor = req.user!;
    await logHistory({
      userId: actor.id,
      userName: actor.name,
      action: "create",
      entityType: "spot",
      entityId: spot.id,
      entityRef: spot.ref,
      entityLabel: spot.label,
      after: asJson(spot),
    });
    res.status(201).json({ spot });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error";
    res.status(400).json({ error: message });
  }
});

router.post("/parking-zones/:id/spots/along-line", async (req, res) => {
  try {
    const rawPoints = req.body?.points;
    if (!Array.isArray(rawPoints) || rawPoints.length < 2) {
      return res
        .status(400)
        .json({ error: "points debe ser un array con al menos 2 vértices." });
    }
    const points = rawPoints.map((p: { lat?: unknown; lng?: unknown }) => ({
      lat: Number(p.lat),
      lng: Number(p.lng),
    }));
    if (points.some((p) => Number.isNaN(p.lat) || Number.isNaN(p.lng))) {
      return res.status(400).json({ error: "Cada punto requiere lat y lng numéricos." });
    }
    const spacingM = Number(req.body?.spacingM ?? 5);
    if (Number.isNaN(spacingM) || spacingM <= 0) {
      return res.status(400).json({ error: "spacingM debe ser un número positivo." });
    }
    const { spots, lengthM } = await createSpotsAlongLine({
      zoneId: req.params.id,
      points,
      spacingM,
      spotType: req.body?.spotType,
    });
    const actor = req.user!;
    for (const spot of spots) {
      await logHistory({
        userId: actor.id,
        userName: actor.name,
        action: "create",
        entityType: "spot",
        entityId: spot.id,
        entityRef: spot.ref,
        entityLabel: spot.label,
        after: asJson(spot),
      });
    }
    res.status(201).json({ spots, created: spots.length, lengthM, spacingM });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error";
    res.status(400).json({ error: message });
  }
});

router.get("/blocks", async (req, res) => {
  const zoneId =
    typeof req.query.zoneId === "string" ? req.query.zoneId : undefined;
  const pagination = parsePaginationQuery(req.query as Record<string, unknown>);
  const result = await listParkingBlocks({ zoneId, pagination });
  if (Array.isArray(result)) {
    return res.json({ blocks: result, total: result.length, page: 1, pageSize: result.length, hasMore: false, totalPages: 1 });
  }
  res.json({ blocks: result.items, ...paginationMeta(result) });
});

router.post("/blocks", async (req, res) => {
  try {
    const block = await createParkingBlock(req.body ?? {});
    res.status(201).json({ block });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error";
    res.status(400).json({ error: message });
  }
});

router.post("/blocks/:id/spots-grid", async (req, res) => {
  try {
    const count = await createBlockSpotGrid({
      blockId: req.params.id,
      rows: req.body?.rows,
      cols: req.body?.cols,
      prefix: req.body?.prefix,
    });
    res.status(201).json({ created: count });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error";
    res.status(400).json({ error: message });
  }
});

router.post("/blocks/:id/spots", async (req, res) => {
  try {
    const lat = Number(req.body?.lat);
    const lng = Number(req.body?.lng);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return res.status(400).json({ error: "lat y lng son obligatorios." });
    }
    const spot = await createSpotAtPoint({
      blockId: req.params.id,
      lat,
      lng,
      label: req.body?.label,
      spotType: req.body?.spotType,
    });
    res.status(201).json({ spot });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error";
    res.status(400).json({ error: message });
  }
});

router.delete("/spots/:id", async (req, res) => {
  try {
    const before = await getSpot(req.params.id);
    const force = req.query.force === "true";
    const ok = force
      ? await deleteSpotForce(req.params.id)
      : await deleteSpotSafe(req.params.id);
    if (!ok) {
      return res.status(404).json({ error: "Plaza no encontrada." });
    }
    const actor = req.user!;
    await logHistory({
      userId: actor.id,
      userName: actor.name,
      action: "delete",
      entityType: "spot",
      entityId: req.params.id,
      entityRef: before?.ref,
      entityLabel: before?.label,
      before: asJson(before),
    });
    res.json({ message: "Plaza eliminada." });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error";
    res.status(400).json({ error: message });
  }
});

router.patch("/spots/:id/occupancy", async (req, res) => {
  try {
    const spot = await setSpotOccupancy(
      req.params.id,
      req.body?.occupied !== false,
      {
        id: req.user!.id,
        role: req.user!.role,
        zone: req.user!.zone ?? null,
      },
    );
    res.json({ spot });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error";
    res.status(400).json({ error: message });
  }
});

router.delete("/blocks/:id", async (req, res) => {
  try {
    const ok = await deleteParkingBlockSafe(req.params.id);
    if (!ok) {
      return res.status(404).json({ error: "Cuadra no encontrada." });
    }
    res.json({ message: "Cuadra eliminada." });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error";
    res.status(400).json({ error: message });
  }
});

router.get("/spots/live", async (_req, res) => {
  res.json({
    spots: await listSpotsLive(),
    refreshedAt: new Date().toISOString(),
  });
});

router.post("/database/clean", async (req, res) => {
  if (!isDevToolsEnabled()) {
    return res.status(403).json({
      error: "Limpieza de datos deshabilitada (ENABLE_DEV_TOOLS=false en el servidor).",
    });
  }
  if (req.body?.confirm !== "LIMPIAR") {
    return res
      .status(400)
      .json({ error: 'Enviá { "confirm": "LIMPIAR" } para confirmar.' });
  }
  try {
    const result = await cleanDatabase();
    res.json({
      message: result.municipioPreserved
        ? "Base vaciada. La cuenta Municipalidad se conservó y se sincronizó con .env."
        : "Base vaciada. Ejecutá npm run seed o definí MUNICIPIO_EMAIL en .env.",
      result,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error";
    res.status(400).json({ error: message });
  }
});

export default router;
