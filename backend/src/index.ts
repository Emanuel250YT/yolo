import "dotenv/config";
import cors from "cors";
import express from "express";
import routes from "./routes/index.js";
import { runSeed } from "./seed.js";

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(cors());
app.use(express.json({ limit: "20mb" }));
app.use("/api", routes);

app.get("/", (_req, res) => {
  res.json({
    name: "SEM Backend",
    version: "0.3.0",
    stack: "TypeScript + Express + Prisma + PostgreSQL",
  });
});

async function main() {
  try {
    await runSeed();
  } catch (err) {
    console.error(
      "[SEM] No se pudo conectar a PostgreSQL. Revisá DATABASE_URL y ejecutá: npm run db:push",
    );
    console.error(err);
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`SEM backend escuchando en http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error("Error al iniciar:", err);
  process.exit(1);
});
