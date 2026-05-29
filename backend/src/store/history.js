import { randomUUID } from "crypto";
import { loadJson, saveJson } from "../db/persist.js";

const FILE = "history";

function load() {
  return loadJson(FILE, { entries: [] });
}

function save(data) {
  saveJson(FILE, data);
}

export function addHistoryEntry({
  permitId,
  userId,
  userName,
  action,
  before = null,
  after = null,
  observation = null,
}) {
  const data = load();
  const entry = {
    id: randomUUID(),
    permitId,
    userId,
    userName,
    action,
    before,
    after,
    observation: observation?.trim() || null,
    createdAt: new Date().toISOString(),
  };
  data.entries.unshift(entry);
  save(data);
  return entry;
}

export function listHistory({ permitId, userId, limit = 100 } = {}) {
  let entries = load().entries;
  if (permitId) entries = entries.filter((e) => e.permitId === permitId);
  if (userId) entries = entries.filter((e) => e.userId === userId);
  return entries.slice(0, limit);
}
