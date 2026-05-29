import type { SafeUser } from "../store/users.js";

declare global {
  namespace Express {
    interface Request {
      user?: SafeUser;
    }
  }
}

export {};
