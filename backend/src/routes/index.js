import { Router } from "express";
import { SHIFTS, TARIFFS } from "../config/tariffs.js";
import { calculateAmount } from "../services/pricing.js";
import { getShiftStatus } from "../services/shifts.js";
import {
  checkoutSession,
  createSession,
  getSession,
  listSessions,
} from "../store/sessions.js";

const router = Router();

router.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "sem-backend", version: "0.1.0" });
});

router.get("/tariffs", (_req, res) => {
  res.json({ tariffs: TARIFFS, shifts: SHIFTS });
});

router.get("/shifts/status", (_req, res) => {
  res.json(getShiftStatus());
});

router.post("/quote", (req, res) => {
  const { vehicleType, minutes, digitalPayment, plate } = req.body ?? {};

  if (minutes == null || Number.isNaN(Number(minutes))) {
    return res.status(400).json({ error: "minutes es obligatorio (número)." });
  }

  const quote = calculateAmount({
    vehicleType: vehicleType === "motorcycle" ? "motorcycle" : "auto",
    minutes: Number(minutes),
    digitalPayment: Boolean(digitalPayment),
  });

  res.json({
    plate: plate ?? null,
    vehicleType: vehicleType === "motorcycle" ? "motorcycle" : "auto",
    minutes: Number(minutes),
    ...quote,
  });
});

router.get("/sessions", (_req, res) => {
  const status = _req.query.status;
  res.json({ sessions: listSessions({ status: status || undefined }) });
});

router.post("/sessions", (req, res) => {
  try {
    const session = createSession(req.body ?? {});
    res.status(201).json({ session });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get("/sessions/:id", (req, res) => {
  const session = getSession(req.params.id);
  if (!session) return res.status(404).json({ error: "Sesión no encontrada." });
  res.json({ session });
});

router.post("/sessions/:id/checkout", (req, res) => {
  try {
    const session = checkoutSession(req.params.id, req.body ?? {});
    if (!session) {
      return res.status(404).json({ error: "Sesión no encontrada." });
    }
    res.json({ session });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
