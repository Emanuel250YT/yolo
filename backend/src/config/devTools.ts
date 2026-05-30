/** DevTools activos solo con ENABLE_DEV_TOOLS=true en .env del backend. */
export function isDevToolsEnabled() {
  return process.env.ENABLE_DEV_TOOLS === "true";
}
