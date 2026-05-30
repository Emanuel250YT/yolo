import { Router } from "express";
import type { UserRole } from "@prisma/client";
import { authenticate, requireRole } from "../middleware/auth.js";
import { listHistory } from "../store/history.js";
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
  setPassword,
  updateUser,
} from "../store/users.js";

const router = Router();
router.use(authenticate, requireRole("admin"));

router.get("/dashboard", async (_req, res) => {
  res.json(await getDashboardStats());
});

router.get("/overview", async (_req, res) => {
  const [users, permits, spots, reservations, sessions, history, parkingZones] =
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
    users: users.length,
    permits: permits.length,
    spots: spots.length,
    reservations: reservations.length,
    sessions: sessions.length,
    history: history.length,
    parkingZones: parkingZones.length,
  });
});

router.get("/users", async (_req, res) => {
  res.json({ users: await listUsers() });
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
      active: req.body.active !== false,
      activationPending: req.body.active === false,
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

router.get("/permits", async (_req, res) => {
  res.json({ permits: await listPermits() });
});

router.get("/history", async (req, res) => {
  const limit = Number(req.query.limit) || 200;
  res.json({ history: await listHistory({ limit }) });
});

router.get("/reservations", async (_req, res) => {
  res.json({ reservations: await listReservations() });
});

router.get("/spots", async (_req, res) => {
  res.json({ spots: await listSpots() });
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

router.get("/sessions", async (_req, res) => {
  res.json({ sessions: await listSessions() });
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
    });
    res.status(201).json({ spot });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error";
    res.status(400).json({ error: message });
  }
});

router.get("/blocks", async (req, res) => {
  const zoneId =
    typeof req.query.zoneId === "string" ? req.query.zoneId : undefined;
  res.json({ blocks: await listParkingBlocks({ zoneId }) });
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
    });
    res.status(201).json({ spot });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error";
    res.status(400).json({ error: message });
  }
});

router.delete("/spots/:id", async (req, res) => {
  try {
    const force = req.query.force === "true";
    const ok = force
      ? await deleteSpotForce(req.params.id)
      : await deleteSpotSafe(req.params.id);
    if (!ok) {
      return res.status(404).json({ error: "Plaza no encontrada." });
    }
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

export default router;
