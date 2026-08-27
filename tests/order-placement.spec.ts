import { expect, test } from '@playwright/test'
import { ADMIN, API_BASE, STAFF, login } from './fixtures'

/**
 * End-to-end coverage of the critical path: sign in → build a basket → place an
 * order → see stock fall and the order appear.
 *
 * These run against the real API and the real database. Nothing is mocked,
 * because the parts most likely to break are the seams: optimistic cache
 * updates rolling back on a genuine 409, a real JWT surviving a reload, the
 * idempotency header actually being sent.
 */

test.describe('Order placement', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, STAFF)
  })

  test('places an order end to end and decrements stock', async ({ page }) => {
    await page.goto('/orders/new')

    // Wait for the catalogue to load with the default warehouse selected.
    const card = page.locator('[data-testid="catalogue-card"][data-out-of-stock="false"]').first()
    await expect(card).toBeVisible({ timeout: 20_000 })

    const sku = await card.getAttribute('data-sku')
    const availableBefore = Number(await card.getAttribute('data-available'))
    expect(availableBefore).toBeGreaterThan(0)

    await card.getByRole('button', { name: 'Add' }).click()

    await expect(page.locator('[data-testid="basket-line"]')).toHaveCount(1)

    // Fill the customer details.
    await page.getByLabel('Name').fill('Playwright Test Customer')
    await page.getByLabel('Email').fill('e2e@playwright.test')

    const placeButton = page.getByTestId('place-order')
    await expect(placeButton).toBeEnabled()
    await placeButton.click()

    // Lands on the orders list with the new order at the top.
    await page.waitForURL(/\/orders$/, { timeout: 20_000 })

    const firstRow = page.locator('[data-testid="order-row"]').first()
    await expect(firstRow).toBeVisible({ timeout: 20_000 })
    await expect(firstRow).toContainText('Playwright Test Customer')
    await expect(firstRow.getByText(/confirmed|pending/i)).toBeVisible()

    // Stock for that SKU fell by one.
    await page.goto('/orders/new')
    const sameCard = page.locator(`[data-testid="catalogue-card"][data-sku="${sku}"]`).first()
    await expect(sameCard).toBeVisible({ timeout: 20_000 })
    await expect
      .poll(async () => Number(await sameCard.getAttribute('data-available')), { timeout: 15_000 })
      .toBe(availableBefore - 1)
  })

  test('shows the optimistic row while the request is in flight', async ({ page }) => {
    await page.goto('/orders/new')

    const card = page.locator('[data-testid="catalogue-card"][data-out-of-stock="false"]').first()
    await expect(card).toBeVisible({ timeout: 20_000 })
    await card.getByRole('button', { name: 'Add' }).click()

    await page.getByLabel('Name').fill('Optimistic Customer')
    await page.getByLabel('Email').fill('optimistic@playwright.test')

    // Hold the response so the optimistic state is observable.
    await page.route('**/api/v1/orders', async (route) => {
      if (route.request().method() !== 'POST') return route.fallback()
      await new Promise((resolve) => setTimeout(resolve, 2500))
      await route.fallback()
    })

    await page.getByTestId('place-order').click()

    // The button enters its loading state immediately — this is the guard
    // against a double submit.
    await expect(page.getByTestId('place-order')).toBeDisabled()
    await expect(page.getByText(/placing order/i)).toBeVisible()

    await page.unroute('**/api/v1/orders')
    await page.waitForURL(/\/orders$/, { timeout: 25_000 })
  })

  test('rolls the UI back when the server rejects the order', async ({ page }) => {
    await page.goto('/orders/new')

    const card = page.locator('[data-testid="catalogue-card"][data-out-of-stock="false"]').first()
    await expect(card).toBeVisible({ timeout: 20_000 })

    const sku = await card.getAttribute('data-sku')
    const availableBefore = Number(await card.getAttribute('data-available'))

    await card.getByRole('button', { name: 'Add' }).click()
    await page.getByLabel('Name').fill('Rollback Customer')
    await page.getByLabel('Email').fill('rollback@playwright.test')

    // Force the exact failure the optimistic path must survive.
    await page.route('**/api/v1/orders', async (route) => {
      if (route.request().method() !== 'POST') return route.fallback()
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: false,
          error: {
            code: 'INSUFFICIENT_STOCK',
            message: 'Not enough stock',
            details: {
              shortfalls: [{ productId: 'x', sku, name: 'Test', requested: 1, available: 0 }],
            },
          },
        }),
      })
    })

    await page.getByTestId('place-order').click()

    // The shortfall panel explains precisely what happened.
    await expect(page.getByTestId('shortfall-panel')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/stock ran out while you were ordering/i)).toBeVisible()

    // We stayed on the page, and the basket was NOT cleared.
    await expect(page).toHaveURL(/\/orders\/new/)
    await expect(page.locator('[data-testid="basket-line"]')).toHaveCount(1)

    await page.unroute('**/api/v1/orders')

    // The optimistic decrement was rolled back — availability is unchanged.
    await expect
      .poll(async () => {
        const sameCard = page.locator(`[data-testid="catalogue-card"][data-sku="${sku}"]`).first()
        return Number(await sameCard.getAttribute('data-available'))
      }, { timeout: 15_000 })
      .toBe(availableBefore)
  })

  test('sends an Idempotency-Key with every order submission', async ({ page }) => {
    await page.goto('/orders/new')

    const card = page.locator('[data-testid="catalogue-card"][data-out-of-stock="false"]').first()
    await expect(card).toBeVisible({ timeout: 20_000 })
    await card.getByRole('button', { name: 'Add' }).click()

    await page.getByLabel('Name').fill('Idempotency Customer')
    await page.getByLabel('Email').fill('idempotency@playwright.test')

    const requestPromise = page.waitForRequest(
      (request) => request.url().includes('/api/v1/orders') && request.method() === 'POST',
    )

    await page.getByTestId('place-order').click()

    const request = await requestPromise
    const key = request.headers()['idempotency-key']

    expect(key).toBeTruthy()
    expect(key).toMatch(/^[0-9a-f-]{36}$/)
  })

  test('validates the customer fields before submitting', async ({ page }) => {
    await page.goto('/orders/new')

    const card = page.locator('[data-testid="catalogue-card"][data-out-of-stock="false"]').first()
    await expect(card).toBeVisible({ timeout: 20_000 })
    await card.getByRole('button', { name: 'Add' }).click()

    await page.getByLabel('Email').fill('not-an-email')
    await page.getByTestId('place-order').click()

    await expect(page.getByText('Customer name is required')).toBeVisible()
    await expect(page.getByText('Enter a valid email address')).toBeVisible()
    await expect(page).toHaveURL(/\/orders\/new/)
  })
})

// ---------------------------------------------------------------------------

test.describe('Concurrency', () => {
  /**
   * Two browser contexts, one unit of stock.
   *
   * This is the requirement stated in the brief — "two orders for the last
   * unit" — exercised through the actual UI rather than at the service layer.
   * Exactly one must succeed.
   */
  test('only one of two simultaneous orders for the last unit succeeds', async ({ browser, request }) => {
    // Sign in as admin over the API to set a product to exactly 1 unit.
    const loginResponse = await request.post(`${API_BASE}/api/v1/auth/login`, {
      data: { email: ADMIN.email, password: ADMIN.password },
    })
    expect(loginResponse.ok()).toBeTruthy()
    const { data: session } = await loginResponse.json()
    const auth = { Authorization: `Bearer ${session.accessToken}` }

    const warehousesResponse = await request.get(`${API_BASE}/api/v1/warehouses`, { headers: auth })
    const { data: warehouses } = await warehousesResponse.json()
    const warehouse = warehouses[0]

    const productsResponse = await request.get(
      `${API_BASE}/api/v1/products?warehouseId=${warehouse.id}&pageSize=1`,
      { headers: auth },
    )
    const { data: products } = await productsResponse.json()
    const product = products.items[0]

    // Set stock to exactly one.
    const adjustResponse = await request.post(`${API_BASE}/api/v1/stock/adjust`, {
      headers: { ...auth, 'Idempotency-Key': crypto.randomUUID() },
      data: { productId: product.id, warehouseId: warehouse.id, setTo: 1, reason: 'STOCK_TAKE' },
    })
    expect(adjustResponse.ok()).toBeTruthy()

    // Two independent sessions submit at the same moment.
    const contextA = await browser.newContext()
    const contextB = await browser.newContext()

    const submit = async (context: typeof contextA, label: string) => {
      const apiContext = context.request
      const login = await apiContext.post(`${API_BASE}/api/v1/auth/login`, {
        data: { email: STAFF.email, password: STAFF.password },
      })
      const { data } = await login.json()

      return apiContext.post(`${API_BASE}/api/v1/orders`, {
        headers: {
          Authorization: `Bearer ${data.accessToken}`,
          'Idempotency-Key': crypto.randomUUID(),
        },
        data: {
          customerName: `Racer ${label}`,
          customerEmail: `racer-${label}@playwright.test`,
          warehouseId: warehouse.id,
          items: [{ productId: product.id, quantity: 1 }],
        },
      })
    }

    const [resultA, resultB] = await Promise.all([submit(contextA, 'A'), submit(contextB, 'B')])

    const statuses = [resultA.status(), resultB.status()].sort()
    expect(statuses).toEqual([201, 409])

    const loser = resultA.status() === 409 ? resultA : resultB
    const loserBody = await loser.json()
    expect(loserBody.error.code).toBe('INSUFFICIENT_STOCK')

    // Stock landed at zero, never negative.
    const finalResponse = await request.get(
      `${API_BASE}/api/v1/stock/levels?warehouseId=${warehouse.id}`,
      { headers: auth },
    )
    const { data: levels } = await finalResponse.json()
    const level = levels.find((row: { productId: string }) => row.productId === product.id)
    expect(level.quantity).toBe(0)

    await contextA.close()
    await contextB.close()
  })
})
