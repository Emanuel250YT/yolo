import jwt, { type SignOptions } from "jsonwebtoken";
import { JWT_EXPIRES, JWT_SECRET } from "../config/auth.js";
import type { SafeUser } from "../types/api.js";

export function signToken(user: { id: string; role: string; email: string }) {
  const options: SignOptions = { expiresIn: JWT_EXPIRES as SignOptions["expiresIn"] };
  return jwt.sign(
    { sub: user.id, role: user.role, email: user.email },
    JWT_SECRET,
    options,
  );
}

export function authResponse(user: SafeUser) {
  return {
    token: signToken(user),
    user,
  };
}
