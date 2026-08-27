# InventoryFlow — Inventory & Order Management

A multi-warehouse inventory and order management module built around a **ledger-backed stock model**: every unit that moves leaves an append-only record, and the current stock level is always reconcilable against that history.

### ▶ [Open the live app](https://inventory-flow-xi.vercel.app) · [API health check](https://inventoryflow-api-exrk.onrender.com/health)

Sign in with either [seeded demo account](#demo-accounts) — the login page fills them in with one click.

> **First load may be slow.** The API runs on Render's free tier, which sleeps after ~15 minutes of inactivity. The request that wakes it can take up to 50 seconds; everything after that is fast. If the first sign-in appears to hang, that is the cold start, not a failure. Opening the [health check](https://inventoryflow-api-exrk.onrender.com/health) first is a good way to wake it.

---

## Table of contents

- [Repositories](#repositories)
- [What this is](#what-this-is)
- [Quick start](#quick-start)
- [Configuration](#configuration)
- [The three problems worth reading about](#the-three-problems-worth-reading-about)
- [Architecture](#architecture)
- [Data model](#data-model)
- [Security](#security)
- [The AI feature](#the-ai-feature)
- [Frontend notes](#frontend-notes)
- [Testing](#testing)
- [Deployment](#deployment)
- [Trade-offs I made deliberately](#trade-offs-i-made-deliberately)
- [What I would add with more time](#what-i-would-add-with-more-time)

---

## Repositories

The web app and the API are two independent deployables, in two repositories, released on their own cadence.

| Part | Repository | Live | Stack | Hosted on |
|---|---|---|---|---|
| Web app | [muhammadMilon/InventoryFlow](https://github.com/muhammadMilon/InventoryFlow) *(this one)* | [inventory-flow-xi.vercel.app](https://inventory-flow-xi.vercel.app) | Next.js 15 · React 19 · TypeScript · Tailwind v4 · TanStack Query · Zustand · Recharts | Vercel |
| API | [muhammadMilon/InventoryFlow-backend](https://github.com/muhammadMilon/InventoryFlow-backend) | [inventoryflow-api-exrk.onrender.com](https://inventoryflow-api-exrk.onrender.com/health) | Node · Express · TypeScript · **Prisma** · PostgreSQL (Neon) · Zod · JWT | Render |

They are split because they scale and fail differently: the web app is static output on a CDN, the API is a stateful process holding a database connection pool. Coupling them into one deployment would mean redeploying the API to change a chart colour.

This repository contains the web app only. For local full-stack development the API is cloned into `backend/`, and the root scripts (`dev:api`, `db:*`, `test:api`) proxy into it — see [Quick start](#quick-start).

---

## What this is

| Capability | Where it lives |
|---|---|
| Normalised schema: `Product`, `Warehouse`, `StockLevel`, `StockMovement`, `Order`, `OrderItem` | [`prisma/schema.prisma`](https://github.com/muhammadMilon/InventoryFlow-backend/blob/main/prisma/schema.prisma) |
| Race-safe order placement — two orders for the last unit cannot both succeed | [`src/modules/stock/stock.service.ts`](https://github.com/muhammadMilon/InventoryFlow-backend/blob/main/src/modules/stock/stock.service.ts) |
| Every stock change written to an append-only ledger, with the resulting balance | same |
| Zod validation on every request body, query and param | [`src/middleware/validate.ts`](https://github.com/muhammadMilon/InventoryFlow-backend/blob/main/src/middleware/validate.ts) |
| JWT auth with refresh-token rotation, plus `ADMIN`/`STAFF` RBAC | [`src/middleware/auth.ts`](https://github.com/muhammadMilon/InventoryFlow-backend/blob/main/src/middleware/auth.ts) |
| Idempotent order submission — double-click safe | [`src/middleware/idempotency.ts`](https://github.com/muhammadMilon/InventoryFlow-backend/blob/main/src/middleware/idempotency.ts) |
| Rate limiting on login, orders and the AI endpoint | [`src/middleware/rate-limit.ts`](https://github.com/muhammadMilon/InventoryFlow-backend/blob/main/src/middleware/rate-limit.ts) |
| Audit logging of admin stock adjustments | [`src/lib/audit.ts`](https://github.com/muhammadMilon/InventoryFlow-backend/blob/main/src/lib/audit.ts) |
| Live-ish product list (3s polling via TanStack Query) | [`src/lib/queries.ts`](src/lib/queries.ts) |
| Optimistic order creation with rollback | [`src/lib/use-place-order.ts`](src/lib/use-place-order.ts) |
| Eight dashboard visualisations + low-stock alerting | [`src/components/charts/`](src/components/charts/) |
| Gemini-written restock brief with a deterministic fallback | [`src/modules/ai/`](https://github.com/muhammadMilon/InventoryFlow-backend/tree/main/src/modules/ai) |
| Jest + Supertest integration tests, Playwright end-to-end tests | API [`tests/`](https://github.com/muhammadMilon/InventoryFlow-backend/tree/main/tests), web [`tests/`](tests/) |

### Demo accounts

| Role | Email | Password | Can do |
|---|---|---|---|
| Admin | `admin@inventoryflow.dev` | `Admin@12345` | Everything: adjust stock, transfer, manage products, read the audit log, force-regenerate the AI brief |
| Staff | `staff@inventoryflow.dev` | `Staff@12345` | Browse the catalogue, place and cancel orders |

Both are seeded, and the login page fills them in with one click.

---

## Quick start

**Prerequisites:** Node 20+, and a PostgreSQL database. [Neon](https://neon.tech) free tier is what this was built against.

```bash
# 1. Clone both repositories — the API goes into backend/, which is where
#    the root scripts (dev:api, db:*, test:api) expect to find it
git clone https://github.com/muhammadMilon/InventoryFlow.git inventoryflow
cd inventoryflow
git clone https://github.com/muhammadMilon/InventoryFlow-backend.git backend

# 2. Install both halves
npm run setup                 # npm install here + in backend/

# 3. Configure
cp .env.example .env.local
cp backend/.env.example backend/.env
#    → put your Neon connection string in backend/.env as DATABASE_URL
#    → generate the two JWT secrets:
#      node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

# 4. Create the schema and fill it with 60 days of trading history
npm run db:migrate
npm run db:seed

# 5. Run both processes
npm run dev:all               # web on :3000, API on :4000
```

Open <http://localhost:3000> and sign in with either demo account.

### Useful scripts

| Command | What it does |
|---|---|
| `npm run dev:all` | Web + API together, colour-coded output |
| `npm run dev` / `npm run dev:api` | One at a time |
| `npm run db:migrate` | Create/apply migrations |
| `npm run db:seed` | Wipe and rebuild the demo dataset (deterministic) |
| `npm run db:studio` | Prisma Studio |
| `npm run test:api` | Jest + Supertest against the database |
| `npm run test:e2e` | Playwright (boots both servers itself) |
| `npm run typecheck` / `npm run lint` | Static checks |
| `npm run icons` | Regenerate `favicon.ico` + `apple-icon.png` from `src/app/icon.svg` |

### About the seed

`npm run db:seed` does not insert flat rows. It **replays 60 days of trading**: opening stock, ~350 orders spread across four warehouses with a weekly rhythm and a mild growth trend, twice-weekly purchase receipts, ~7% cancellations, and a handful of engineered stock-outs so the alerting and AI paths have something real to work with.

That matters because every chart on the dashboard is derived from the ledger. Random stock numbers with no matching movements would render empty charts and an unreconcilable ledger. Because the script tracks stock in memory and writes it once at the end, the invariant

```
StockLevel.quantity === SUM(StockMovement.quantityDelta)
```

holds by construction — `GET /api/v1/stock/reconcile` returns `balanced: true` on a freshly seeded database, and the seed script asserts it before exiting.

The PRNG is seeded, so the dataset is identical on every run.

---

## Configuration

Both halves fail loudly on bad configuration rather than starting up broken. `backend/src/config/env.ts` parses the whole environment through Zod at boot and exits with the offending variable named, so a mistyped secret crashes the deploy instead of surfacing on the first request that needs it.

**Web app** — `.env.local`, or the Vercel project settings:

| Variable | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | yes | **Absolute** URL of the API including `/api/v1` — e.g. `https://inventoryflow-api-exrk.onrender.com/api/v1`. See the warning below. |
| `NEXT_PUBLIC_APP_NAME` | no | Defaults to `InventoryFlow`. |

**API** — `backend/.env`, or the Render service environment. The full list with commentary is in [`backend/.env.example`](https://github.com/muhammadMilon/InventoryFlow-backend/blob/main/.env.example); the ones that matter for a cross-site deployment:

| Variable | Notes |
|---|---|
| `DATABASE_URL` | Postgres connection string. Use the **pooled** host on Neon. |
| `DIRECT_URL` | Non-pooled host, used by `prisma migrate`. Falls back to `DATABASE_URL`. |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | ≥ 32 chars each, and different from one another. |
| `CORS_ORIGINS` | Comma-separated exact origins. `https://*.vercel.app` matches one subdomain label, which covers preview deployments. |
| `COOKIE_SAMESITE` | `none` when the web app is on a different domain to the API, `lax` for same-origin/local. |
| `COOKIE_SECURE` | `true` in production. `SameSite=None` without `Secure` is rejected by every modern browser. |
| `GEMINI_API_KEY` | Optional. The restock endpoint falls back to a deterministic engine when empty. |

> **Two deployment footguns, both of which fail silently.**
>
> **A blank `NEXT_PUBLIC_API_URL` is worse than a missing one.** `NEXT_PUBLIC_*` values are inlined at build time, and a variable that exists but is empty compiles to `''` — which survives `??`, because it is neither `null` nor `undefined`. Every call then resolves against the web app's own origin, so `POST /auth/login` hits Vercel instead of the API and comes back as the Next.js 404 *HTML* page. The build looks clean and the site looks up. `resolveBaseUrl()` in [`src/lib/api.ts`](src/lib/api.ts) treats blank as unset, and the client rejects any non-JSON response with a message naming the variable, rather than rendering markup into an error banner.
>
> **A missing origin in `CORS_ORIGINS` must not be a 500.** The `cors` package forwards `callback(new Error(...))` to Express as a request failure, which turns every preflight from an unlisted origin — including `OPTIONS /auth/login` — into `500 INTERNAL_ERROR`. That reads as a broken server rather than a missing config line. [`backend/src/lib/cors.ts`](https://github.com/muhammadMilon/InventoryFlow-backend/blob/main/src/lib/cors.ts) returns `callback(null, false)` instead, so the response simply carries no `Access-Control-Allow-Origin` and the browser reports the real reason, while the API logs the exact origin string that needs adding.

---

## The three problems worth reading about

Everything else in this codebase is ordinary CRUD. These three are where the real decisions are.

### 1. Two orders for the last unit

The obvious implementation is read-then-write:

```ts
const level = await tx.stockLevel.findUnique({ ... })
if (level.quantity < qty) throw insufficientStock()
await tx.stockLevel.update({ data: { quantity: level.quantity - qty } })
```

Two concurrent orders for the last unit both read `quantity = 1`, both pass the check, and both write `0`. Stock is oversold and the ledger no longer reconciles. Wrapping it in a transaction does not help — READ COMMITTED lets both snapshots see the same value.

The fix is to make the check and the decrement **one statement**:

```sql
UPDATE stock_levels
   SET quantity = quantity + $delta
 WHERE "productId" = $1 AND "warehouseId" = $2
   AND quantity + $delta >= reserved
RETURNING quantity
```

Postgres takes a row lock for the duration of the `UPDATE`. The second transaction blocks, then re-evaluates its `WHERE` against the *committed* new value, matches zero rows, and the order is rejected. `RETURNING quantity` hands back the post-update balance for the ledger entry while still holding the lock, so the balance recorded can never be stale.

Three supporting details:

- **Deadlock avoidance.** Order lines are sorted by `productId` before any row is touched, so two concurrent multi-line orders always take locks in the same sequence. Without it, order A (P1 then P2) and order B (P2 then P1) deadlock. Postgres would detect and kill one, but a deterministic lock order avoids the round trip entirely.
- **Retries.** Anything Postgres still rejects as a serialization failure (`P2034`, SQLSTATE `40001`/`40P01`) is retried with full-jitter backoff by `withRetry`.
- **The pre-flight check is not the safety net.** There *is* a non-locking availability check before the transaction, but it exists purely so a multi-line failure can report every shortfall at once instead of just the first. If stock disappears between that check and the transaction, the atomic `UPDATE` still rejects the order.

Proven by [`tests/orders.test.ts`](https://github.com/muhammadMilon/InventoryFlow-backend/blob/main/tests/orders.test.ts): 30 concurrent single-unit orders against 20 units of stock yield **exactly 20 × 201 and 10 × 409**, with final stock at 0 and the ledger balanced.

### 2. The double-click

A naive idempotency check ("look up the key; if it is missing, carry on") still double-charges when two clicks land in the same millisecond — both lookups miss before either writes.

So the key is **claimed first**, with an `INSERT` guarded by a `(key, scope)` unique index. Exactly one racer wins:

- **Winner** — writes a placeholder row (`statusCode: 0`), runs the handler, then patches the row with the real status and response body.
- **Loser** — hits the unique violation. If the winner has finished, its stored response is replayed verbatim, with an `Idempotent-Replay: true` header. If it is still in flight, the client gets `409 IDEMPOTENT_REPLAY_IN_PROGRESS`.

A key replayed with a *different* body is rejected outright — that is a client bug, and silently returning the first response would hide it. A key whose request **failed** is released, so a genuine retry works.

The frontend generates one key per basket-submission attempt and keeps it across retries, only retiring it once an order actually succeeds.

### 3. Optimistic UI that has to be able to lie

The order form updates the cache before the server responds, because that is what happens 99% of the time and waiting on a round trip makes the app feel slow.

The 1% is real here — two staff can race for the last unit, and the loser's optimistic decrement was a lie. So [`use-place-order.ts`](src/lib/use-place-order.ts) snapshots **every** cache entry it touches (stock levels, product lists, order lists) before mutating, and `onError` restores all of them byte-for-byte. The user then sees the server's actual reason — *"Not enough stock for Nimbus Wireless Keyboard: requested 2, available 1"* — not a generic failure.

`onSettled` invalidates regardless of outcome, so the optimistic guess is always replaced by server truth rather than lingering as an approximation.

---

## Architecture

```
┌──────────────────────────────┐        ┌──────────────────────────────────┐
│  Next.js 15 (App Router)     │        │  Express + TypeScript            │
│  Vercel                      │        │  Render                          │
│                              │        │                                  │
│  app/         routes         │  HTTPS │  routes/    validation + RBAC    │
│  components/  UI + charts    │ ─────▶ │  services/  business logic       │
│  lib/         api, queries   │  JSON  │  lib/       prisma, auth, audit  │
│  store/       zustand        │        │  middleware/                     │
└──────────────────────────────┘        └───────────────┬──────────────────┘
        Bearer access token                             │ Prisma
        httpOnly refresh cookie                         ▼
                                              ┌──────────────────────┐
                                              │  PostgreSQL (Neon)   │
                                              └──────────────────────┘
```

**Why two deployments rather than Next.js API routes.** Order placement holds row locks inside a transaction and retries on write conflict. That wants a long-lived process with a warm connection pool, not a serverless function that may cold-start mid-transaction and thrash Postgres connection limits. Splitting them also means the API can be consumed by something that is not this web app — a stock-take handheld, a supplier integration — without refactoring.

**Layering inside the API.** Routes validate and authorise; services own business logic and transactions; `lib/` holds shared infrastructure. A route handler never touches Prisma directly, and a service never touches `req`/`res` — which is why the services are testable without HTTP and the same `applyMovement` backs orders, adjustments and transfers alike.

**One chokepoint for stock.** Nothing writes `stock_levels` except `applyMovement`. That single funnel is what makes the reconciliation endpoint meaningful: if levels ever disagree with the ledger, something bypassed the funnel, and that is a bug worth failing loudly over. There is a test that mutates a level directly and asserts the reconciler catches it.

---

## Data model

```
User ──< Order ──< OrderItem >── Product ──< StockLevel >── Warehouse
 │         │                        │            │              │
 │         └──< StockMovement >─────┴────────────┴──────────────┘
 └──< AuditLog                       (append-only ledger)
```

Seven decisions worth defending:

1. **Stock is never a column on `Product`.** A product exists in many warehouses, so quantity belongs to the `StockLevel` join entity, uniquely keyed by `(productId, warehouseId)`. That normalisation is what lets the atomic decrement target exactly one row.
2. **`StockMovement` stores both a signed delta and the resulting balance.** The delta alone would be enough to replay history; storing `balanceAfter` too means the ledger can be *reconciled* against live levels rather than merely trusted, and any row can be read in isolation.
3. **`OrderItem` snapshots `unitPrice`.** Product prices change; invoices do not. Joining to the live price would silently rewrite historical orders.
4. **Money is `Decimal(12,2)`, never a float.** `0.1 + 0.2` is not `0.3`, and an inventory system that rounds wrongly is worse than useless.
5. **`reserved` on `StockLevel`.** Available stock is `quantity - reserved`, and the atomic guard is `quantity + delta >= reserved`, not `>= 0`. Held stock for confirmed-but-unshipped orders can never be sold twice. The reservation *workflow* is not built out (see [what I would add](#what-i-would-add-with-more-time)) but the column and the guard are, so adding it does not require a migration to the hot path.
6. **Cancellation writes compensating entries.** It never edits or deletes the original `OUTBOUND` rows. An append-only ledger stays append-only, so "why is this number what it is?" always has a complete answer.
7. **Order numbers come from an `OrderSequence` row, not `COUNT(*)`.** A count sees only *committed* rows, so every order placed in the same instant derives the same number and all but one lose the unique-index race — and retrying re-reads the same count, so it never converges. A single `INSERT … ON CONFLICT DO UPDATE … RETURNING` allocates atomically instead. Measured before the fix: 30 concurrent orders against 20 units yielded 8 successes rather than 20 — nothing oversold, but twelve valid orders lost to a numbering artefact. ([ADR-015](docs/ARCHITECTURE.md))

Full schema with commentary: [`prisma/schema.prisma`](https://github.com/muhammadMilon/InventoryFlow-backend/blob/main/prisma/schema.prisma).

---

## Security

| Concern | Approach |
|---|---|
| Password storage | bcrypt, cost 12 (configurable). Never logged, never serialised — asserted by a test. |
| Account enumeration | Wrong password and unknown email return an identical code and message. The unknown-email path runs a dummy bcrypt compare so the timing matches. |
| Session | 15-minute access JWT in memory (`Authorization: Bearer`), never in `localStorage`. Refresh token in an `httpOnly`, `SameSite`-configurable cookie scoped to `/api/v1/auth`. |
| Refresh tokens | Stored as SHA-256 hashes, so a database dump cannot be replayed as a session. Rotated on every use; presenting an already-revoked token revokes **every** session for that user, on the assumption it was stolen. |
| Token refresh races | The client shares a single in-flight refresh promise. Without it, five simultaneous 401s would fire five rotations and log the user out. |
| RBAC | `requireAuth` then `requireRole('ADMIN')` composed at the route definition, so the policy is visible where the route is declared. Enforced server-side — the frontend guard decides what to *render*, never what may be *read*. |
| Privilege escalation | Self-registration silently downgrades `role: "ADMIN"` to `STAFF`. |
| Input validation | Zod on body, query and params; the parsed output *replaces* the raw request, so handlers never see unvalidated `any`. |
| Rate limiting | Login: 5 / 15 min keyed on **IP + email** (one attacker cannot lock out a NAT; a botnet cannot spread attempts against one account). Orders: 30 / min per user. AI: 10 / min per user. Global: 300 / min per IP. |
| Audit trail | Admin stock adjustments write the ledger entry *and* the audit row **in the same transaction** — a stock correction cannot exist without a trace of who made it, with before/after values, IP and user agent. Failed logins are recorded too. |
| Error leakage | A single error handler maps throwables to stable machine codes. Stack traces and driver messages never reach a production client. |
| Transport | Helmet, explicit CORS allow-list (no wildcard with credentials), `trust proxy` so rate limiting sees real client IPs behind Render's proxy. |

---

## The AI feature

`GET /api/v1/ai/restock-recommendation` returns a natural-language restock brief.

**The design rule: the model writes prose, arithmetic stays in code.**

Reorder quantities, days of cover and urgency are computed deterministically from the ledger. Gemini receives those numbers and is asked only to prioritise and explain them. An LLM asked to "work out how much to order" will occasionally invent a plausible-looking number, and in an inventory system a hallucinated purchase order is a real cost. The system prompt states the figures are authoritative, and the response merge only allows the model to replace *rationale text* — never a quantity.

Other decisions:

- **Direct `fetch`, not the vendor SDK.** One call, a stable request shape, no extra dependency or transitive supply-chain surface, and an explicit `AbortController` timeout — an LLM call must never hang an HTTP worker.
- **Graceful degradation.** No API key, a 5xx from Google, a timeout, or a malformed response all fall through to a deterministic template engine over the *same* computed signals, returned with `source: "heuristic"` and a `degradedReason`. The endpoint never 500s because an upstream is down, and the UI says plainly which engine produced the text.
- **Cached and rate limited.** Responses cache for 5 minutes and the endpoint allows 10 requests/minute/user, because every cache miss is billable and a polling dashboard should not pay for one on every tick.

---

## Frontend notes

**Data fetching.** TanStack Query throughout. Product and stock views poll every 3 seconds — fast enough that two people working the same warehouse see each other's effect before they try to sell the same unit, slow enough not to hammer the API. Polling pauses when the tab is hidden. Retry is disabled for 401/403/404/409/429 — those fail identically on retry.

**State.** Zustand for two things only: the session (no `persist` — persisting a token to `localStorage` is the exact XSS footgun the httpOnly-cookie design avoids) and the cart (persisted, so a refresh mid-order does not lose the basket). Prices in the cart are display-only; the server re-reads every unit price from the database when the order is placed, so a tampered `localStorage` entry cannot change what a customer is charged.

**Charts.** Eight visualisations, all Recharts, all fed from the same ledger the write path maintains. The categorical palette is fixed-order and validated for colour-vision deficiency (worst adjacent CVD ΔE 9.1, normal-vision ΔE 19.6 against a white surface). Deliberate constraints:

- **No dual-axis charts anywhere.** Revenue and order count are different scales; the crossing point of two independently-scaled lines is an artefact of the axis ranges, not a fact about the business. Revenue is plotted; orders and units live in the tooltip.
- **Status colours are reserved.** Good/warning/serious/critical never double as "series 4", and every status badge carries an icon and a word so it survives greyscale and colour-blindness.
- **Every chart has a table view.** It is the accessible fallback, the answer to "what was the exact number", and the relief the palette owes for slots that sit under 3:1 contrast on white.
- **Outbound movement is plotted negative** about a zero baseline, so "more out than in" is something you see rather than compute.
- **Days-of-cover carries a lead-time reference line.** That single line turns a ranking into a decision: anything to its left cannot be replenished before it hits zero.

**Design.** White surfaces, warm neutrals, one orange accent (`#eb6834`) — which is literally the same hex as categorical series slot 1, so a primary button and a bar in a chart are the same colour and the product reads as one system. Committed light mode; see [trade-offs](#trade-offs-i-made-deliberately).

**Loading and error states.** Every view has a skeleton, an empty state and an error state. Errors are described specifically — a network failure, a 403 and a rate limit each say something different, because "Something went wrong" tells the user nothing about whether to retry, sign in again, or call an admin.

---

## Testing

```bash
cp backend/.env.test.example backend/.env.test   # once — point it at a throwaway DB
npm run db:push:test --prefix backend            # once — create that schema
npm run test:api                                 # Jest + Supertest
npm run test:e2e                                 # Playwright — boots both servers itself
```

**Why the separate `.env.test`.** The integration suite truncates every table
between files, so it must never inherit `backend/.env`. `backend/tests/setup.ts` loads
`.env.test` *first* and falls back to `.env` only for anything it does not
define. The example points at a dedicated `inventoryflow_test` **schema** on the
same server, which is enough isolation to keep your seeded development data
while needing no second database. Raw SQL is schema-qualified from that
`schema=` parameter (see `DB_SCHEMA` in `backend/src/lib/prisma.ts`), so the ORM
and the raw statements address the same tables.

**Integration (Jest + Supertest, ~45 tests).** Real Express app, real Postgres, no mocks. The tests that carry their weight:

- 30 concurrent orders against 20 units → exactly 20 succeed, 10 are rejected, stock lands at 0, ledger balances.
- Two simultaneous orders for one unit → `[201, 409]`, never `[201, 201]`.
- One short line rolls back the whole order — the line that *could* have succeeded must not have.
- Same idempotency key twice → one order, `Idempotent-Replay: true` on the second.
- Same key on two simultaneous requests → one order.
- Same key, different body → `409 IDEMPOTENCY_KEY_REUSED`.
- Key released after failure, so a genuine retry works.
- Refresh tokens are stored hashed; the raw value never appears in the table.
- Wrong password and unknown email are indistinguishable.
- Staff blocked from adjust / transfer / create-product / audit-log / status-change, and the rejection is total — nothing moved.
- After a mixed workload (adjust → order → transfer → cancel → stock take) the reconciler reports balanced; mutating a level directly makes it report the drift.

**End-to-end (Playwright).** Against the real stack — the parts most likely to break are the seams. Covers sign-in and redirect-to-intended-destination, session survival across a reload (proving the httpOnly refresh flow), the full order-placement journey with stock visibly decrementing, the optimistic loading state, **rollback on a forced 409**, the `Idempotency-Key` header actually being sent, RBAC affordances differing by role, all eight dashboard charts rendering, the chart table view, mobile layout with no horizontal body scroll, and a two-browser-context race for the last unit.

The e2e suite is `workers: 1` on purpose: parallel workers share one database and would fight over stock.

---

## Deployment

Full walkthrough: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md). Summary:

**API → Render.** [`render.yaml`](https://github.com/muhammadMilon/InventoryFlow-backend/blob/main/render.yaml) is a blueprint: point Render at the API repo and it provisions the service. Build runs `prisma migrate deploy` — committed migrations only, never `reset`, so a deploy cannot destroy data. JWT secrets are generated by Render, so they never exist outside it. Health check on `/health`. A `Dockerfile` is included as an alternative runtime — non-root user, `tini` for signal forwarding so the graceful shutdown in `server.ts` actually runs on redeploy.

**Web → Vercel.** Set `NEXT_PUBLIC_API_URL` to the Render URL **plus `/api/v1`** — the whole base path, absolute, no trailing slash. Because it is inlined at build time, changing it requires a redeploy, not just a restart. See the footguns under [Configuration](#configuration).

**The cross-site cookie detail that catches people out.** Vercel and Render are different registrable domains, so the refresh cookie is cross-site. It needs `COOKIE_SAMESITE=none` **and** `COOKIE_SECURE=true` — `SameSite=None` without `Secure` is rejected by every modern browser. And `CORS_ORIGINS` must list the Vercel domain, because `Access-Control-Allow-Origin: *` is illegal alongside `credentials: true`; the API matches the allow-list and echoes back one exact origin, so `https://*.vercel.app` is a legal *pattern* even though it is never a legal *response*.

**Verifying a deployment.** Three checks, in order — each one isolates a different layer:

```bash
# 1. Is the API alive and connected to its database?
curl https://inventoryflow-api-exrk.onrender.com/health

# 2. Does it accept the browser origin? Expect 204 and an
#    Access-Control-Allow-Origin echoing the origin back.
curl -i -X OPTIONS https://inventoryflow-api-exrk.onrender.com/api/v1/auth/login \
  -H "Origin: https://inventory-flow-xi.vercel.app" \
  -H "Access-Control-Request-Method: POST"

# 3. Is the web app actually pointed at the API? Expect JSON, not HTML —
#    HTML means NEXT_PUBLIC_API_URL is blank or wrong and the app is
#    calling its own origin.
curl -i -X POST https://inventoryflow-api-exrk.onrender.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@inventoryflow.dev","password":"Admin@12345"}'
```

---

## Trade-offs I made deliberately

**Polling, not WebSockets.** The brief asked for "real-time-ish". A 3-second poll delivers that in a few lines of TanStack Query config, with no connection lifecycle, no reconnection logic, no sticky-session requirement, and no second scaling axis. At warehouse-operator scale (tens of concurrent users) the cost is negligible. The moment this needs to be genuinely real-time, the answer is server-sent events on the stock stream, not a socket for everything.

**Stock reservation modelled but not workflowed.** The `reserved` column and the `quantity - reserved` guard exist and are enforced. What is missing is the *workflow* that populates it: a basket that holds stock for N minutes. That is a scheduler and an expiry sweep — meaningful scope for a feature nothing in the brief asked for. Building the column now means adding it later is a feature, not a migration of the hot path.

**Committed light mode.** The brief specified white with light orange. A dark palette is not a colour flip — it is a second set of validated steps for every token and every chart series. Shipping one properly costs more than it returns for an internal ops tool, and shipping one badly is worse than not having it. The tokens are structured so the dark set drops into one place when it is wanted.

**Hand-maintained API types on the frontend.** The API is a separate repository and deployment; codegen would couple the two build pipelines for a surface that is small and stable. If the API grew past ~30 endpoints I would generate an OpenAPI document from the Zod schemas and derive types from that.

**Two derived queries sort in memory.** `sortBy=totalStock` and `lowStockOnly` are computed per product across warehouses, so they cannot be an `ORDER BY` without a join and aggregate. Page-sized result sets make in-memory sorting cheap and keep the query readable. This is flagged in the code and is the first thing I would revisit past a few thousand SKUs.

**A single tax rate constant.** Real VAT is per-product and per-jurisdiction. A constant keeps invoices reproducible and the demo honest; a tax-rules engine is not what this task is testing.

**No soft deletes.** Products archive via `isActive` and orders cancel via status. Nothing is hard-deleted, so no soft-delete framework is needed.

---

## What I would add with more time

**Correctness and operations**
- Nightly reconciliation as a scheduled job that pages on drift, instead of an endpoint someone has to remember to press.
- A `pg_advisory_xact_lock` fast path for the highest-contention SKUs, if profiling showed lock waits mattering.
- Outbox table + worker for side effects (order-confirmation email, supplier webhooks), so they cannot fail inside the order transaction.

**Product**
- Reservation workflow: hold stock for the duration of a checkout, expire it on a sweep.
- Purchase orders as first-class records, so the AI brief writes a draft PO rather than a recommendation someone retypes.
- Batch/lot and expiry tracking with FEFO picking — the ledger already has the shape for it.
- CSV import/export for stock takes, which is how this work actually gets done in a warehouse.

**Engineering**
- OpenAPI generated from the Zod schemas, with a typed client generated for the frontend.
- Structured metrics (order latency, retry counts, oversell attempts blocked) to Grafana; the correlation id is already threaded through every log line.
- Load test of the concurrency path with k6 at a few hundred RPS to find where retry backoff stops absorbing conflicts.
- Visual regression tests on the dashboard, which is where a chart silently rendering empty is easiest to miss.

---

## Repository layout

```
inventoryflow/                   ← this repo: the web app only
├── .github/workflows/ci.yml     typecheck · lint · build · Playwright
├── docs/
│   ├── ARCHITECTURE.md          deeper design notes
│   ├── API.md                   endpoint reference
│   └── DEPLOYMENT.md            Render + Vercel + Neon walkthrough
├── public/
│   └── favicon.ico              generated — 16/32/48, for /favicon.ico requests
├── scripts/
│   └── generate-icons.mjs       rasterises icon.svg → favicon.ico + apple-icon
├── src/
│   ├── app/                     App Router: (auth) and (dashboard) groups
│   │   ├── icon.svg             the mark; source of truth for every icon
│   │   └── apple-icon.png       generated — 180×180 for iOS
│   ├── components/
│   │   ├── charts/              chart kit + eight visualisations
│   │   ├── layout/              sidebar, topbar, brand
│   │   └── ui/                  button, card, field, table, modal, feedback…
│   ├── lib/                     api client, query hooks, formatters
│   ├── store/                   auth + cart (Zustand)
│   └── types/                   API wire types
├── tests/                       Playwright end-to-end
└── vercel.json
```

The API is not in this tree. It is its own repository — [muhammadMilon/InventoryFlow-backend](https://github.com/muhammadMilon/InventoryFlow-backend), deployed to Render — with `prisma/`, `src/{config,lib,middleware,modules}`, its Jest suite, `render.yaml` and a `Dockerfile`. For local full-stack work it is cloned into `backend/`; see [Quick start](#quick-start).

### Icons

`src/app/icon.svg` is the only hand-edited icon: the same stacked-crate glyph as the in-app wordmark in [`src/components/layout/brand.tsx`](src/components/layout/brand.tsx), so the browser tab and the sidebar can never drift apart. `npm run icons` regenerates `public/favicon.ico` and `src/app/apple-icon.png` from it. Next.js picks up `icon.svg` and `apple-icon.png` by file convention and emits the `<link>` tags itself.

---

Built by **Muhammad Milon** as a skill assessment.
