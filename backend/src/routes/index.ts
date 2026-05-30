import { Router } from "express";
import { SHIFTS } from "../config/tariffs.js";
import { authenticate, optionalAuth, requireRole } from "../middleware/auth.js";
import { calculateAmount } from "../services/pricing.js";
import { getShiftStatusWithDevOverride } from "../services/devShiftOverride.js";
import { getTariffs } from "../store/tariffs.js";
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
import paymentsRoutes from "./payments.js";
import { listParkingZones } from "../store/parkingZones.js";
import {
  paginationMeta,
  parsePaginationQuery,
} from "../lib/pagination.js";

const router = Router();

router.use("/auth", authRoutes);
router.use("/municipio", municipioRoutes);
router.use("/admin", adminRoutes);
router.use("/permisionario", permisionarioRoutes);
router.use("/payments", paymentsRoutes);
router.use("/conductor", conductorRoutes);

router.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "sem-backend", version: "0.3.0" });
});

router.get("/tariffs", async (_req, res) => {
  const tariffs = await getTariffs();
  res.json({ tariffs, shifts: SHIFTS });
});

router.get("/shifts/status", (req, res) => {
  const override = req.header("X-Dev-Shift") ?? undefined;
  res.json(getShiftStatusWithDevOverride(override));
});

router.get("/parking-zones", async (req, res) => {
  const pagination = parsePaginationQuery(req.query as Record<string, unknown>);
  const result = await listParkingZones({ enabledOnly: true, pagination });
  if (Array.isArray(result)) {
    return res.json({ zones: result, total: result.length, page: 1, pageSize: result.length, hasMore: false, totalPages: 1 });
  }
  res.json({ zones: result.items, ...paginationMeta(result) });
});

router.post("/quote", optionalAuth, async (req, res) => {
  const { vehicleType, minutes, digitalPayment, plate } = req.body ?? {};
  if (minutes == null || Number.isNaN(Number(minutes))) {
    return res.status(400).json({ error: "minutes es obligatorio (número)." });
  }
  const tariffs = await getTariffs();
  const quote = calculateAmount({
    vehicleType: vehicleType === "motorcycle" ? "motorcycle" : "auto",
    minutes: Number(minutes),
    digitalPayment: Boolean(digitalPayment),
    tariffs,
  });
  res.json({
    plate: plate ?? null,
    vehicleType: vehicleType === "motorcycle" ? "motorcycle" : "auto",
    minutes: Number(minutes),
    ...quote,
  });
});

router.get("/sessions", authenticate, async (req, res) => {
  const pagination = parsePaginationQuery(req.query as Record<string, unknown>);
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const result = await listSessions({ status, pagination });

  let sessions = Array.isArray(result) ? result : result.items;
  if (req.user!.role === "permisionario") {
    sessions = sessions.filter(
      (s) => !s.permitId || s.zone === req.user!.zone,
    );
  }

  if (Array.isArray(result)) {
    return res.json({ sessions, total: sessions.length, page: 1, pageSize: sessions.length, hasMore: false, totalPages: 1 });
  }
  res.json({ sessions, ...paginationMeta({ ...result, items: sessions }) });
});

router.post(
  "/sessions",
  authenticate,
  requireRole("admin", "permisionario", "municipio"),
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
  requireRole("admin", "permisionario", "municipio"),
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
