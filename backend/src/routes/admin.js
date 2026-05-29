import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth.js";
import { listHistory } from "../store/history.js";
import { listPermits } from "../store/permits.js";
import { listReservations } from "../store/reservations.js";
import { listSpots, upsertSpot } from "../store/spots.js";
import { listSessions } from "../store/sessions.js";
import {
  createUser,
  listUsers,
  sanitizeUser,
  setPassword,
  updateUser,
} from "../store/users.js";

const router = Router();
router.use(authenticate, requireRole("admin"));

router.get("/overview", (_req, res) => {
  res.json({
    users: listUsers().length,
    permits: listPermits().length,
    spots: listSpots().length,
    reservations: listReservations().length,
    sessions: listSessions().length,
    history: listHistory({ limit: 500 }).length,
  });
});

router.get("/users", (_req, res) => {
  res.json({ users: listUsers() });
});

router.post("/users", async (req, res) => {
  try {
    if (req.body?.role === "municipio") {
      return res.status(400).json({
        error: "La cuenta Municipio se configura solo por variables de entorno.",
      });
    }
    const active = req.user.role === "municipio" ? req.body?.active !== false : true;
    const user = await createUser({
      ...req.body,
      active,
      activationPending: !active,
      createdByMunicipio: req.user.role === "municipio",
    });
    res.status(201).json({ user: sanitizeUser(user) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.patch("/users/:id", async (req, res) => {
  try {
    const user = updateUser(req.params.id, req.body ?? {});
    if (!user) return res.status(404).json({ error: "Usuario no encontrado." });
    res.json({ user });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/users/:id/password", async (req, res) => {
  try {
    const user = await setPassword(req.params.id, req.body?.password);
    if (!user) return res.status(404).json({ error: "Usuario no encontrado." });
    res.json({ message: "Contraseña actualizada.", user });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get("/permits", (_req, res) => {
  res.json({ permits: listPermits() });
});

router.get("/history", (req, res) => {
  const limit = Number(req.query.limit) || 200;
  res.json({ history: listHistory({ limit }) });
});

router.get("/reservations", (_req, res) => {
  res.json({ reservations: listReservations() });
});

router.get("/spots", (_req, res) => {
  res.json({ spots: listSpots() });
});

router.post("/spots", (req, res) => {
  try {
    const spot = upsertSpot(req.body ?? {});
    res.status(201).json({ spot });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.patch("/spots/:id", (req, res) => {
  const spot = upsertSpot({ ...req.body, id: req.params.id });
  if (!spot) return res.status(404).json({ error: "Lugar no encontrado." });
  res.json({ spot });
});

router.get("/sessions", (_req, res) => {
  res.json({ sessions: listSessions() });
});

export default router;
