# NOOR ERP — Backend API (Phase 1)

Express.js + TypeScript + MongoDB (Mongoose) REST API for NOOR People HR module.

## Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js 20+ |
| Framework | Express.js 4 |
| Database | MongoDB + Mongoose |
| Auth | JWT (`jsonwebtoken`) + bcrypt |
| Validation | Zod |
| Logging | Winston |
| Uploads | Multer (dev) → AWS S3 (production) |

## Quick start

```bash
cd backend
cp .env.example .env
npm install

# If Atlas connection fails, add to .env:
#   USE_MEMORY_DB=true

npm run dev     # http://localhost:5000
npm run seed    # optional — full demo data (works with memory DB too)
```

## Environment

See `.env.example`. Minimum required:

```env
MONGODB_URI=mongodb://localhost:27017/noor_erp
JWT_SECRET=your-secret-min-32-chars
JWT_REFRESH_SECRET=your-refresh-secret
CORS_ORIGIN=http://localhost:3000
```

## API base URL

```
http://localhost:5000/api
```

### Authentication

All protected routes require:

```
Authorization: Bearer <access_token>
```

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register (first user → business_owner) |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/logout` | Logout |
| POST | `/api/auth/refresh` | Refresh tokens |
| GET | `/api/auth/me` | Current user + permissions |
| POST | `/api/auth/change-password` | Change password |

### Core modules

- `/api/companies` — Company CRUD
- `/api/branches` — Branch CRUD + holidays
- `/api/employees` — Employee CRUD + documents
- `/api/attendance` — Check-in/out, corrections, reports
- `/api/leaves` — Leave requests, approvals, balance, calendar
- `/api/recruitment` — Candidate pipeline
- `/api/performance` — Performance reviews
- `/api/notifications` — In-app notifications
- `/api/reports` — Export-ready report data
- `/api/admin` — Health, audit logs, system info

## Seed credentials

After `npm run seed` **or** on first `npm run dev` (dev auto-bootstrap):

| Email | Password | Role |
|-------|----------|------|
| `admin@noor.om` | `Password123!` | Super Admin |
| `owner1@noor.om` | `Password123!` | Business Owner (seed only) |
| `owner2@noor.om` | `Password123!` | Business Owner (seed only) |

Seed creates: 2 companies, 6 branches (3 each), 30 employees, attendance, leaves, notifications.

### Login returns "Invalid email or password"

1. **Restart the backend** — in development, `ensureDevAdmin()` creates `admin@noor.om` automatically if missing.
2. **Or run** `npm run reset-admin` to upsert the admin user without wiping data.
3. **Or run** `npm run seed` for full demo data (requires working MongoDB connection).

### MongoDB Atlas connection fails (SSL / IP)

In [MongoDB Atlas](https://cloud.mongodb.com) → **Network Access** → add your IP or `0.0.0.0/0` (dev only).

For local dev without Atlas, use Laragon/local MongoDB:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/noor_erp
```

## Response format

**Success:**
```json
{
  "success": true,
  "data": {},
  "meta": { "page": 1, "limit": 20, "total": 100, "totalPages": 5 }
}
```

**Error:**
```json
{
  "success": false,
  "error": { "code": "FORBIDDEN", "message": "..." }
}
```

## Multi-branch isolation

Every query applies tenant filters based on role:

- **super_admin** — all data
- **business_owner** — own company
- **branch_manager** — own branch
- **hr_manager** — company-wide HR
- **employee** — own records only

## Scripts

```bash
npm run dev      # Development with hot reload
npm run build    # Compile TypeScript
npm run start    # Production
npm run seed     # Seed database
npm run lint     # Type check
```

## Documentation

- OpenAPI spec: `openapi.yaml`
- Postman collection: `postman/NOOR-ERP.postman_collection.json`

## Frontend integration

Point the Next.js frontend API client to:

```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
```

The frontend currently uses mock data for layout; connect API calls module by module.
