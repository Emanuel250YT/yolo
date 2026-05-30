import { Router } from "express";
import { isDevToolsEnabled } from "../config/devTools.js";
import {
  getGlobalDevClockState,
  setGlobalDevClock,
} from "../services/devClock.js";
import { expireAllActiveRecords } from "../services/expiry.js";
import { getLastExpiryTick } from "../services/activeExpiryJob.js";
import {
  getDevSpotSimStatus,
  startDevSpotSimulation,
  stopDevSpotSimulation,
} from "../services/devSpotSimulation.js";

const router = Router();

function requireDevTools(
  _req: import("express").Request,
  res: import("express").Response,
  next: import("express").NextFunction,
) {
  if (!isDevToolsEnabled()) {
    return res.status(404).json({ error: "DevTools deshabilitados en el servidor." });
  }
  next();
}

router.use(requireDevTools);

router.get("/clock", (_req, res) => {
  res.json({ clock: getGlobalDevClockState() });
});

router.put("/clock", async (req, res) => {
  const enabled = Boolean(req.body?.enabled);
  const iso =
    typeof req.body?.iso === "string" ? req.body.iso : null;
  setGlobalDevClock(enabled, iso);
  let expiry = null;
  try {
    expiry = await expireAllActiveRecords();
  } catch {
    /* no bloquear sync del reloj */
  }
  res.json({ clock: getGlobalDevClockState(), expiry });
});

router.get("/expiry/last", (_req, res) => {
  res.json({ last: getLastExpiryTick() });
});

router.post("/expiry/run", async (_req, res) => {
  try {
    const result = await expireAllActiveRecords();
    res.json({ result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error";
    res.status(500).json({ error: message });
  }
});

router.get("/spots/simulate", (_req, res) => {
  res.json({ status: getDevSpotSimStatus() });
});

router.post("/spots/simulate/start", async (req, res) => {
  try {
    const zoneCode = typeof req.body?.zoneCode === "string" ? req.body.zoneCode : "";
    const count = Number(req.body?.count ?? req.body?.targetCount ?? 5);
    const status = await startDevSpotSimulation({ zoneCode, targetCount: count });
    res.json({ status });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error";
    res.status(400).json({ error: message });
  }
});

router.post("/spots/simulate/stop", async (_req, res) => {
  try {
    const status = await stopDevSpotSimulation();
    res.json({ status });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error";
    res.status(400).json({ error: message });
  }
});

export default router;
