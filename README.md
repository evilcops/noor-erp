# NOOR ERP

Monorepo for **NOOR People** (Phase 1 HR module).

```
noor-erp/
├── frontend/     # Next.js 16 + React + Tailwind (UI)
└── backend/      # Express + MongoDB (REST API)
```

## Quick start

```bash
# Backend API (port 5000)
cd backend
npm install
npm run dev

# Frontend (port 3000) — separate terminal
cd frontend
npm install
npm run dev
```

Or from the repo root:

```bash
npm run dev:backend
npm run dev:frontend
```

## Environment

| App | Config file | API URL |
|-----|-------------|---------|
| Backend | `backend/.env` | `http://localhost:5000/api` |
| Frontend | `frontend/.env` | `NEXT_PUBLIC_API_URL=http://localhost:5000/api` |

For local dev without MongoDB Atlas, set `USE_MEMORY_DB=true` in `backend/.env`.

## Login (dev)

| Email | Password |
|-------|----------|
| `admin@noor.om` | `Password123!` |

## Docs

- [Frontend structure](frontend/docs/STRUCTURE.md)
- [Component format (template / script / style)](frontend/docs/COMPONENTS.md)
- [Backend API](backend/README.md)
