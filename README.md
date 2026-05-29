# SEM — Sistema de Estacionamiento Medido

Monorepo para la digitalización del estacionamiento medido en el microcentro de Salta.

## Estructura

```
/
├── cam-vision-service/   # API FastAPI + YOLO (detección y tracking de vehículos)
├── app/                  # Frontend Vite + React
└── backend/              # API Express (tarifas, cotizaciones SEM)
```

## Inicio rápido

### 1. Backend SEM (puerto 3001)

```bash
cd backend
npm install
npm run dev
```

### 2. Frontend (puerto 5173)

```bash
cd app
npm install
npm run dev
```

El proxy de Vite reenvía `/api` al backend.

### 3. Servicio de visión (puerto 8000)

```bash
cd cam-vision-service
pip install -r requirements.txt
uvicorn api.main:app --reload --port 8000
```

## Contexto

El SEM actual opera con talonarios físicos sin trazabilidad digital. Este proyecto apunta a:

- Registro electrónico de cobros y ocupación
- Pago digital con incentivo del 20 %
- Fraccionamiento tarifario automático (15 min desde la 2.ª hora)
- Control de turnos diurno/nocturno y zonas habilitadas
- Integración con cámaras vía `cam-vision-service`

## Documentación por servicio

- [cam-vision-service/README.md](cam-vision-service/README.md)
- [backend/README.md](backend/README.md)
- [app/README.md](app/README.md)
