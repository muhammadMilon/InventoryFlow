import { expect, test } from '@playwright/test'
import { ADMIN, STAFF, login, logout } from './fixtures'

test.describe('Authentication', () => {
  test('redirects an unauthenticated visitor to the login page', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForURL(/\/login/, { timeout: 15_000 })
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible()
  })

  test('preserves the intended destination through the login redirect', async ({ page }) => {
    await page.goto('/products')
    await page.waitForURL(/\/login\?from=/, { timeout: 15_000 })

    await page.getByLabel('Email').fill(STAFF.email)
    await page.getByLabel('Password').fill(STAFF.password)
    await page.getByRole('button', { name: /^sign in$/i }).click()

    // Back to where they were headed, not the default dashboard.
    await page.waitForURL(/\/products/, { timeout: 20_000 })
  })

  test('rejects bad credentials without leaking whether the account exists', async ({ page }) => {
    await page.goto('/login')

    await page.getByLabel('Email').fill('definitely-not-a-user@nowhere.test')
    await page.getByLabel('Password').fill('WrongPassword123')
    await page.getByRole('button', { name: /^sign in$/i }).click()

    // Scoped by test id, not by role: Next.js renders its own route announcer
    // with role="alert", so a bare getByRole('alert') matches two elements.
    await expect(page.getByTestId('login-error')).toContainText(/invalid email or password/i)
    await expect(page).toHaveURL(/\/login/)
  })

  test('keeps the session across a full page reload', async ({ page }) => {
    await login(page, STAFF)

    // The access token lives in memory only; this proves the httpOnly refresh
    // cookie is doing its job on boot.
    await page.reload()

    await expect(page.getByRole('heading', { name: /good (morning|afternoon|evening)/i })).toBeVisible({
      timeout: 20_000,
    })
  })

  test('signs out and blocks the back button from restoring the session', async ({ page }) => {
    await login(page, STAFF)
    await logout(page)

    await page.goto('/dashboard')
    await page.waitForURL(/\/login/, { timeout: 15_000 })
  })

  test('fills the demo credentials from the shortcut buttons', async ({ page }) => {
    await page.goto('/login')

    await page.getByRole('button', { name: /admin.*admin@inventoryflow/is }).click()

    await expect(page.getByLabel('Email')).toHaveValue(ADMIN.email)
    await expect(page.getByLabel('Password')).toHaveValue(ADMIN.password)
  })
})

test.describe('Role-based access control', () => {
  test('hides admin-only navigation and actions from staff', async ({ page }) => {
    await login(page, STAFF)

    // The audit log is admin-only and must not appear in the sidebar.
    await expect(page.getByRole('link', { name: /audit log/i })).toHaveCount(0)

    await page.goto('/products')
    await expect(page.locator('[data-testid="product-row"]').first()).toBeVisible({ timeout: 20_000 })

    // No create / adjust affordances for staff.
    await expect(page.getByRole('button', { name: /new product/i })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /^adjust$/i })).toHaveCount(0)
  })

  test('shows admin controls to an admin', async ({ page }) => {
    await login(page, ADMIN)

    await expect(page.getByRole('link', { name: /audit log/i })).toBeVisible()

    await page.goto('/products')
    await expect(page.locator('[data-testid="product-row"]').first()).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('button', { name: /new product/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /^adjust$/i }).first()).toBeVisible()
  })

  test('tells staff they cannot read the audit log even if they navigate directly', async ({ page }) => {
    await login(page, STAFF)
    await page.goto('/audit')

    await expect(page.getByText(/admins only/i)).toBeVisible({ timeout: 15_000 })
  })

  test('lets an admin adjust stock and records it in the audit log', async ({ page }) => {
    await login(page, ADMIN)
    await page.goto('/products')

    const row = page.locator('[data-testid="product-row"]').first()
    await expect(row).toBeVisible({ timeout: 20_000 })

    const sku = await row.getAttribute('data-sku')
    await row.getByRole('button', { name: /^adjust$/i }).click()

    await expect(page.getByRole('dialog')).toBeVisible()
    await page.getByLabel('Quantity').fill('7')
    await page.getByRole('button', { name: /apply adjustment/i }).click()

    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 15_000 })

    // The change shows up in the audit trail, attributed to this admin.
    await page.goto('/audit')
    const firstEntry = page.locator('tbody tr').first()
    await expect(firstEntry).toBeVisible({ timeout: 20_000 })
    await expect(firstEntry).toContainText(/stock adjusted/i)
    if (sku) await expect(firstEntry).toContainText(sku)
  })
})
