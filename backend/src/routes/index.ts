import { Router } from "express";
import { SHIFTS, TARIFFS } from "../config/tariffs.js";
import { authenticate, optionalAuth, requireRole } from "../middleware/auth.js";
import { calculateAmount } from "../services/pricing.js";
import { getShiftStatus } from "../services/shifts.js";
import {
  checkoutSession,
  createSession,
  getSession,
  listSessions,
} from "../store/sessions.js";
import adminRoutes from "./admin.js";
import authRoutes from "./auth.js";
import conductorRoutes from "./conductor.js";
import municipioRoutes from "./municipio.js";
import permisionarioRoutes from "./permisionario.js";

const router = Router();

router.use("/auth", authRoutes);
router.use("/municipio", municipioRoutes);
router.use("/admin", adminRoutes);
router.use("/permisionario", permisionarioRoutes);
router.use("/conductor", conductorRoutes);

router.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "sem-backend", version: "0.3.0" });
});

router.get("/tariffs", (_req, res) => {
  res.json({ tariffs: TARIFFS, shifts: SHIFTS });
});

router.get("/shifts/status", (_req, res) => {
  res.json(getShiftStatus());
});

router.post("/quote", optionalAuth, (req, res) => {
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

router.get("/sessions", authenticate, async (req, res) => {
  let sessions = await listSessions({
    status: typeof req.query.status === "string" ? req.query.status : undefined,
  });
  if (req.user!.role === "permisionario") {
    sessions = sessions.filter(
      (s) => !s.permitId || s.zone === req.user!.zone,
    );
  }
  res.json({ sessions });
});

router.post(
  "/sessions",
  authenticate,
  requireRole("admin", "permisionario"),
  async (req, res) => {
    try {
      const session = await createSession({
        ...req.body,
        permitId: req.body?.permitId,
        createdById: req.user!.id,
      });
      res.status(201).json({ session });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error";
      res.status(400).json({ error: message });
    }
  },
);

router.get("/sessions/:id", authenticate, async (req, res) => {
  const session = await getSession(String(req.params.id));
  if (!session) {
    return res.status(404).json({ error: "Sesión no encontrada." });
  }
  res.json({ session });
});

router.post(
  "/sessions/:id/checkout",
  authenticate,
  requireRole("admin", "permisionario"),
  async (req, res) => {
    try {
      const session = await checkoutSession(String(req.params.id), req.body ?? {});
      if (!session) {
        return res.status(404).json({ error: "Sesión no encontrada." });
      }
      res.json({ session });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error";
      res.status(400).json({ error: message });
    }
  },
);

export default router;
