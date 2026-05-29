import jwt from "jsonwebtoken";
import { JWT_EXPIRES, JWT_SECRET } from "../config/auth.js";
import { sanitizeUser } from "../store/users.js";

export function signToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, email: user.email },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES },
  );
}

export function authResponse(user) {
  return {
    token: signToken(user),
    user: sanitizeUser(user),
  };
}
