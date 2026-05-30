import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config/auth.js";
import { findById, sanitizeUser } from "../store/users.js";
import type { UserRole } from "../prisma/client.js";

interface JwtPayload {
  sub: string;
  role: UserRole;
  email: string;
}

export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Iniciá sesión para continuar." });
  }
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET) as JwtPayload;
    const user = await findById(payload.sub);
    if (!user || !user.active) {
      return res
        .status(401)
        .json({ error: "Usuario inactivo o inexistente." });
    }
    req.user = sanitizeUser(user);
    next();
  } catch {
    return res
      .status(401)
      .json({ error: "Sesión expirada. Volvé a iniciar sesión." });
  }
}

export async function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    try {
      const payload = jwt.verify(header.slice(7), JWT_SECRET) as JwtPayload;
      const user = await findById(payload.sub);
      if (user?.active) req.user = sanitizeUser(user);
    } catch {
      /* ignore */
    }
  }
  next();
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res
        .status(403)
        .json({ error: "No tenés permisos para esta acción." });
    }
    next();
  };
}
