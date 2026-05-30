import "dotenv/config";
import { prisma } from "./lib/prisma.js";
import { isDevToolsEnabled } from "./config/devTools.js";
import { cleanDatabase } from "./store/dbClean.js";

if (!isDevToolsEnabled()) {
  console.error(
    "[SEM] db:clean requiere ENABLE_DEV_TOOLS=true en backend/.env",
  );
  process.exit(1);
}

cleanDatabase()
  .then(async (result) => {
    console.log("[SEM] Base de datos limpiada:");
    console.log(JSON.stringify(result, null, 2));
    if (result.municipioEmail) {
      console.log(`[SEM] Cuenta Municipalidad conservada: ${result.municipioEmail}`);
    }
    await prisma.$disconnect();
  })
  .catch(async (err) => {
    console.error("[SEM] Error al limpiar la base:", err);
    await prisma.$disconnect();
    process.exit(1);
  });
