# SEM Backend

API Express con reglas tarifarias del estacionamiento medido.

## Autenticación

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/auth/login` | Iniciar sesión (JWT) |
| POST | `/api/auth/register/conductor` | Registro público solo conductores |
| GET | `/api/auth/me` | Usuario actual (Bearer token) |

Header: `Authorization: Bearer <token>`

## Endpoints por rol

**Admin** (`/api/admin/*`): usuarios, overview, permisos, historial, reservas, lugares.

**Permisionario** (`/api/permisionario/*`): CRUD permisos, observaciones, historial.

**Conductor** (`/api/conductor/*`): lugares disponibles, reservas (máx. 30 min anticipación).

**Públicos**: `/api/health`, `/api/tariffs`, `/api/shifts/status`, `/api/quote`

### Ejemplo `POST /api/quote`

```json
{
  "plate": "AB123CD",
  "vehicleType": "auto",
  "minutes": 90,
  "digitalPayment": true
}
```

## Desarrollo

```bash
npm install
npm run dev
```

Puerto por defecto: **3001** (`PORT` para cambiarlo).
