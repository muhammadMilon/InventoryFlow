import { expect, type Page } from '@playwright/test'

export const ADMIN = {
  email: process.env.E2E_ADMIN_EMAIL ?? 'admin@inventoryflow.dev',
  password: process.env.E2E_ADMIN_PASSWORD ?? 'Admin@12345',
}

export const STAFF = {
  email: process.env.E2E_STAFF_EMAIL ?? 'staff@inventoryflow.dev',
  password: process.env.E2E_STAFF_PASSWORD ?? 'Staff@12345',
}

export const API_BASE = process.env.E2E_API_URL ?? 'http://localhost:4000'

/** Signs in through the real form and waits for the dashboard to settle. */
export async function login(page: Page, account: { email: string; password: string } = STAFF): Promise<void> {
  await page.goto('/login')

  await page.getByLabel('Email').fill(account.email)
  await page.getByLabel('Password').fill(account.password)
  await page.getByRole('button', { name: /^sign in$/i }).click()

  await page.waitForURL(/\/dashboard/, { timeout: 20_000 })
  await expect(page.getByRole('heading', { name: /good (morning|afternoon|evening)/i })).toBeVisible()
}

export async function logout(page: Page): Promise<void> {
  await page.getByRole('button', { name: /admin|staff/i }).first().click()
  await page.getByRole('menuitem', { name: /sign out/i }).click()
  await page.waitForURL(/\/login/)
}

/**
 * Picks the first product on the order page that has stock available at the
 * selected warehouse, and returns its card locator plus its name.
 */
export async function firstInStockCard(page: Page) {
  const cards = page.locator('[data-testid="catalogue-card"]:not([data-out-of-stock="true"])')
  await expect(cards.first()).toBeVisible({ timeout: 20_000 })
  return cards.first()
}
