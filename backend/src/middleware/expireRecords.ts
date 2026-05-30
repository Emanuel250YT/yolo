import type { NextFunction, Request, Response } from "express";
import { expireAllActiveRecords } from "../services/expiry.js";

let lastRun = 0;
const INTERVAL_MS = 60_000;

/** Refuerzo en requests; el job principal corre cada minuto en background. */
export async function maybeExpireRecords(
  _req: Request,
  _res: Response,
  next: NextFunction,
) {
  const now = Date.now();
  if (now - lastRun >= INTERVAL_MS) {
    lastRun = now;
    expireAllActiveRecords().catch((err) => {
      console.error("[SEM] Error al caducar registros:", err);
    });
  }
  next();
}
