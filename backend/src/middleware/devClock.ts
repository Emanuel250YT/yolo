import type { NextFunction, Request, Response } from "express";
import { isDevToolsEnabled } from "../config/devTools.js";
import { parseDevTimeHeader, runWithDevClock, setGlobalDevClock } from "../services/devClock.js";

export function devClockMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  if (!isDevToolsEnabled()) {
    next();
    return;
  }

  const clockMode = req.header("X-Dev-Clock");
  if (clockMode === "off" || clockMode === "disabled") {
    setGlobalDevClock(false, null);
    next();
    return;
  }

  const simulated = parseDevTimeHeader(req.header("X-Dev-Time"));
  if (simulated) {
    setGlobalDevClock(true, simulated.toISOString());
    runWithDevClock(simulated, () => next());
    return;
  }

  next();
}
