import "dotenv/config";
import { prisma } from "./lib/prisma.js";
import { runSeed } from "./seed.js";

runSeed()
  .then(async () => {
    console.log("[SEM] Seed completado.");
    await prisma.$disconnect();
  })
  .catch(async (err) => {
    console.error("[SEM] Error en seed:", err);
    await prisma.$disconnect();
    process.exit(1);
  });
