# NOOR ERP — Frontend Structure

Located at `frontend/` in the monorepo. Backend API is in `../backend/`.

## Layout

```
frontend/
  app/                 # Next.js App Router
  components/
    common/              # Shared composites
    features/            # Feature modules (template/script/style folders)
    providers/
    ui/                  # Primitives (template/script/style)
  config/
  hooks/
  lib/api/               # Express API client
  types/
  docs/
```

## Component format

See [COMPONENTS.md](./COMPONENTS.md) — each feature uses:

- `index.tsx` — entry
- `template.tsx` — JSX
- `script.ts` / `script.tsx` — logic
- `style.module.css` — scoped styles

## Commands

```bash
cd frontend
npm run dev      # http://localhost:3000
npm run build
```

Set `NEXT_PUBLIC_API_URL=http://localhost:5000/api` in `frontend/.env`.
