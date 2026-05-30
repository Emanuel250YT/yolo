function trimTrailingSlash(url: string) {
  return url.replace(/\/+$/, "");
}

function parseList(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((part) => trimTrailingSlash(part.trim()))
    .filter(Boolean);
}

/** URL pública del frontend (p. ej. https://sem.localto.net) */
export function getFrontendUrl() {
  return trimTrailingSlash(
    process.env.FRONTEND_URL ?? "http://localhost:5173",
  );
}

/** URL pública del backend sin /api (p. ej. https://apisem.localto.net) */
export function getApiPublicUrl() {
  return trimTrailingSlash(
    process.env.API_PUBLIC_URL ?? "http://localhost:3001",
  );
}

const LOCALHOST_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

/** Orígenes permitidos para CORS (unión de env + frontend + localhost) */
export function getCorsOrigins(): string[] {
  const origins = new Set<string>(LOCALHOST_ORIGINS);

  for (const origin of parseList(process.env.CORS_ORIGINS)) {
    origins.add(origin);
  }

  const frontend = process.env.FRONTEND_URL?.trim();
  if (frontend) {
    origins.add(trimTrailingSlash(frontend));
  }

  return [...origins];
}

/** Túneles localto.net (sem.localto.net, apisem.localto.net, etc.) */
export function isLocaltoOrigin(origin: string) {
  try {
    const { hostname, protocol } = new URL(origin);
    return (
      (protocol === "https:" || protocol === "http:") &&
      hostname.endsWith(".localto.net")
    );
  } catch {
    return false;
  }
}

export function isCorsPermissive() {
  return (
    process.env.CORS_PERMISSIVE === "true" ||
    process.env.ENABLE_DEV_TOOLS === "true" ||
    process.env.NODE_ENV !== "production"
  );
}

export function isAllowedCorsOrigin(origin: string, allowed: Set<string>) {
  if (allowed.has(origin)) return true;
  if (isLocaltoOrigin(origin)) return true;
  if (isCorsPermissive()) return true;
  return false;
}
