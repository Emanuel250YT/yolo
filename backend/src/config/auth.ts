export const ROLES = ["municipio", "admin", "permisionario", "conductor"] as const;

export const PUBLIC_REGISTER_ROLES = ["conductor", "permisionario", "admin"] as const;

export const STAFF_ROLES = ["permisionario", "admin"] as const;

export const JWT_SECRET =
  process.env.JWT_SECRET ?? "sem-dev-secret-cambiar-en-produccion";

export const JWT_EXPIRES = process.env.JWT_EXPIRES ?? "7d";

export const MAX_RESERVATION_ADVANCE_MS = 30 * 60 * 1000;

export const MUNICIPIO_EMAIL = process.env.MUNICIPIO_EMAIL?.toLowerCase().trim();
export const MUNICIPIO_PASSWORD = process.env.MUNICIPIO_PASSWORD ?? "";
