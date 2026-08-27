# Architecture decisions

Short records of the choices that were not obvious, and what the alternative would have cost. The [root README](../README.md) covers the system tour; this file is the reasoning.

---

## ADR-001 — Stock lives on a join entity, not on `Product`

**Decision.** Quantity is stored on `StockLevel`, uniquely keyed by `(productId, warehouseId)`. `Product` has no quantity column.

**Why.** A product exists in many warehouses simultaneously. A `Product.quantity` column would have to be a denormalised sum, which introduces two failures at once: it is wrong the moment two sites ship concurrently, and it forces every decrement to lock the product row — turning unrelated warehouses into contention on the same lock.

The normalised form makes the atomic decrement target exactly one row, which is what the whole concurrency strategy rests on.

**Cost.** Queries that want a product-wide total need an aggregate. Two frontend sorts (`totalStock`, `lowStockOnly`) are computed in memory over a page-sized result rather than in SQL. Flagged in the code; revisit past a few thousand SKUs.

---

## ADR-002 — Conditional `UPDATE … RETURNING`, not read-then-write

**Decision.** All stock changes go through one raw statement inside a transaction:

```sql
UPDATE "<schema>".stock_levels SET quantity = quantity + $delta
 WHERE "productId" = $1 AND "warehouseId" = $2 AND quantity + $delta >= reserved
RETURNING quantity
```

The table name is schema-qualified from the `schema=` parameter of
`DATABASE_URL` via the `table()` helper — see ADR-014.

**Alternatives considered.**

| Approach | Why not |
|---|---|
| Read, check, write in a transaction | Oversells under READ COMMITTED — both transactions read the same value. This is the bug the brief is asking about. |
| `SELECT … FOR UPDATE` then write | Correct, but two round trips per line while holding a lock. The conditional `UPDATE` does the same work in one. |
| `SERIALIZABLE` isolation | Correct, but pushes every conflict into a retry loop. Under a burst of orders for one popular SKU that is a retry storm; row-level blocking degrades far more gracefully. |
| Optimistic locking with a `version` column | Correct, but every loser must retry client-side, and the extra column buys nothing the row lock does not already give. |
| Application-level mutex / queue | Serialises unrelated products, and does not survive more than one API instance. |

**Consequence.** Correct under arbitrary concurrency without table locks. `RETURNING` yields the post-update balance *while the lock is held*, so the balance written to the ledger can never be stale.

**Cost.** One raw SQL statement inside an otherwise Prisma-typed service. Confined to a single well-commented function, and covered by the concurrency tests.

---

## ADR-003 — Deterministic lock ordering

**Decision.** Order lines are sorted by `productId` before any row is touched.

**Why.** Order A locks P1 then P2 while order B locks P2 then P1 — a textbook deadlock. Postgres detects it and kills one transaction, so nothing is *corrupted*, but the victim eats a failed round trip and a retry. Sorting removes the cycle entirely rather than relying on the deadlock detector to clean up.

**Cost.** One `sort` per order. Nothing.

---

## ADR-004 — Claim-then-settle idempotency

**Decision.** The idempotency key is claimed with a unique-index-guarded `INSERT` *before* the handler runs, then patched with the response.

**Why.** Check-then-proceed has the same shape as the oversell bug: two requests both find no key and both proceed. Since the whole point is surviving a double-click, and a double-click is precisely two near-simultaneous requests, the naive version fails in the exact case it exists for.

**Consequence.** Three outcomes instead of two — replay, in-progress, or fresh — so clients must handle `409 IDEMPOTENT_REPLAY_IN_PROGRESS`. That is honest: something *is* still running.

**Cost.** One extra write per keyed request, and a purge job for expired keys.

---

## ADR-005 — Split deployment, not Next.js API routes

**Decision.** Express on Render for the API; Next.js on Vercel for the web app; separate repositories.

**Why.** Order placement holds row locks inside a transaction and retries on write conflict. That wants a long-lived process with a warm connection pool. Serverless functions cold-start, can be killed mid-invocation, and multiply Postgres connections in a way that fights a transactional hot path — Neon's pooler helps, but the impedance mismatch is real.

Splitting also means the API can serve something that is not this web app — a stock-take handheld, a supplier integration — without refactoring, and the two halves scale and deploy on their own schedules.

**Cost.** Two deployments, CORS configuration, and a cross-site cookie that needs `SameSite=None; Secure`. Documented in [DEPLOYMENT.md](./DEPLOYMENT.md), which is where that cost gets paid.

---

## ADR-006 — Access token in memory, refresh token in an httpOnly cookie

**Decision.** The 15-minute access token lives in a module-scoped variable. The refresh token is an `httpOnly` cookie scoped to `/api/v1/auth`, stored server-side as a SHA-256 hash and rotated on every use.

**Why.** `localStorage` is readable by any injected script, and a stolen token there is valid for its full lifetime. A variable dies with the tab. The durable half of the session sits behind `httpOnly`, which script cannot read at all. On reload the app calls `/auth/refresh` and gets a fresh access token from that cookie.

Hashing the refresh token means a database dump cannot be replayed as a session. Rotation means a stolen token is single-use — and re-presenting a revoked token revokes *every* session for that user, because the most likely explanation is theft.

**Cost.** One extra request on cold load, and a single-flight guard on the client so five simultaneous 401s do not fire five rotations and log the user out. Both are small; the alternative is a token sitting in `localStorage`.

---

## ADR-007 — The ledger stores `balanceAfter` as well as the delta

**Decision.** Each `StockMovement` records both the signed change and the resulting quantity.

**Why.** The delta alone is enough to replay history. Storing the balance too makes the ledger *reconcilable* — `SUM(quantityDelta)` must equal `StockLevel.quantity`, and any single row can be read in isolation without walking the whole history. `GET /stock/reconcile` turns "the ledger is the source of truth" from an aspiration into an assertion, and there is a test that mutates a level directly and confirms the reconciler catches it.

**Cost.** Four bytes per row, and a discipline: nothing may write `stock_levels` except `applyMovement`. That is enforced by convention and by the reconciliation test, not by the database. A trigger or a revoked `UPDATE` grant would enforce it harder; that felt like the right next step rather than the right first one.

---

## ADR-008 — Cancellation compensates, never edits

**Decision.** Cancelling an order writes new `INBOUND` entries with reason `ORDER_CANCELLED`. The original `OUTBOUND` rows are untouched.

**Why.** An append-only ledger that is sometimes edited is not an append-only ledger. Compensation keeps "why is this number what it is?" answerable in full, which is the entire reason for having a ledger rather than a quantity column.

**Cost.** Twice the rows for a cancelled order, and the ledger shows churn that a naive reader might mistake for real movement. The movement `reason` is what disambiguates, and it is displayed everywhere the ledger is.

---

## ADR-009 — The LLM writes prose; arithmetic stays in code

**Decision.** Reorder quantities, days of cover and urgency are computed deterministically from the ledger. Gemini receives those numbers and may only replace the *rationale text*.

**Why.** An LLM asked to compute a purchase quantity will occasionally produce a plausible-looking wrong number. In an inventory system that is a real cost — someone orders 500 units of something that needed 50. Keeping arithmetic in code means every figure a buyer sees is reproducible from the database, with or without the model, and the feature degrades to something still useful when the model is unavailable.

**Cost.** The model cannot surprise you with an insight the heuristic missed. For a restock brief, predictability is worth more than that.

---

## ADR-010 — Polling, not WebSockets

**Decision.** TanStack Query polls stock and product views every 3 seconds. Polling pauses when the tab is hidden.

**Why.** The brief asked for "real-time-ish". Polling delivers that in a few lines of config with no connection lifecycle, no reconnection logic, no sticky sessions, and no second scaling axis on a free-tier host. At warehouse-operator scale the request cost is negligible.

**When this stops being right.** Hundreds of concurrent viewers, or a requirement for sub-second propagation. The answer then is server-sent events on the stock stream specifically — not a socket layer for everything.

---

## ADR-011 — Direct `fetch` for Gemini, not the vendor SDK

**Decision.** One `fetch` call against the REST endpoint.

**Why.** A single call with a stable request shape. The SDK adds a dependency and its transitive tree for no behaviour we need, and wrapping it in an `AbortController` timeout — mandatory, since an LLM call must never hang an HTTP worker — is more direct without it.

**Cost.** Request/response shapes are hand-typed and would need updating if the API changed. Confined to one file.

---

## ADR-012 — Committed light mode

**Decision.** One theme: white surfaces, warm neutrals, a single orange accent.

**Why.** The brief specified white with light orange. A dark mode is not a colour inversion — it is a second set of validated steps for every token and every chart series, re-checked for contrast and colour-vision separation against a dark surface. Shipping one properly costs real time; shipping one badly is worse than not having it.

**Cost.** Users who prefer dark do not get it. The tokens are structured so the dark set drops into one place, which is where it would go.

---

## ADR-013 — Hand-maintained API types on the client

**Decision.** `src/types/api.ts` is written by hand.

**Why.** The API is a separate repository and deployment. Codegen would couple the two build pipelines for a surface that is small and stable.

**When this stops being right.** Past roughly 30 endpoints, or the first time a wire-shape change ships broken. The fix then is an OpenAPI document generated from the Zod schemas, with the client type generated from that — one source of truth rather than two that agree by discipline.

---

## ADR-014 — Raw SQL is schema-qualified, not `search_path`-dependent

**Decision.** Every `$queryRaw` table reference goes through `table('name')`,
which renders `"<schema>"."name"` from the `schema=` parameter of
`DATABASE_URL`.

**Why.** Prisma schema-qualifies the SQL *it* generates, but `$queryRaw` is sent
verbatim and resolves against the session `search_path`, which Postgres defaults
to `"$user", public`. Deploy the app into any non-`public` schema — a shared
database, a per-environment schema, the `?schema=` the test environment uses —
and the ORM and the raw statements silently address two *different* tables:
`applyMovement` decrements a row in `public` while the availability checks and
the reconciler read the configured schema. Stock drifts, the ledger never
balances, and nothing throws. This was a real defect, found by pointing the test
suite at its own schema.

**Alternatives considered.**

| Approach | Why not |
|---|---|
| `options=-c search_path=…` in the connection URL | Tidier, but transaction poolers — PgBouncer, and therefore Neon's pooled endpoint — reject it as an unsupported startup parameter. Rules itself out on the deployment target. |
| `SET search_path` per connection | Prisma offers no connection-open hook, and a pooled connection can be handed to another query between statements. |
| Just assume `public` | Works until it doesn't, and fails silently rather than loudly. |

**Consequence.** The schema is validated against a plain-identifier regex at
boot and interpolated with `Prisma.raw`, which does not parameterise. That is
safe only because the value comes from deployment config and never from a
request — stated explicitly at the call site.

---

## ADR-015 — Order numbers from an atomic counter, not `COUNT(*)`

**Decision.** `ORD-YYYYMMDD-NNNN` draws its sequence from a single statement
against `order_sequences`:

```sql
INSERT INTO order_sequences AS seq (day, value, "updatedAt")
     VALUES ($1, 1, NOW())
ON CONFLICT (day) DO UPDATE SET value = seq.value + 1, "updatedAt" = NOW()
  RETURNING value
```

**Why.** Deriving it from `COUNT(*)` of today's orders reads only *committed*
rows, so every order placed in the same instant derives the same number and all
but one lose the unique-index race. Retrying cannot converge either, because
each retry re-reads the same count. Measured: 30 concurrent orders against 20
units produced 8 successes instead of 20 — no oversell, but twelve valid orders
lost to a numbering artefact.

**Why outside the order transaction.** Allocating inside it would hold the
counter row lock until commit, serialising every placement for the day behind
the slowest one. Outside, the lock lasts microseconds.

**Consequence.** A number is consumed even if the order it was minted for rolls
back, so the series can contain gaps. That is the right trade: an order number
is an identifier, and the audited no-gap record is the ledger.

---

## ADR-016 — Pool exhaustion is backpressure, not an error

**Decision.** Prisma's `P2024` is in the retryable set alongside the
serialization codes, and if the retry budget is spent it surfaces as
`503 SERVICE_UNAVAILABLE`, not `500`. Pool size and timeout are configurable via
`DATABASE_CONNECTION_LIMIT` / `DATABASE_POOL_TIMEOUT_SECONDS`.

**Why.** An order transaction holds its pool connection for as long as it holds
the stock row lock, so a burst of orders for one popular SKU queues on the pool
by design. Prisma's default pool is `num_cpus * 2 + 1` — nine on a small
container, five on a 2-core CI runner. With 30 concurrent orders the queue
outran the pool and eight valid orders returned `500 INTERNAL_ERROR`: the
request was fine, the server was simply busy, and the client was told to give
up. Retrying absorbs the burst; a `503` tells the truth about the remainder.

**Cost.** A saturated server now holds requests longer rather than failing them
fast. That is the correct trade for placing an order and the wrong one for a
read — which is why the retry budget is bounded rather than open-ended.
