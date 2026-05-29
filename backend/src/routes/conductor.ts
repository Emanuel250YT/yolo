import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth.js";
import { MAX_RESERVATION_ADVANCE_MS } from "../config/auth.js";
import {
  cancelReservation,
  createReservation,
  listReservations,
} from "../store/reservations.js";
import { listSpots } from "../store/spots.js";

const router = Router();

router.get("/spots", async (req, res) => {
  const onlyAvailable = req.query.available !== "false";
  res.json({ spots: await listSpots({ onlyAvailable }) });
});

router.use(authenticate, requireRole("conductor", "admin"));

router.get("/reservations", async (req, res) => {
  const filter =
    req.user!.role === "admin" ? {} : { userId: req.user!.id };
  res.json({ reservations: await listReservations(filter) });
});

router.post("/reservations", async (req, res) => {
  try {
    const reservation = await createReservation(req.body ?? {}, req.user!);
    res.status(201).json({ reservation });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error";
    res.status(400).json({ error: message });
  }
});

router.delete("/reservations/:id", async (req, res) => {
  try {
    const reservation = await cancelReservation(req.params.id, req.user!);
    if (!reservation) {
      return res.status(404).json({ error: "Reserva no encontrada." });
    }
    res.json({ reservation });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error";
    res.status(400).json({ error: message });
  }
});

router.get("/config", (_req, res) => {
  res.json({
    maxAdvanceMinutes: MAX_RESERVATION_ADVANCE_MS / 60_000,
  });
});

export default router;
