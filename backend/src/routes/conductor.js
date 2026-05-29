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

router.get("/spots", (req, res) => {
  const onlyAvailable = req.query.available !== "false";
  res.json({ spots: listSpots({ onlyAvailable }) });
});

router.use(authenticate, requireRole("conductor", "admin"));

router.get("/reservations", (req, res) => {
  const filter =
    req.user.role === "admin"
      ? {}
      : { userId: req.user.id };
  res.json({ reservations: listReservations(filter) });
});

router.post("/reservations", (req, res) => {
  try {
    const reservation = createReservation(req.body ?? {}, req.user);
    res.status(201).json({ reservation });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete("/reservations/:id", (req, res) => {
  try {
    const reservation = cancelReservation(req.params.id, req.user);
    if (!reservation) {
      return res.status(404).json({ error: "Reserva no encontrada." });
    }
    res.json({ reservation });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get("/config", (_req, res) => {
  res.json({
    maxAdvanceMinutes: MAX_RESERVATION_ADVANCE_MS / 60_000,
  });
});

export default router;
