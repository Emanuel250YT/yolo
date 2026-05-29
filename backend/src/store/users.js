import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { ROLES } from "../config/auth.js";
import { loadJson, saveJson } from "../db/persist.js";

const FILE = "users";

function load() {
  return loadJson(FILE, { users: [] });
}

function save(data) {
  saveJson(FILE, data);
}

export function sanitizeUser(user) {
  const { passwordHash, ...safe } = user;
  return safe;
}

export function findByEmail(email) {
  const { users } = load();
  return users.find((u) => u.email === email.toLowerCase().trim()) ?? null;
}

export function findByDni(dni) {
  if (!dni) return null;
  const normalized = dni.trim();
  const { users } = load();
  return (
    users.find((u) => u.citizen?.dni === normalized) ?? null
  );
}

export function findById(id) {
  const { users } = load();
  return users.find((u) => u.id === id) ?? null;
}

export function listUsers({ role, activationPending } = {}) {
  const { users } = load();
  let list = users.map(sanitizeUser);
  if (role) list = list.filter((u) => u.role === role);
  if (activationPending === true) {
    list = list.filter((u) => u.activationPending);
  }
  return list;
}

export async function createUser({
  email,
  password,
  name,
  role,
  legajo = null,
  zone = null,
  active = true,
  activationPending = false,
  citizen = null,
  createdByMunicipio = false,
}) {
  if (!ROLES.includes(role)) {
    throw new Error("Rol inválido.");
  }
  const normalized = email.toLowerCase().trim();
  if (findByEmail(normalized)) {
    throw new Error("El correo ya está registrado.");
  }
  if (!password || password.length < 6) {
    throw new Error("La contraseña debe tener al menos 6 caracteres.");
  }
  if (role === "permisionario" && !legajo?.trim()) {
    throw new Error("El legajo es obligatorio para permisionarios.");
  }

  const data = load();
  const user = {
    id: randomUUID(),
    email: normalized,
    passwordHash: await bcrypt.hash(password, 10),
    name: name?.trim() || normalized.split("@")[0],
    role,
    legajo: legajo?.trim() || null,
    zone: zone?.trim() || null,
    active: Boolean(active),
    activationPending: Boolean(activationPending),
    citizen: citizen || null,
    createdByMunicipio: Boolean(createdByMunicipio),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  data.users.push(user);
  save(data);
  return sanitizeUser(user);
}

export async function verifyPassword(user, password) {
  return bcrypt.compare(password, user.passwordHash);
}

export function updateUser(id, patch) {
  const data = load();
  const idx = data.users.findIndex((u) => u.id === id);
  if (idx === -1) return null;

  const user = data.users[idx];
  if (user.role === "municipio" && patch.active === false) {
    throw new Error("La cuenta Municipio no puede desactivarse.");
  }

  if (patch.email && patch.email !== user.email) {
    const exists = findByEmail(patch.email);
    if (exists && exists.id !== id) {
      throw new Error("El correo ya está en uso.");
    }
    user.email = patch.email.toLowerCase().trim();
  }
  if (patch.name !== undefined) user.name = patch.name.trim();
  if (patch.legajo !== undefined) user.legajo = patch.legajo?.trim() || null;
  if (patch.zone !== undefined) user.zone = patch.zone?.trim() || null;
  if (patch.active !== undefined) {
    user.active = Boolean(patch.active);
    if (user.active) user.activationPending = false;
  }
  if (patch.activationPending !== undefined) {
    user.activationPending = Boolean(patch.activationPending);
  }
  if (patch.role !== undefined) {
    if (!ROLES.includes(patch.role) || patch.role === "municipio") {
      throw new Error("Rol inválido.");
    }
    user.role = patch.role;
  }
  user.updatedAt = new Date().toISOString();
  data.users[idx] = user;
  save(data);
  return sanitizeUser(user);
}

export async function setPassword(id, password) {
  if (!password || password.length < 6) {
    throw new Error("La contraseña debe tener al menos 6 caracteres.");
  }
  const data = load();
  const user = data.users.find((u) => u.id === id);
  if (!user) return null;
  user.passwordHash = await bcrypt.hash(password, 10);
  user.updatedAt = new Date().toISOString();
  save(data);
  return sanitizeUser(user);
}
