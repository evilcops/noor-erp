# NOOR Store

Separate customer storefront for NOOR ERP. Uses the **same MongoDB** via the ERP API (`frontend` on port 3000).

## Run

```bash
# Terminal 1 — ERP API + admin
npm run dev

# Terminal 2 — customer store
npm run dev:store
```

- Store UI: http://localhost:3001  
- ERP API: http://localhost:3000/api (proxied by the store app as `/api`)

## Flow

1. Customer sets **delivery location** (GPS or address)
2. API resolves nearest **branch** (delivery cluster, then radius)
3. Shop shows **only that branch’s stock**
4. Register / login / checkout share the ERP customer + sale + delivery pipeline

## Env

See `.env.example`. Point `ERP_API_ORIGIN` at the ERP app.
