import { Router } from "express";
import type { UserRole } from "@prisma/client";
import { authenticate, requireRole } from "../middleware/auth.js";
import { listHistory } from "../store/history.js";
import { listPermits } from "../store/permits.js";
import { listReservations } from "../store/reservations.js";
import { listSpots, upsertSpot } from "../store/spots.js";
import { listSessions } from "../store/sessions.js";
import { createUser, listUsers, setPassword, updateUser } from "../store/users.js";

const router = Router();
router.use(authenticate, requireRole("admin"));

router.get("/overview", async (_req, res) => {
  const [users, permits, spots, reservations, sessions, history] =
    await Promise.all([
      listUsers(),
      listPermits(),
      listSpots(),
      listReservations(),
      listSessions(),
      listHistory({ limit: 500 }),
    ]);
  res.json({
    users: users.length,
    permits: permits.length,
    spots: spots.length,
    reservations: reservations.length,
    sessions: sessions.length,
    history: history.length,
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

export default router;
