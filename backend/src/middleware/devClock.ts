import type { NextFunction, Request, Response } from "express";
import { isDevToolsEnabled } from "../config/devTools.js";
import { parseDevTimeHeader, runWithDevClock } from "../services/devClock.js";

export function devClockMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  if (!isDevToolsEnabled()) {
    next();
    return;
  }

  const simulated = parseDevTimeHeader(req.header("X-Dev-Time"));
  if (!simulated) {
    next();
    return;
  }

  runWithDevClock(simulated, () => next());
}
