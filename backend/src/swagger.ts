import type { Express } from "express";
import swaggerUi from "swagger-ui-express";
import { openApiSpec } from "./openapi/spec.js";

export function setupSwagger(app: Express) {
  app.get("/api/openapi.json", (_req, res) => {
    res.json(openApiSpec);
  });

  app.use(
    "/api/docs",
    swaggerUi.serve,
    swaggerUi.setup(openApiSpec, {
      customSiteTitle: "SEM API Docs",
      customCss: ".swagger-ui .topbar { display: none }",
    }),
  );
}
