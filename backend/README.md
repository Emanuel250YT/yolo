# SEM Backend

API Express con reglas tarifarias del estacionamiento medido.

## Endpoints

| Método | Ruta                        | Descripción                    |
|--------|-----------------------------|--------------------------------|
| GET    | `/api/health`               | Estado del servicio            |
| GET    | `/api/tariffs`              | Tarifas y turnos               |
| GET    | `/api/shifts/status`        | Horario de cobro actual        |
| POST   | `/api/quote`                | Cotizar sin sesión             |
| GET    | `/api/sessions`             | Listar sesiones                |
| POST   | `/api/sessions`             | Iniciar estacionamiento        |
| GET    | `/api/sessions/:id`         | Detalle de sesión              |
| POST   | `/api/sessions/:id/checkout`| Finalizar y calcular cobro     |

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
