# NOOR ERP

Single **Next.js** full-stack app for **NOOR People** (Phase 1 HR module). The UI and REST API run together on one server — no separate Express backend.

```
noor-erp/
└── frontend/     # Next.js 16 + React + Tailwind + MongoDB API routes
```

## Quick start

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). API routes are at `/api/*`.

Or from the repo root:

```bash
npm run dev
```

## Environment (`frontend/.env`)

| Variable | Description |
|----------|-------------|
| `MONGODB_URI` | MongoDB connection string (single URI, e.g. `mongodb://127.0.0.1:27017/noor_erp` or Atlas `mongodb+srv://...`) |
| `USE_MEMORY_DB` | Set to `true` for local dev without MongoDB (file-backed at `frontend/.data/mongo`) |
| `JWT_SECRET` | Access token signing secret |
| `JWT_REFRESH_SECRET` | Refresh token signing secret |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Dev admin auto-created on first API request |

## Login (dev)

| Email | Password |
|-------|----------|
| `admin@noor.om` | `Password123!` |

## Scripts

```bash
npm run seed          # Reset and seed sample data (from frontend/)
npm run reset-admin   # Upsert default admin user only
```

## Docs

- [Frontend structure](frontend/docs/STRUCTURE.md)
- [Component format (template / script / style)](frontend/docs/COMPONENTS.md)
