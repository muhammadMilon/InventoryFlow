# API reference

Base URL: `http://localhost:4000/api/v1` (dev) · `https://<render-app>.onrender.com/api/v1` (prod)

Every response is enveloped:

```jsonc
{ "ok": true,  "data": { … } }
{ "ok": false, "error": { "code": "…", "message": "…", "details": { … }, "requestId": "…" } }
```

Every response carries `X-Request-Id`, which appears in every server log line for that request. Pass your own in the request to correlate across systems.

**Auth.** Send `Authorization: Bearer <accessToken>` on everything except `/health`, `/auth/login`, `/auth/register` and `/auth/refresh`.

**Idempotency.** Send `Idempotency-Key: <uuid>` on `POST /orders`, `POST /stock/adjust` and `POST /stock/transfer`. See [the README](../backend/README.md#idempotency).

---

## Auth

### `POST /auth/login`

Rate limited: 5 attempts / 15 min, keyed on IP + email.

```jsonc
// request
{ "email": "admin@inventoryflow.dev", "password": "Admin@12345" }

// 200
{
  "ok": true,
  "data": {
    "user": { "id": "…", "email": "…", "name": "Ayesha Rahman", "role": "ADMIN", "lastLoginAt": "…" },
    "accessToken": "eyJhbGciOi…"
  }
}
```

Also sets `if_refresh` as an `httpOnly` cookie scoped to `/api/v1/auth`. Errors: `401 INVALID_CREDENTIALS` (identical for wrong password and unknown email), `403 FORBIDDEN` (deactivated), `429 RATE_LIMITED`.

### `POST /auth/register`

Always creates a `STAFF` account — `role: "ADMIN"` in the body is silently downgraded. Password must be ≥ 8 chars with an uppercase, a lowercase and a digit. Returns the same shape as login, `201`.

### `POST /auth/refresh`

Reads the `if_refresh` cookie (or `{ "refreshToken": "…" }` in the body). Rotates the token and returns a new session. Presenting an already-revoked token revokes every session for that user.

### `POST /auth/logout` · `GET /auth/me` · `POST /auth/change-password`

Logout revokes the presented refresh token and clears the cookie. `change-password` takes `{ currentPassword, newPassword }` and revokes **all** sessions on success.

---

## Products

### `GET /products`

| Query | Type | Default | Notes |
|---|---|---|---|
| `search` | string | | Matches name, SKU, description (case-insensitive) |
| `categoryId` | uuid | | |
| `warehouseId` | uuid | | Scopes `stockByWarehouse` and the availability figures to one site |
| `lowStockOnly` | `true`\|`false` | `false` | Available ≤ reorder point |
| `includeInactive` | `true`\|`false` | `false` | |
| `sortBy` | `name`\|`sku`\|`unitPrice`\|`totalStock`\|`createdAt` | `name` | |
| `sortDir` | `asc`\|`desc` | `asc` | |
| `page` / `pageSize` | int | `1` / `20` | `pageSize` max 100 |

```jsonc
// 200
{
  "ok": true,
  "data": {
    "items": [{
      "id": "…", "sku": "ELC-1002", "name": "Nimbus Wireless Keyboard",
      "category": { "id": "…", "name": "Electronics", "slug": "electronics" },
      "unitPrice": 4200, "costPrice": 2800, "margin": 1400,
      "reorderPoint": 20, "reorderQty": 80, "isActive": true,
      "totalStock": 143, "totalReserved": 0, "available": 143,
      "stockValue": 400400, "isLow": false, "isOutOfStock": false,
      "stockByWarehouse": [
        { "warehouseId": "…", "warehouse": { "code": "DHK-01", … }, "quantity": 71, "reserved": 0, "available": 71 }
      ],
      "createdAt": "…", "updatedAt": "…"
    }],
    "pagination": { "page": 1, "pageSize": 20, "total": 28, "totalPages": 2 }
  }
}
```

`isLow` is evaluated against **available** stock, not on-hand — reserved units are already spoken for.

### `GET /products/:id`

Single product, same shape as an item above.

### `POST /products` — **admin**

```jsonc
{
  "sku": "ELC-1009",              // 3–32 chars: A–Z, 0–9, dashes; uppercased
  "name": "Aurora 32in Monitor",
  "description": "optional",
  "categoryId": "uuid | null",
  "unitPrice": 38900,             // must be ≥ costPrice
  "costPrice": 29500,
  "reorderPoint": 8,
  "reorderQty": 25,
  "initialStock": [               // optional; written as an INITIAL_LOAD ledger entry
    { "warehouseId": "uuid", "quantity": 40 }
  ]
}
```

`201` with the created product. `409 CONFLICT` on a duplicate SKU.

### `PATCH /products/:id` — **admin**

Any subset of `name`, `description`, `categoryId`, `unitPrice`, `costPrice`, `reorderPoint`, `reorderQty`, `isActive`. SKU is immutable. Writes a `PRODUCT_UPDATED` (or `PRODUCT_ARCHIVED`) audit entry.

### `GET /products/categories` · `POST /products/categories` — **admin**

---

## Warehouses

### `GET /warehouses`

Returns every site with a rolled-up summary:

```jsonc
{ "id": "…", "code": "DHK-01", "name": "Dhaka Central Hub", "city": "Dhaka", "country": "Bangladesh",
  "isActive": true, "skuCount": 28, "totalUnits": 2140, "stockValue": 4820500,
  "lowStockCount": 3, "orderCount": 187, "createdAt": "…" }
```

### `POST /warehouses` · `PATCH /warehouses/:id` — **admin**

`{ code, name, city, country?, isActive? }`. Code is 2–12 chars `[A-Z0-9-]` and immutable after creation.

---

## Stock

### `GET /stock/levels`

Query: `warehouseId`, `search`, `lowOnly`.

```jsonc
{ "productId": "…", "warehouseId": "…", "sku": "ELC-1002", "productName": "…",
  "warehouse": { "id": "…", "code": "DHK-01", "name": "…" },
  "quantity": 71, "reserved": 0, "available": 71,
  "reorderPoint": 20, "reorderQty": 80, "unitPrice": 4200,
  "isLow": false, "updatedAt": "…" }
```

### `GET /stock/movements` — the ledger

Query: `productId`, `warehouseId`, `orderId`, `type`, `reason`, `from`, `to`, `page`, `pageSize`.

```jsonc
{ "id": "…", "type": "OUTBOUND", "reason": "SALE_ORDER",
  "quantityDelta": -3,          // signed: negative consumes stock
  "balanceAfter": 68,           // level immediately AFTER this entry
  "unitCost": 2800, "note": "Sold on ORD-20260826-0004",
  "referenceId": "ORD-20260826-0004", "createdAt": "…",
  "product": { … }, "warehouse": { … },
  "actor": { "id": "…", "name": "Tanvir Hasan", "email": "…" },
  "order": { "id": "…", "orderNumber": "ORD-20260826-0004" } }
```

`type` ∈ `INBOUND` · `OUTBOUND` · `ADJUSTMENT` · `TRANSFER_IN` · `TRANSFER_OUT`
`reason` ∈ `PURCHASE_RECEIPT` · `SALE_ORDER` · `ORDER_CANCELLED` · `MANUAL_ADJUSTMENT` · `STOCK_TAKE` · `DAMAGED` · `RETURN` · `TRANSFER` · `INITIAL_LOAD`

### `POST /stock/adjust` — **admin**, idempotent

Exactly one of `delta` (relative) or `setTo` (absolute stock take):

```jsonc
{ "productId": "uuid", "warehouseId": "uuid",
  "delta": -12,                 // OR "setTo": 47
  "reason": "DAMAGED",
  "note": "Water damage in transit" }
```

```jsonc
// 200
{ "ok": true, "data": { "productId": "…", "warehouseId": "…",
  "previousQuantity": 59, "quantity": 47, "delta": -12, "movementId": "…" } }
```

Writes the ledger entry **and** the audit row in the same transaction. `409 INSUFFICIENT_STOCK` if it would drive the level negative; `400` if neither or both of `delta`/`setTo` are supplied.

### `POST /stock/transfer` — **admin**, idempotent

`{ productId, fromWarehouseId, toWarehouseId, quantity, note? }` → two balanced ledger entries sharing one `referenceId`. Rolls back entirely if the source is short.

### `GET /stock/reconcile` — **admin**

```jsonc
{ "ok": true, "data": {
  "checked": 112, "balanced": true,
  "discrepancies": [
    { "productId": "…", "warehouseId": "…", "sku": "…", "productName": "…",
      "warehouseCode": "DHK-01", "level": 999, "ledger": 100, "drift": 899 }
  ] } }
```

Asserts `StockLevel.quantity === SUM(StockMovement.quantityDelta)` for every pair. Non-empty `discrepancies` means something wrote stock outside `applyMovement`.

### `GET /stock/audit-log` — **admin**

Paginated, newest first. Optional `action` filter. Each entry carries `before`/`after`/`metadata`, actor, IP and user agent.

---

## Orders

### `GET /orders`

Query: `status`, `warehouseId`, `search` (order number, customer name or email), `from`, `to`, `page`, `pageSize`.

### `GET /orders/:id`

```jsonc
{ "id": "…", "orderNumber": "ORD-20260826-0004", "status": "CONFIRMED",
  "customerName": "Rahim Traders", "customerEmail": "…", "customerPhone": "…", "notes": null,
  "subtotal": 12600, "taxTotal": 630, "totalAmount": 13230, "itemCount": 3,
  "warehouse": { … }, "placedBy": { … },
  "createdAt": "…", "cancelledAt": null, "fulfilledAt": null,
  "items": [{ "id": "…", "productId": "…", "sku": "ELC-1002", "name": "…",
              "quantity": 3, "unitPrice": 4200, "lineTotal": 12600 }] }
```

`unitPrice` is a snapshot taken at the time of sale — product prices change, invoices do not.

### `POST /orders` — idempotent, rate limited (30/min/user)

```jsonc
{
  "customerName": "Rahim Traders",
  "customerEmail": "orders@rahimtraders.com.bd",
  "customerPhone": "+8801711000101",
  "warehouseId": "uuid",
  "notes": "Deliver before 6pm",
  "items": [{ "productId": "uuid", "quantity": 3 }]   // 1–50 lines, qty 1–10 000
}
```

`201` with the full order. Duplicate lines for the same product are merged. Stock decrements, ledger entries and the audit row all happen in **one transaction** — a single short line rolls the entire order back.

```jsonc
// 409 INSUFFICIENT_STOCK
{ "ok": false, "error": {
  "code": "INSUFFICIENT_STOCK",
  "message": "Not enough stock for Nimbus Wireless Keyboard: requested 5, available 2",
  "details": { "shortfalls": [
    { "productId": "…", "sku": "ELC-1002", "name": "…", "requested": 5, "available": 2 }
  ] } } }
```

Every short line is reported, not just the first.

### `POST /orders/:id/cancel`

`{ "reason": "optional" }` → returns every unit to stock via compensating `INBOUND` entries. The original `OUTBOUND` rows are never deleted. `409` if already cancelled or already fulfilled.

### `PATCH /orders/:id/status` — **admin**

`{ "status": "FULFILLED" }`. Allowed transitions:

```
PENDING   → CONFIRMED | CANCELLED
CONFIRMED → FULFILLED | CANCELLED
FULFILLED → (terminal)
CANCELLED → (terminal)
```

Moving to `CANCELLED` restocks, exactly as the cancel endpoint does.

---

## Analytics

### `GET /analytics/dashboard?days=30`

Everything the dashboard needs in one round trip — one consistent read rather than eight racing requests:

```jsonc
{ "summary": { "totalProducts": 28, "activeProducts": 28, "totalWarehouses": 4,
               "totalUnits": 6120, "stockValue": 9840500, "retailValue": 14210000,
               "lowStockCount": 5, "outOfStockCount": 2,
               "ordersToday": 6, "revenueToday": 84200,
               "orders30d": 187, "revenue30d": 2310450, "avgOrderValue": 12355,
               "openOrders": 14, "revenueChangePct": 12.4, "orderChangePct": 8.1 },
  "salesTrend":   [{ "date": "2026-07-28", "orders": 6, "revenue": 74200, "units": 31 }],
  "movementFlow": [{ "date": "2026-08-13", "inbound": 240, "outbound": 188, "net": 52 }],
  "topProducts":  [{ "productId": "…", "sku": "…", "name": "…", "category": "…",
                     "unitsSold": 142, "revenue": 596400, "orders": 61 }],
  "categories":   [{ "category": "Electronics", "products": 8, "units": 980,
                     "stockValue": 4120000, "revenue": 1840000 }],
  "warehouses":   [{ "warehouseId": "…", "code": "DHK-01", "name": "…", "city": "Dhaka",
                     "units": 2140, "skus": 28, "stockValue": 4820500, "lowStock": 3, "orders": 187 }],
  "lowStock":     [{ "productId": "…", "sku": "…", "name": "…", "warehouseCode": "DHK-01",
                     "quantity": 4, "reserved": 0, "available": 4,
                     "reorderPoint": 12, "reorderQty": 40,
                     "velocity": 1.83, "daysOfCover": 2.2, "severity": "CRITICAL" }],
  "orderStatus":  [{ "status": "FULFILLED", "count": 152, "value": 1880200 }] }
```

Time series are **zero-filled** via `generate_series`, so a day with no trading appears as a zero rather than a gap the chart has to invent.

`lowStock` is ordered by *urgency* — soonest to run out first — not by raw quantity. A product with 5 units selling 5/day outranks one with 2 units selling none.

### Individual endpoints

`GET /analytics/summary` · `/sales-trend?days=` · `/movement-flow?days=` · `/top-products?days=&limit=` · `/categories` · `/warehouses` · `/low-stock?days=&limit=` · `/order-status` · `/velocity?days=&limit=`

`velocity` returns per-product `dailyVelocity`, `onHand` and `daysOfCover` — the same signals the AI endpoint consumes.

---

## AI

### `GET /ai/restock-recommendation?days=30&limit=12`

Rate limited to 10/min/user; cached for `AI_CACHE_TTL_SECONDS` (default 300). Admins may add `force=true` to bypass the cache.

```jsonc
{ "ok": true, "data": {
  "source": "gemini",                  // or "heuristic"
  "model": "gemini-2.0-flash",         // null when heuristic
  "generatedAt": "…", "windowDays": 30,
  "headline": "2 SKUs are out of stock and need immediate purchase orders",
  "summary": "Across the last 30 days the business moved 187 orders worth ৳2,310,450…",
  "riskLevel": "CRITICAL",
  "recommendations": [{
    "sku": "ELC-1006", "productId": "…", "name": "ClearView 1080p Webcam", "category": "Electronics",
    "onHand": 0, "reorderPoint": 12, "dailyVelocity": 0.87, "daysOfCover": 0,
    "suggestedQty": 40, "urgency": "CRITICAL", "estimatedCost": 198000,
    "rationale": "Out of stock with 26 units sold in the last 30 days…"
  }],
  "watchList": [{ "sku": "…", "name": "…", "note": "…" }],
  "totalSuggestedUnits": 312, "totalEstimatedSpend": 894500,
  "degradedReason": "GEMINI_API_KEY is not configured"   // present only when degraded
} }
```

**Every number here is computed from the ledger, not by the model.** Gemini may only replace `rationale`, `headline`, `summary`, `riskLevel` and `watchList` prose. With no key, or on any upstream failure, the same figures are returned with `source: "heuristic"` and a `degradedReason` — the endpoint does not 500 because Google is down.

### `GET /ai/status` · `POST /ai/cache/clear` — **admin**

---

## `GET /health`

Public. Pings the database.

```jsonc
{ "ok": true, "data": { "status": "healthy", "uptime": 3821,
  "database": { "connected": true, "latencyMs": 14 },
  "ai": { "enabled": true, "model": "gemini-2.0-flash" },
  "version": "1.0.0", "environment": "production" } }
```

Returns `503` when the database is unreachable — which is what Render's health check watches.

---

## Error codes

| Code | Status | When |
|---|---|---|
| `VALIDATION_ERROR` | 400 | `details.issues[]` names each failing field |
| `UNAUTHORIZED` | 401 | Missing or invalid token |
| `INVALID_CREDENTIALS` | 401 | Bad login (identical for unknown email) |
| `TOKEN_EXPIRED` | 401 | Access token expired — refresh and retry |
| `FORBIDDEN` | 403 | Role insufficient |
| `NOT_FOUND` | 404 | |
| `CONFLICT` | 409 | Duplicate SKU, illegal transition, no-op adjustment |
| `INSUFFICIENT_STOCK` | 409 | `details.shortfalls[]` |
| `IDEMPOTENCY_KEY_REUSED` | 409 | Same key, different body |
| `IDEMPOTENT_REPLAY_IN_PROGRESS` | 409 | Identical request still running |
| `RATE_LIMITED` | 429 | |
| `AI_UNAVAILABLE` | 502/503/504 | Gemini unreachable (restock degrades instead) |
| `SERVICE_UNAVAILABLE` | 503 | Database pool saturated and the retry budget was spent. The request was valid — retry it. |
| `INTERNAL_ERROR` | 500 | Details never leak in production |
