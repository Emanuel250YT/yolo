import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config/auth.js";
import { findById, sanitizeUser } from "../store/users.js";

export function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Iniciá sesión para continuar." });
  }
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET);
    const user = findById(payload.sub);
    if (!user || !user.active) {
      return res.status(401).json({ error: "Usuario inactivo o inexistente." });
    }
    req.user = sanitizeUser(user);
    next();
  } catch {
    return res.status(401).json({ error: "Sesión expirada. Volvé a iniciar sesión." });
  }
}

export function optionalAuth(req, _res, next) {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    try {
      const payload = jwt.verify(header.slice(7), JWT_SECRET);
      const user = findById(payload.sub);
      if (user?.active) req.user = sanitizeUser(user);
    } catch {
      /* ignore */
    }
  }
  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "No tenés permisos para esta acción." });
    }
    next();
  };
}
