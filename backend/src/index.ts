import "dotenv/config";
import express from "express";
import routes from "./routes/index.js";
import oauthRoutes from "./routes/oauth.js";
import { setupSwagger } from "./swagger.js";
import { prisma } from "./lib/prisma.js";
import { maybeExpireRecords } from "./middleware/expireRecords.js";
import { devClockMiddleware } from "./middleware/devClock.js";
import { ensureMunicipioAccount } from "./services/municipioAccount.js";
import { corsMiddleware } from "./config/cors.js";
import { getApiPublicUrl, getCorsOrigins, getFrontendUrl, isCorsPermissive } from "./config/appUrls.js";
import { startMercadoPagoTokenRefreshJob } from "./services/mpTokenRefreshJob.js";
import { startActiveExpiryJob } from "./services/activeExpiryJob.js";
import devRoutes from "./routes/dev.js";

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(corsMiddleware());
app.use(express.json({ limit: "20mb" }));
setupSwagger(app);
app.use("/oauth", oauthRoutes);
app.use("/api/dev", devRoutes);
app.use("/api", devClockMiddleware, maybeExpireRecords, routes);

app.get("/", (_req, res) => {
  res.json({
    name: "SEM Backend",
    version: "0.3.0",
    stack: "TypeScript + Express + Prisma + PostgreSQL",
    docs: "/api/docs",
    openapi: "/api/openapi.json",
  });
});

async function main() {
  try {
    await prisma.$connect();
    console.log("[SEM] PostgreSQL conectado.");
    const municipio = await ensureMunicipioAccount();
    if (municipio.created) {
      console.log(`[SEM] Cuenta Municipalidad creada: ${municipio.email}`);
    } else if (!municipio.ok && municipio.error) {
      console.warn(`[SEM] ${municipio.error}`);
    }
  } catch (err) {
    console.warn(
      "[SEM] No se pudo conectar a PostgreSQL. Revisá DATABASE_URL y ejecutá: npm run db:push",
    );
    console.warn(err);
  }

  app.listen(PORT, () => {
    startActiveExpiryJob();
    startMercadoPagoTokenRefreshJob();
    console.log(`SEM backend escuchando en http://localhost:${PORT}`);
    console.log(`Documentación API: http://localhost:${PORT}/api/docs`);
    console.log(`Frontend permitido (CORS): ${getCorsOrigins().join(", ")}`);
    console.log(`URL pública API: ${getApiPublicUrl()}`);
    console.log(`URL frontend: ${getFrontendUrl()}`);
    if (isCorsPermissive()) {
      console.log("[CORS] Modo permisivo: localhost + *.localto.net + orígenes de env");
    }
  });
}

main().catch((err) => {
  console.error("Error al iniciar:", err);
  process.exit(1);
});
