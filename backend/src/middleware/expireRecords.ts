import type { NextFunction, Request, Response } from "express";
import { expireStaleRecords } from "../services/expiry.js";

let lastRun = 0;
const INTERVAL_MS = 15_000;

export async function maybeExpireRecords(
  _req: Request,
  _res: Response,
  next: NextFunction,
) {
  const now = Date.now();
  if (now - lastRun >= INTERVAL_MS) {
    lastRun = now;
    expireStaleRecords().catch((err) => {
      console.error("[SEM] Error al caducar registros:", err);
    });
  }
  next();
}
