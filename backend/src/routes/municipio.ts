import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth.js";
import { registerStaffByMunicipio } from "../services/registration.js";
import { getDashboardStats } from "../store/dashboardStats.js";
import { deleteParkingZoneForce, deleteParkingZoneSafe, getParkingZoneDeleteBlockers } from "../store/safeDelete.js";
import { updateTariffs } from "../store/tariffs.js";
import {
  createParkingZone,
  getParkingZone,
  listParkingZones,
  updateParkingZone,
} from "../store/parkingZones.js";
import { listUsers, updateUser } from "../store/users.js";

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
    const result = await registerStaffByMunicipio(req.body ?? {});
    res.status(201).json(result);
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
