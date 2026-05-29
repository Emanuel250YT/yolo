import cors from "cors";
import express from "express";
import routes from "./routes/index.js";

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(cors());
app.use(express.json());
app.use("/api", routes);

app.get("/", (_req, res) => {
  res.json({
    name: "SEM Backend",
    description: "API de estacionamiento medido — Municipalidad de Salta",
    endpoints: ["/api/health", "/api/tariffs", "/api/quote"],
  });
});

app.listen(PORT, () => {
  console.log(`SEM backend escuchando en http://localhost:${PORT}`);
});
