import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = path.join(__dirname, "../../data");

export function loadJson(name, defaultValue) {
  const file = path.join(DATA_DIR, `${name}.json`);
  try {
    if (!fs.existsSync(file)) return structuredClone(defaultValue);
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return structuredClone(defaultValue);
  }
}

export function saveJson(name, data) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(DATA_DIR, `${name}.json`),
    JSON.stringify(data, null, 2),
    "utf8",
  );
}
