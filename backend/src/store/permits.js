import { randomUUID } from "crypto";
import { addHistoryEntry } from "./history.js";
import { findById } from "./users.js";
import { loadJson, saveJson } from "../db/persist.js";

const FILE = "permits";

function load() {
  return loadJson(FILE, { permits: [] });
}

function save(data) {
  saveJson(FILE, data);
}

export function listPermits({ permisionarioId, status } = {}) {
  let permits = load().permits;
  if (permisionarioId) {
    permits = permits.filter((p) => p.permisionarioId === permisionarioId);
  }
  if (status) permits = permits.filter((p) => p.status === status);
  return permits.sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
  );
}

export function getPermit(id) {
  return load().permits.find((p) => p.id === id) ?? null;
}

export function createPermit(
  { plate, zone, vehicleType, notes, startAt, endAt, permisionarioId },
  actor,
) {
  if (!plate?.trim()) throw new Error("La patente es obligatoria.");

  let permisionario = actor;
  if (actor.role === "admin") {
    const target = findById(permisionarioId);
    if (!target || target.role !== "permisionario") {
      throw new Error("Indicá un permisionario válido (permisionarioId).");
    }
    permisionario = target;
  } else if (actor.role !== "permisionario") {
    throw new Error("Sin permisos para crear permisos de estacionamiento.");
  }

  const data = load();
  const permit = {
    id: randomUUID(),
    permisionarioId: permisionario.id,
    permisionarioName: permisionario.name,
    permisionarioLegajo: permisionario.legajo,
    plate: plate.trim().toUpperCase(),
    zone: zone?.trim() || permisionario.zone || "microcentro",
    vehicleType: vehicleType === "motorcycle" ? "motorcycle" : "auto",
    notes: notes?.trim() || null,
    status: "active",
    startAt: startAt || new Date().toISOString(),
    endAt: endAt || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  data.permits.push(permit);
  save(data);

  addHistoryEntry({
    permitId: permit.id,
    userId: actor.id,
    userName: actor.name,
    action: "create",
    after: permit,
  });

  return permit;
}

export function updatePermit(id, patch, actor) {
  const data = load();
  const idx = data.permits.findIndex((p) => p.id === id);
  if (idx === -1) return null;

  const before = { ...data.permits[idx] };
  const permit = data.permits[idx];

  if (actor.role === "permisionario" && permit.permisionarioId !== actor.id) {
    throw new Error("No podés modificar permisos de otro permisionario.");
  }

  const allowed = ["plate", "zone", "vehicleType", "notes", "status", "endAt"];
  const changes = {};
  for (const key of allowed) {
    if (patch[key] !== undefined) {
      if (key === "plate") {
        permit.plate = patch.plate.trim().toUpperCase();
      } else if (key === "vehicleType") {
        permit.vehicleType =
          patch.vehicleType === "motorcycle" ? "motorcycle" : "auto";
      } else {
        permit[key] = patch[key];
      }
      changes[key] = permit[key];
    }
  }

  permit.updatedAt = new Date().toISOString();
  data.permits[idx] = permit;
  save(data);

  addHistoryEntry({
    permitId: permit.id,
    userId: actor.id,
    userName: actor.name,
    action: "update",
    before,
    after: permit,
    observation: patch.observation,
  });

  return permit;
}

export function addObservation(id, observation, actor) {
  const permit = getPermit(id);
  if (!permit) return null;
  if (actor.role === "permisionario" && permit.permisionarioId !== actor.id) {
    throw new Error("No autorizado.");
  }
  if (!observation?.trim()) {
    throw new Error("La observación no puede estar vacía.");
  }

  addHistoryEntry({
    permitId: id,
    userId: actor.id,
    userName: actor.name,
    action: "observation",
    observation: observation.trim(),
    after: { note: observation.trim() },
  });

  return permit;
}
