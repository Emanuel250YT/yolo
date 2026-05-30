import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const pkgPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../package.json",
);

function readVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { version?: string };
    return pkg.version ?? "0.3.0";
  } catch {
    return "0.3.0";
  }
}

export function getAppMeta() {
  const commit =
    process.env.GIT_COMMIT?.trim().slice(0, 7) ||
    process.env.VERCEL_GIT_COMMIT_SHA?.trim().slice(0, 7) ||
    "dev";

  return {
    version: readVersion(),
    commit,
  };
}
