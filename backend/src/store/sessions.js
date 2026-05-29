import { randomUUID } from "crypto";
import { calculateAmount } from "../services/pricing.js";

/** @type {Map<string, object>} */
const sessions = new Map();

export function createSession({
  plate,
  vehicleType = "auto",
  zone = "microcentro",
  digitalPayment = false,
  permitId = null,
}) {
  if (!plate?.trim()) {
    throw new Error("La patente es obligatoria.");
  }

  const id = randomUUID();
  const session = {
    id,
    plate: plate.trim().toUpperCase(),
    vehicleType: vehicleType === "motorcycle" ? "motorcycle" : "auto",
    zone,
    digitalPayment: Boolean(digitalPayment),
    permitId,
    status: "active",
    startedAt: new Date().toISOString(),
    endedAt: null,
    checkout: null,
  };
  sessions.set(id, session);
  return session;
}

export function listSessions({ status } = {}) {
  const all = [...sessions.values()].sort(
    (a, b) => new Date(b.startedAt) - new Date(a.startedAt),
  );
  if (!status) return all;
  return all.filter((s) => s.status === status);
}

export function getSession(id) {
  return sessions.get(id) ?? null;
}

export function checkoutSession(id, { digitalPayment } = {}) {
  const session = sessions.get(id);
  if (!session) return null;
  if (session.status !== "active") {
    throw new Error("La sesión ya fue finalizada.");
  }

  const endedAt = new Date();
  const started = new Date(session.startedAt);
  const minutes = Math.max(
    0,
    Math.round((endedAt - started) / 60000),
  );

  const useDigital =
    digitalPayment !== undefined ? Boolean(digitalPayment) : session.digitalPayment;

  const pricing = calculateAmount({
    vehicleType: session.vehicleType,
    minutes,
    digitalPayment: useDigital,
  });

  session.status = "completed";
  session.endedAt = endedAt.toISOString();
  session.checkout = {
    minutes,
    ...pricing,
  };
  session.digitalPayment = useDigital;

  return session;
}
