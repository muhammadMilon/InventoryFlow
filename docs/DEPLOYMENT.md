# Deployment

Three pieces: **Neon** (database) → **Render** (API) → **Vercel** (web).

Do them in that order. The API needs the database URL, and the web app needs the API URL.

---

## 1. Neon — PostgreSQL

1. Create a project at <https://neon.tech> and a database named `inventoryflow`.
2. From the dashboard, copy **both** connection strings:

   | | Looks like | Used for |
   |---|---|---|
   | Pooled | `postgresql://…@ep-xxx-**pooler**.region.aws.neon.tech/inventoryflow?sslmode=require` | `DATABASE_URL` — the running app |
   | Direct | `postgresql://…@ep-xxx.region.aws.neon.tech/inventoryflow?sslmode=require` | `DIRECT_URL` — `prisma migrate` |

   > **Why both.** Neon's pooler runs in transaction mode, which does not support the session-level operations `prisma migrate` needs (advisory locks, `CREATE` statements outside a transaction). Prisma's `directUrl` exists for exactly this. Using the pooled URL for migrations produces confusing intermittent failures.

3. Apply the schema and seed from your machine:

   ```bash
   cd backend
   # put both URLs in .env first
   npm run db:deploy      # prisma migrate deploy
   npm run db:seed        # 60 days of trading history + demo accounts
   ```

   The seed prints a reconciliation check at the end. If it does not say `ledger balanced: YES`, stop and investigate rather than deploying.

---

## 2. Render — the API

The API is its own repository. Push `backend/` to it first (see [Two repositories](#two-repositories) below).

### Option A — blueprint (recommended)

1. Render → **New** → **Blueprint** → select the API repository.
2. Render reads [`render.yaml`](../backend/render.yaml) and proposes the service.
3. Fill in the values marked `sync: false`:

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | Neon **pooled** URL |
   | `DIRECT_URL` | Neon **direct** URL |
   | `CORS_ORIGINS` | Your Vercel domain, e.g. `https://inventoryflow.vercel.app` |
   | `GEMINI_API_KEY` | From <https://aistudio.google.com/app/apikey> — optional |

   `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` use `generateValue: true`, so Render creates them and they never exist outside it.

4. Deploy. The build runs:

   ```
   npm ci && npx prisma generate && npx prisma migrate deploy && npm run build
   ```

   `migrate deploy` applies **committed migrations only** — it never generates or resets, so a deploy cannot destroy production data.

### Option B — manual service

Root directory `.`, runtime Node, health check path `/health`, then the same build and start commands and the full environment from [`backend/.env.example`](../backend/.env.example).

### Verify

```bash
curl https://your-api.onrender.com/health
```

```json
{ "ok": true, "data": { "status": "healthy", "database": { "connected": true, "latencyMs": 14 }, … } }
```

> **Free tier note.** Render spins a free service down after inactivity, so the first request after an idle period takes ~30 seconds. The frontend shows an "API offline" indicator during that window rather than a blank screen. For a live demo, either warm it before showing anyone, or use a paid instance.

---

## 3. Vercel — the web app

1. Vercel → **Add New** → **Project** → select this repository. It auto-detects Next.js; [`vercel.json`](../vercel.json) supplies the rest.
2. Set the environment variable:

   | Variable | Value |
   |---|---|
   | `NEXT_PUBLIC_API_URL` | `https://your-api.onrender.com/api/v1` |

   Note the `/api/v1` suffix — the client appends paths directly to it.

3. Deploy, then **go back to Render** and set `CORS_ORIGINS` to the Vercel domain you were just given. The API will reject the browser otherwise.

---

## The cross-site cookie problem

This is the step that catches people out, so it gets its own section.

Vercel and Render are **different registrable domains**. The refresh-token cookie is therefore *cross-site*, and a cross-site cookie has two hard requirements:

```
COOKIE_SAMESITE=none
COOKIE_SECURE=true
```

`SameSite=None` without `Secure` is rejected outright by every modern browser — the cookie is silently dropped, `/auth/refresh` returns 401, and the user is bounced to the login page one page-load after signing in. The symptom looks like a broken session; the cause is a cookie flag.

Locally, `localhost:3000` and `localhost:4000` differ only by port, which is *same-site*, so `COOKIE_SAMESITE=lax` works and is the default in `.env.example`.

The other half is CORS. The API sends `credentials: true`, and the spec forbids pairing that with `Access-Control-Allow-Origin: *`. `CORS_ORIGINS` must therefore list exact origins:

```
CORS_ORIGINS=https://inventoryflow.vercel.app,https://inventoryflow-git-main-you.vercel.app
```

Add preview domains explicitly if previews need to reach the live API.

---

## Two repositories

The API deploys independently, so it lives in its own repository. From the monorepo working copy:

```bash
# --- API repo ---
cd backend
git init
git add .
git commit -m "feat: InventoryFlow API"
git branch -M main
git remote add origin https://github.com/muhammadMilon/InventoryFlow-api.git
git push -u origin main

# --- Web repo (repository root; backend/ is gitignored here) ---
cd ..
git init
git add .
git commit -m "feat: InventoryFlow web app"
git branch -M main
git remote add origin https://github.com/muhammadMilon/InventoryFlow.git
git push -u origin main
```

The root `.gitignore` excludes `backend/`, so the two histories never overlap even though the folders are nested during development.

---

## Environment reference

### API (Render)

| Variable | Required | Default | Note |
|---|:---:|---|---|
| `NODE_ENV` | ✓ | `development` | `production` on Render |
| `PORT` | | `4000` | Render injects `10000` |
| `DATABASE_URL` | ✓ | | Neon **pooled** |
| `DIRECT_URL` | | falls back to `DATABASE_URL` | Neon **direct**, for migrations |
| `JWT_ACCESS_SECRET` | ✓ | | ≥ 32 chars; generated by Render |
| `JWT_REFRESH_SECRET` | ✓ | | ≥ 32 chars; generated by Render |
| `ACCESS_TOKEN_TTL` | | `15m` | |
| `REFRESH_TOKEN_TTL_DAYS` | | `7` | |
| `BCRYPT_ROUNDS` | | `12` | |
| `COOKIE_SAMESITE` | | `lax` | **`none`** cross-site |
| `COOKIE_SECURE` | | `false` | **`true`** cross-site |
| `CORS_ORIGINS` | ✓ | `http://localhost:3000` | Comma-separated, exact |
| `RATE_LIMIT_*` | | see `.env.example` | Six knobs |
| `GEMINI_API_KEY` | | empty | Empty → heuristic fallback |
| `GEMINI_MODEL` | | `gemini-2.0-flash` | |
| `AI_CACHE_TTL_SECONDS` | | `300` | |

The API validates all of this with Zod on boot and exits with a readable list if anything is wrong.

### Web (Vercel)

| Variable | Required | Note |
|---|:---:|---|
| `NEXT_PUBLIC_API_URL` | ✓ | Must include `/api/v1` |
| `NEXT_PUBLIC_APP_NAME` | | Cosmetic |

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Signed in, then immediately signed out on reload | Refresh cookie dropped | `COOKIE_SAMESITE=none` **and** `COOKIE_SECURE=true` |
| Browser console: blocked by CORS | Vercel domain not allow-listed | Add it to `CORS_ORIGINS`, exactly, no trailing slash |
| "API offline" badge in the top bar | Render free instance cold-starting | Wait ~30s, or use a paid instance |
| `prisma migrate` hangs or errors on Neon | Using the pooled URL for migrations | Set `DIRECT_URL` to the non-pooled host |
| `Invalid environment configuration` on boot | A required variable is missing | The message lists each field — it is telling the truth |
| Every rate limit trips at once for all users | `trust proxy` not applied | Already set in `app.ts`; confirm no proxy sits in front stripping `X-Forwarded-For` |
| Dashboard renders but every chart is empty | Database has schema but no data | `npm run db:seed` |
| Reconciliation reports drift | Something wrote `stock_levels` outside `applyMovement` | That is a real bug — check for a stray `prisma.stockLevel.update` |

---

## Post-deploy checklist

- [ ] `curl https://api/health` returns `database.connected: true`
- [ ] Sign in as admin on the Vercel URL
- [ ] **Reload the page** — the session survives (proves the cookie flags)
- [ ] Dashboard renders all eight charts with data
- [ ] Place an order; stock decrements on the products page
- [ ] Stock ledger → Reconcile → `balanced`
- [ ] Sign in as staff; the audit-log link is absent and `/audit` says "Admins only"
- [ ] AI page states which engine produced the brief
