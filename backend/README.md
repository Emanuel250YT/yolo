# SEM Backend

API en **TypeScript**, **Express**, **Prisma** y **PostgreSQL**.

## Requisitos

- Node.js 20+
- PostgreSQL 14+

## Configuración

```bash
cp .env.example .env
# Editá DATABASE_URL y MUNICIPIO_*
npm install
npm run db:push    # crea tablas en PostgreSQL
npm run dev
```

## Scripts

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Desarrollo con recarga (tsx) |
| `npm run build` | Compila a `dist/` |
| `npm start` | Producción (`node dist/index.js`) |
| `npm run db:generate` | Genera cliente Prisma |
| `npm run db:migrate` | Migraciones con historial |
| `npm run db:push` | Sincroniza schema sin migración |
| `npm run db:studio` | UI de datos Prisma |

## Autenticación

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/auth/login` | Iniciar sesión (JWT) |
| POST | `/api/auth/register` | Registro (conductor activo; staff inactivo) |
| GET | `/api/auth/me` | Usuario actual |

## Roles

- **municipio** — variables de entorno; habilita permisionarios/admin
- **admin** — gestión integral
- **permisionario** — permisos e historial
- **conductor** — lugares y reservas (30 min anticipación)
