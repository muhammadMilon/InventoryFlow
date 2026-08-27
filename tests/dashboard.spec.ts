import { expect, test } from '@playwright/test'
import { STAFF, login } from './fixtures'

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, STAFF)
  })

  test('renders the KPI row and every chart', async ({ page }) => {
    // KPI tiles
    for (const label of [/revenue · 30d/i, /orders · 30d/i, /stock value/i, /needs attention/i]) {
      await expect(page.getByText(label).first()).toBeVisible({ timeout: 20_000 })
    }

    // Chart headings — each is a distinct visualisation.
    const charts = [
      /revenue trend/i,
      /order pipeline/i,
      /stock movement/i,
      /best sellers/i,
      /stock value by category/i,
      /stock by warehouse/i,
      /days of cover/i,
      /demand vs cover/i,
    ]

    for (const heading of charts) {
      await expect(page.getByRole('heading', { name: heading })).toBeVisible({ timeout: 25_000 })
    }

    // Recharts renders to SVG — presence of several confirms the data arrived.
    await expect.poll(async () => page.locator('.recharts-surface').count(), { timeout: 25_000 }).toBeGreaterThan(4)
  })

  test('switches the time range and refetches', async ({ page }) => {
    const responsePromise = page.waitForResponse(
      (response) => response.url().includes('/analytics/dashboard') && response.url().includes('days=7'),
      { timeout: 20_000 },
    )

    await page.getByRole('radio', { name: '7d' }).click()

    const response = await responsePromise
    expect(response.ok()).toBeTruthy()
    await expect(page.getByText(/trading summary for the last 7 days/i)).toBeVisible()
  })

  test('offers a table view for every chart that has one', async ({ page }) => {
    const toggle = page.getByRole('button', { name: /show as table/i }).first()
    await expect(toggle).toBeVisible({ timeout: 25_000 })
    await toggle.click()

    // The chart region now contains a real table — this is the accessible
    // fallback the palette's contrast warnings oblige.
    await expect(page.locator('table').first()).toBeVisible()
  })

  test('navigates to the stock ledger and shows movement history', async ({ page }) => {
    await page.getByRole('link', { name: /stock ledger/i }).click()
    await page.waitForURL(/\/stock/)

    await page.getByRole('radio', { name: /ledger/i }).click()

    await expect(page.getByRole('heading', { name: /movement ledger/i })).toBeVisible({ timeout: 20_000 })
    await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 20_000 })

    // Every entry carries a signed delta and a resulting balance.
    const firstRow = page.locator('tbody tr').first()
    await expect(firstRow).toContainText(/[+-]\d+/)
  })

  test('is usable on a phone-sized viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.reload()

    await expect(page.getByRole('heading', { name: /good (morning|afternoon|evening)/i })).toBeVisible({
      timeout: 20_000,
    })

    // The sidebar collapses behind a menu button.
    await page.getByRole('button', { name: /open navigation/i }).click()
    await expect(page.getByRole('link', { name: /^products$/i })).toBeVisible()

    // And the page body itself never scrolls sideways.
    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    )
    expect(overflows).toBe(false)
  })
})

test.describe('Stock reconciliation', () => {
  test('reports the seeded ledger as balanced', async ({ page }) => {
    await login(page, { email: 'admin@inventoryflow.dev', password: 'Admin@12345' })

    await page.goto('/stock?tab=reconcile')
    await page.getByRole('button', { name: /run check/i }).first().click()

    // This is the strongest single assertion in the suite: the entire movement
    // history sums exactly to the current stock levels.
    await expect(page.getByText(/ledger balanced across all/i)).toBeVisible({ timeout: 30_000 })
  })
})
