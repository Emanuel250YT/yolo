import { Router } from "express";
import { isDevToolsEnabled } from "../config/devTools.js";
import { getLastExpiryTick } from "../services/activeExpiryJob.js";
import {
  getGlobalDevClockState,
  setGlobalDevClock,
} from "../services/devClock.js";
import { expireAllActiveRecords } from "../services/expiry.js";

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

router.put("/clock", (req, res) => {
  const enabled = Boolean(req.body?.enabled);
  const iso =
    typeof req.body?.iso === "string" ? req.body.iso : null;
  setGlobalDevClock(enabled, iso);
  res.json({ clock: getGlobalDevClockState() });
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

export default router;
