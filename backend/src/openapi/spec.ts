/** OpenAPI 3.0 — SEM Backend */
export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "SEM API",
    description:
      "API del Sistema de Estacionamiento Medido (SEM). Autenticación JWT vía header `Authorization: Bearer <token>`. DevTools: header opcional `X-Dev-Shift` (auto|open|closed|day|night).",
    version: "0.3.0",
  },
  servers: [{ url: "/api", description: "API base" }],
  tags: [
    { name: "Auth", description: "Login, registro y sesión" },
    { name: "Public", description: "Endpoints públicos" },
    { name: "Sessions", description: "Sesiones de estacionamiento" },
    { name: "Admin", description: "Administración SEM" },
    { name: "Municipio", description: "Panel municipalidad" },
    { name: "Permisionario", description: "Operación permisionarios" },
    { name: "Conductor", description: "App conductores" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },
    schemas: {
      Error: {
        type: "object",
        properties: { error: { type: "string" } },
      },
      LoginRequest: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: { type: "string", format: "email" },
          password: { type: "string" },
        },
      },
      QuoteRequest: {
        type: "object",
        required: ["minutes"],
        properties: {
          vehicleType: { type: "string", enum: ["auto", "motorcycle"] },
          minutes: { type: "number" },
          digitalPayment: { type: "boolean" },
          plate: { type: "string" },
        },
      },
    },
    responses: {
      Unauthorized: {
        description: "No autenticado",
        content: {
          "application/json": { schema: { $ref: "#/components/schemas/Error" } },
        },
      },
      BadRequest: {
        description: "Solicitud inválida",
        content: {
          "application/json": { schema: { $ref: "#/components/schemas/Error" } },
        },
      },
    },
  },
  paths: {
    "/health": {
      get: {
        tags: ["Public"],
        summary: "Health check",
        responses: { "200": { description: "OK" } },
      },
    },
    "/auth/config": {
      get: {
        tags: ["Auth"],
        summary: "Configuración de registro",
        responses: { "200": { description: "Config" } },
      },
    },
    "/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Iniciar sesión",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/LoginRequest" },
            },
          },
        },
        responses: {
          "200": { description: "Token y usuario" },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/auth/register": {
      post: {
        tags: ["Auth"],
        summary: "Registro público (conductor)",
        requestBody: { required: true, content: { "application/json": {} } },
        responses: {
          "201": { description: "Usuario creado" },
          "400": { $ref: "#/components/responses/BadRequest" },
        },
      },
    },
    "/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "Usuario autenticado",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Perfil" } },
      },
    },
    "/tariffs": {
      get: {
        tags: ["Public"],
        summary: "Tarifas y turnos",
        responses: { "200": { description: "Tarifas" } },
      },
    },
    "/shifts/status": {
      get: {
        tags: ["Public"],
        summary: "Estado del turno de cobro",
        parameters: [
          {
            name: "X-Dev-Shift",
            in: "header",
            schema: {
              type: "string",
              enum: ["auto", "open", "closed", "day", "night"],
            },
          },
        ],
        responses: { "200": { description: "Estado turno" } },
      },
    },
    "/parking-zones": {
      get: {
        tags: ["Public"],
        summary: "Zonas habilitadas (público)",
        responses: { "200": { description: "Lista de zonas" } },
      },
    },
    "/quote": {
      post: {
        tags: ["Public"],
        summary: "Cotizar estacionamiento",
        requestBody: {
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/QuoteRequest" },
            },
          },
        },
        responses: { "200": { description: "Cotización" } },
      },
    },
    "/sessions": {
      get: {
        tags: ["Sessions"],
        summary: "Listar sesiones",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Sesiones" } },
      },
      post: {
        tags: ["Sessions"],
        summary: "Crear sesión",
        security: [{ bearerAuth: [] }],
        requestBody: { content: { "application/json": {} } },
        responses: { "201": { description: "Sesión creada" } },
      },
    },
    "/sessions/{id}": {
      get: {
        tags: ["Sessions"],
        summary: "Detalle de sesión",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "Sesión" } },
      },
    },
    "/sessions/{id}/checkout": {
      post: {
        tags: ["Sessions"],
        summary: "Cerrar sesión / checkout",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "Sesión cerrada" } },
      },
    },
    "/admin/dashboard": {
      get: {
        tags: ["Admin"],
        summary: "Estadísticas del dashboard",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Stats" } },
      },
    },
    "/admin/overview": {
      get: {
        tags: ["Admin"],
        summary: "Resumen de contadores",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Overview" } },
      },
    },
    "/admin/users": {
      get: {
        tags: ["Admin"],
        summary: "Listar usuarios",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Usuarios" } },
      },
      post: {
        tags: ["Admin"],
        summary: "Crear usuario",
        security: [{ bearerAuth: [] }],
        requestBody: { content: { "application/json": {} } },
        responses: { "201": { description: "Usuario creado" } },
      },
    },
    "/admin/users/{id}": {
      patch: {
        tags: ["Admin"],
        summary: "Actualizar usuario",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "Usuario actualizado" } },
      },
    },
    "/admin/users/{id}/password": {
      post: {
        tags: ["Admin"],
        summary: "Cambiar contraseña",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "OK" } },
      },
    },
    "/admin/permits": {
      get: {
        tags: ["Admin"],
        summary: "Listar permisos",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Permisos" } },
      },
    },
    "/admin/history": {
      get: {
        tags: ["Admin"],
        summary: "Historial de cambios",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "limit", in: "query", schema: { type: "integer" } },
        ],
        responses: { "200": { description: "Historial" } },
      },
    },
    "/admin/reservations": {
      get: {
        tags: ["Admin"],
        summary: "Reservas",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Reservas" } },
      },
    },
    "/admin/spots": {
      get: {
        tags: ["Admin"],
        summary: "Plazas",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Plazas" } },
      },
      post: {
        tags: ["Admin"],
        summary: "Crear/actualizar plaza",
        security: [{ bearerAuth: [] }],
        responses: { "201": { description: "Plaza" } },
      },
    },
    "/admin/spots/live": {
      get: {
        tags: ["Admin"],
        summary: "Plazas en tiempo real",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Plazas live" } },
      },
    },
    "/admin/spots/{id}": {
      patch: {
        tags: ["Admin"],
        summary: "Actualizar plaza",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "Plaza" } },
      },
      delete: {
        tags: ["Admin"],
        summary: "Eliminar plaza",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
          {
            name: "force",
            in: "query",
            schema: { type: "boolean" },
            description: "Forzar eliminación",
          },
        ],
        responses: { "200": { description: "Eliminada" } },
      },
    },
    "/admin/spots/{id}/occupancy": {
      patch: {
        tags: ["Admin"],
        summary: "Marcar ocupación",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "Plaza" } },
      },
    },
    "/admin/parking-zones": {
      get: {
        tags: ["Admin"],
        summary: "Listar zonas",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Zonas" } },
      },
      post: {
        tags: ["Admin"],
        summary: "Crear zona",
        security: [{ bearerAuth: [] }],
        responses: { "201": { description: "Zona" } },
      },
    },
    "/admin/parking-zones/{id}": {
      get: {
        tags: ["Admin"],
        summary: "Detalle de zona",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "Zona" } },
      },
      patch: {
        tags: ["Admin"],
        summary: "Actualizar zona",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "Zona" } },
      },
      delete: {
        tags: ["Admin"],
        summary: "Eliminar zona",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "Eliminada" } },
      },
    },
    "/admin/parking-zones/{id}/delete-check": {
      get: {
        tags: ["Admin"],
        summary: "Verificar eliminación de zona",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "Blockers" } },
      },
    },
    "/admin/parking-zones/{id}/spots": {
      post: {
        tags: ["Admin"],
        summary: "Crear plaza en zona (mapa)",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["lat", "lng"],
                properties: {
                  lat: { type: "number" },
                  lng: { type: "number" },
                  label: { type: "string" },
                },
              },
            },
          },
        },
        responses: { "201": { description: "Plaza" } },
      },
    },
    "/admin/blocks": {
      get: {
        tags: ["Admin"],
        summary: "Listar calles/bloques",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "zoneId", in: "query", schema: { type: "string" } },
        ],
        responses: { "200": { description: "Bloques" } },
      },
      post: {
        tags: ["Admin"],
        summary: "Crear bloque",
        security: [{ bearerAuth: [] }],
        responses: { "201": { description: "Bloque" } },
      },
    },
    "/admin/blocks/{id}": {
      delete: {
        tags: ["Admin"],
        summary: "Eliminar bloque",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "Eliminado" } },
      },
    },
    "/admin/sessions": {
      get: {
        tags: ["Admin"],
        summary: "Sesiones",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Sesiones" } },
      },
    },
    "/municipio/dashboard": {
      get: {
        tags: ["Municipio"],
        summary: "Dashboard municipio",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Stats" } },
      },
    },
    "/municipio/parking-zones": {
      get: {
        tags: ["Municipio"],
        summary: "Zonas",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Zonas" } },
      },
      post: {
        tags: ["Municipio"],
        summary: "Crear zona",
        security: [{ bearerAuth: [] }],
        responses: { "201": { description: "Zona" } },
      },
    },
    "/municipio/parking-zones/{id}": {
      get: {
        tags: ["Municipio"],
        summary: "Detalle zona",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "Zona" } },
      },
      patch: {
        tags: ["Municipio"],
        summary: "Actualizar zona",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "Zona" } },
      },
      delete: {
        tags: ["Municipio"],
        summary: "Eliminar zona",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "Eliminada" } },
      },
    },
    "/municipio/users": {
      get: {
        tags: ["Municipio"],
        summary: "Usuarios",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "pending", in: "query", schema: { type: "boolean" } },
        ],
        responses: { "200": { description: "Usuarios" } },
      },
      post: {
        tags: ["Municipio"],
        summary: "Crear staff",
        security: [{ bearerAuth: [] }],
        responses: { "201": { description: "Usuario" } },
      },
    },
    "/municipio/users/{id}/activate": {
      patch: {
        tags: ["Municipio"],
        summary: "Activar usuario",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "Activado" } },
      },
    },
    "/municipio/users/{id}/deactivate": {
      patch: {
        tags: ["Municipio"],
        summary: "Desactivar usuario",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "Desactivado" } },
      },
    },
    "/municipio/tariffs": {
      patch: {
        tags: ["Municipio"],
        summary: "Actualizar tarifas",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Tarifas" } },
      },
    },
    "/permisionario/permits": {
      get: {
        tags: ["Permisionario"],
        summary: "Listar permisos",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Permisos" } },
      },
      post: {
        tags: ["Permisionario"],
        summary: "Crear permiso",
        security: [{ bearerAuth: [] }],
        responses: { "201": { description: "Permiso" } },
      },
    },
    "/permisionario/permits/{id}": {
      patch: {
        tags: ["Permisionario"],
        summary: "Actualizar permiso",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "Permiso" } },
      },
    },
    "/permisionario/permits/{id}/observations": {
      post: {
        tags: ["Permisionario"],
        summary: "Agregar observación",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "OK" } },
      },
    },
    "/permisionario/permits/{id}/history": {
      get: {
        tags: ["Permisionario"],
        summary: "Historial del permiso",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "Historial" } },
      },
    },
    "/permisionario/history": {
      get: {
        tags: ["Permisionario"],
        summary: "Historial global",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Historial" } },
      },
    },
    "/permisionario/spots/live": {
      get: {
        tags: ["Permisionario"],
        summary: "Plazas en tiempo real",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Plazas" } },
      },
    },
    "/permisionario/spots/{id}/occupancy": {
      patch: {
        tags: ["Permisionario"],
        summary: "Marcar ocupación",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "Plaza" } },
      },
    },
    "/permisionario/blocks": {
      get: {
        tags: ["Permisionario"],
        summary: "Bloques/calles",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Bloques" } },
      },
    },
    "/permisionario/zones/{id}": {
      get: {
        tags: ["Permisionario"],
        summary: "Detalle zona",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "Zona" } },
      },
    },
    "/conductor/spots": {
      get: {
        tags: ["Conductor"],
        summary: "Plazas disponibles",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Plazas" } },
      },
    },
    "/conductor/spots/live": {
      get: {
        tags: ["Conductor"],
        summary: "Plazas live",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Plazas" } },
      },
    },
    "/conductor/spots/{id}/hold": {
      post: {
        tags: ["Conductor"],
        summary: "Reservar plaza temporalmente",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "201": { description: "Hold" } },
      },
    },
    "/conductor/holds/{id}": {
      get: {
        tags: ["Conductor"],
        summary: "Estado del hold",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "Hold" } },
      },
      delete: {
        tags: ["Conductor"],
        summary: "Cancelar hold",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "Cancelado" } },
      },
    },
    "/conductor/holds/{id}/pay": {
      post: {
        tags: ["Conductor"],
        summary: "Pagar reserva",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "Reserva confirmada" } },
      },
    },
    "/conductor/vehicles": {
      get: {
        tags: ["Conductor"],
        summary: "Mis vehículos",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Vehículos" } },
      },
      post: {
        tags: ["Conductor"],
        summary: "Registrar vehículo",
        security: [{ bearerAuth: [] }],
        responses: { "201": { description: "Vehículo" } },
      },
    },
    "/conductor/vehicles/{id}": {
      delete: {
        tags: ["Conductor"],
        summary: "Eliminar vehículo",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "Eliminado" } },
      },
    },
    "/conductor/reservations": {
      get: {
        tags: ["Conductor"],
        summary: "Mis reservas",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Reservas" } },
      },
    },
    "/conductor/reservations/{id}": {
      delete: {
        tags: ["Conductor"],
        summary: "Cancelar reserva",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "Cancelada" } },
      },
    },
    "/conductor/parking-alerts": {
      get: {
        tags: ["Conductor"],
        summary: "Alertas de estacionamiento",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Alertas" } },
      },
    },
    "/conductor/blocks/nearby": {
      get: {
        tags: ["Conductor"],
        summary: "Cuadras cercanas",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "lat", in: "query", schema: { type: "number" } },
          { name: "lng", in: "query", schema: { type: "number" } },
        ],
        responses: { "200": { description: "Bloques" } },
      },
    },
    "/conductor/config": {
      get: {
        tags: ["Conductor"],
        summary: "Configuración conductor",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Config" } },
      },
    },
  },
} as const;

export type OpenApiSpec = typeof openApiSpec;
