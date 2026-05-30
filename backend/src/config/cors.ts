import cors from "cors";
import {
  getCorsOrigins,
  isAllowedCorsOrigin,
  isCorsPermissive,
} from "./appUrls.js";

export function corsMiddleware() {
  const allowed = new Set(getCorsOrigins());

  return cors({
    origin(origin, callback) {
      // Sin Origin: curl, same-origin, algunos proxies
      if (!origin) {
        callback(null, true);
        return;
      }

      if (isAllowedCorsOrigin(origin, allowed)) {
        callback(null, true);
        return;
      }

      console.warn(
        `[CORS] Origen rechazado: ${origin} | permitidos: ${[...allowed].join(", ")}${isCorsPermissive() ? " | modo permisivo activo" : ""}`,
      );
      callback(null, false);
    },
    credentials: true,
  });
}
