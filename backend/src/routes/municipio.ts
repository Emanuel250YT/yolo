import { Router } from "express";
import type { Prisma, UserRole } from "../prisma/client.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import { getDashboardStats } from "../store/dashboardStats.js";
import { logHistory } from "../store/history.js";
import {
  deleteParkingZoneForce,
  deleteParkingZoneSafe,
  getParkingZoneDeleteBlockers,
  deleteSpotForce,
  deleteSpotSafe,
} from "../store/safeDelete.js";
import { updateTariffs } from "../store/tariffs.js";
import {
  createParkingZone,
  getParkingZone,
  listParkingZones,
  updateParkingZone,
} from "../store/parkingZones.js";
import {
  createSpotAtZonePoint,
  createSpotsAlongLine,
  getSpot,
  listSpotsLive,
  upsertSpot,
} from "../store/spots.js";
import { createUser, findById, listUsers, updateUser } from "../store/users.js";

function asJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value == null) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

const router = Router();
router.use(authenticate, requireRole("municipio"));

router.get("/dashboard", async (_req, res) => {
  res.json(await getDashboardStats());
});

router.get("/parking-zones", async (_req, res) => {
  res.json({ zones: await listParkingZones() });
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
    res.status(201).json({ zone });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error";
    res.status(400).json({ error: message });
  }
});

router.patch("/parking-zones/:id", async (req, res) => {
  try {
    const zone = await updateParkingZone(req.params.id, req.body ?? {});
    if (!zone) {
      return res.status(404).json({ error: "Zona no encontrada." });
    }
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
    const ok = await deleteParkingZoneForce(req.params.id);
    if (!ok) {
      return res.status(404).json({ error: "Zona no encontrada." });
    }
    res.json({ message: "Zona eliminada." });
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

router.patch("/spots/:id", async (req, res) => {
  try {
    const before = await getSpot(req.params.id);
    const spot = await upsertSpot({ ...req.body, id: req.params.id });
    const actor = req.user!;
    await logHistory({
      userId: actor.id,
      userName: actor.name,
      action: "update",
      entityType: "spot",
      entityId: spot.id,
      entityRef: spot.ref,
      entityLabel: spot.label,
      before: asJson(before),
      after: asJson(spot),
    });
    res.json({ spot });
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

router.get("/users", async (req, res) => {
  const pending = req.query.pending === "true";
  const users = await listUsers(
    pending ? { activationPending: true } : {},
  );
  res.json({
    users: users.filter((u) => u.role !== "municipio"),
  });
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
      active: req.body.active !== false,
      activationPending: req.body.active === false,
      createdByMunicipio: true,
      citizen: req.body.citizen,
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
    if (target.role === "municipio") {
      return res.status(400).json({
        error: "No se puede modificar la cuenta Municipio.",
      });
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
    res.json({ user });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error";
    res.status(400).json({ error: message });
  }
});

router.patch("/users/:id/activate", async (req, res) => {
  try {
    const user = await updateUser(req.params.id, {
      active: true,
      activationPending: false,
    });
    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado." });
    }
    res.json({
      user,
      message: "Cuenta habilitada. Ya puede iniciar sesión.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error";
    res.status(400).json({ error: message });
  }
});

router.patch("/users/:id/deactivate", async (req, res) => {
  try {
    const actor = req.user!;
    if (actor.id === req.params.id) {
      return res.status(400).json({
        error: "No podés desactivar tu propia cuenta.",
      });
    }
    const users = await listUsers();
    const target = users.find((u) => u.id === req.params.id);
    if (target?.role === "municipio") {
      return res.status(400).json({
        error: "No se puede desactivar la cuenta Municipio.",
      });
    }
    const user = await updateUser(req.params.id, { active: false });
    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado." });
    }
    res.json({ user });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error";
    res.status(400).json({ error: message });
  }
});

router.patch("/tariffs", async (req, res) => {
  try {
    const body = req.body ?? {};
    const patch: Record<string, number> = {};
    for (const key of [
      "autoPerHour",
      "motorcyclePerHour",
      "toleranceMinutes",
      "fractionMinutes",
      "fractionFromHour",
    ] as const) {
      if (body[key] != null) patch[key] = Number(body[key]);
    }
    if (body.digitalDiscountRate != null) {
      patch.digitalDiscountRate = Number(body.digitalDiscountRate);
    }
    const tariffs = await updateTariffs(patch);
    res.json({ tariffs, message: "Tarifas actualizadas." });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error";
    res.status(400).json({ error: message });
  }
});

export default router;
