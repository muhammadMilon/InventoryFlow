import type { ApiErrorBody, ErrorCode, LoginResponse } from '@/types/api'

const DEFAULT_API_URL = 'http://localhost:4000/api/v1'

/**
 * Resolve the API base URL.
 *
 * The emptiness check matters more than it looks. `NEXT_PUBLIC_*` values are
 * inlined at build time, so a variable that is *defined but blank* in the
 * hosting dashboard compiles to `''` — and `''` survives `??`, because it is
 * neither null nor undefined. The base URL then becomes the empty string, every
 * call resolves relative to the web app's own origin (`/auth/login` instead of
 * `https://api.example.com/api/v1/auth/login`), and the app silently talks to
 * itself: the deploy looks healthy and every request returns the 404 HTML page.
 *
 * Treating blank as unset turns that into an honest connection error naming the
 * variable to fix.
 */
function resolveBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim()
  if (!configured) return DEFAULT_API_URL
  return configured.replace(/\/+$/, '')
}

const BASE_URL = resolveBaseUrl()

/**
 * A typed error the whole UI can branch on.
 * `code` is the API's machine code — components check `INSUFFICIENT_STOCK`
 * rather than parsing an English sentence that might change.
 */
export class ApiError extends Error {
  readonly code: ErrorCode
  readonly status: number
  readonly details?: unknown
  readonly requestId?: string

  constructor(status: number, code: ErrorCode, message: string, details?: unknown, requestId?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
    this.requestId = requestId
  }

  get isAuthError(): boolean {
    return this.status === 401
  }

  get isForbidden(): boolean {
    return this.status === 403
  }
}

// ---------------------------------------------------------------------------
// Access-token handling
// ---------------------------------------------------------------------------

/**
 * The access token lives in a module-scoped variable, NOT localStorage.
 *
 * Anything readable by JavaScript is readable by an XSS payload — but a
 * variable dies with the tab, while a localStorage token can be exfiltrated and
 * replayed for its full lifetime. The durable half of the session is the
 * refresh token, which the API sets as an httpOnly cookie that script cannot
 * read at all. On a page reload the app calls /auth/refresh and gets a new
 * access token from that cookie.
 */
let accessToken: string | null = null
let onUnauthorized: (() => void) | null = null

export function setAccessToken(token: string | null): void {
  accessToken = token
}

export function getAccessToken(): string | null {
  return accessToken
}

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler
}

// ---------------------------------------------------------------------------
// Single-flight refresh
// ---------------------------------------------------------------------------

let refreshPromise: Promise<string | null> | null = null

/**
 * When five queries fire at once and the token has just expired, all five get a
 * 401. Without this guard they would each POST /auth/refresh — and because the
 * API *rotates* refresh tokens, the first response invalidates the cookie the
 * other four are still using, logging the user out. Sharing one in-flight
 * promise means exactly one refresh happens and all five retry with its result.
 */
async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise

  refreshPromise = (async () => {
    try {
      const response = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      })

      if (!response.ok) return null

      const body = (await response.json()) as { ok: true; data: LoginResponse }
      accessToken = body.data.accessToken
      return accessToken
    } catch {
      return null
    } finally {
      // Release on the next tick so concurrent callers all see the same result.
      setTimeout(() => {
        refreshPromise = null
      }, 0)
    }
  })()

  return refreshPromise
}

// ---------------------------------------------------------------------------
// Request
// ---------------------------------------------------------------------------

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown
  /** Sent as the `Idempotency-Key` header on unsafe methods. */
  idempotencyKey?: string
  /** Internal: prevents an infinite refresh loop. */
  _isRetry?: boolean
  /** Skip the automatic refresh-and-retry (used by the auth calls themselves). */
  skipAuthRetry?: boolean
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, idempotencyKey, _isRetry, skipAuthRetry, headers, ...rest } = options

  const requestHeaders = new Headers(headers)
  requestHeaders.set('Accept', 'application/json')

  if (body !== undefined) requestHeaders.set('Content-Type', 'application/json')
  if (accessToken) requestHeaders.set('Authorization', `Bearer ${accessToken}`)
  if (idempotencyKey) requestHeaders.set('Idempotency-Key', idempotencyKey)

  let response: Response

  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...rest,
      headers: requestHeaders,
      credentials: 'include',
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      'Cannot reach the API. Check that the backend is running and NEXT_PUBLIC_API_URL is correct.',
    )
  }

  // 401 → try one silent refresh, then replay the original request.
  if (response.status === 401 && !_isRetry && !skipAuthRetry) {
    const refreshed = await refreshAccessToken()
    if (refreshed) {
      return apiFetch<T>(path, { ...options, _isRetry: true })
    }
    onUnauthorized?.()
  }

  if (response.status === 204) return undefined as T

  const text = await response.text()
  const payload: unknown = text ? safeParse(text) : null

  // Every API response is JSON. Markup here means the request never reached the
  // API at all — it was answered by whatever is serving the URL we aimed at,
  // usually the web app's own 404 page after a blank or wrong
  // NEXT_PUBLIC_API_URL. Naming that beats rendering a slice of HTML into an
  // error banner, which is what this used to do.
  if (payload === NOT_JSON) {
    throw new ApiError(
      response.status,
      'NETWORK_ERROR',
      `The API returned ${response.headers.get('content-type') ?? 'a non-JSON response'} instead of JSON. ` +
        `Check that NEXT_PUBLIC_API_URL points at the API base URL (it is currently "${BASE_URL}").`,
      undefined,
      response.headers.get('x-request-id') ?? undefined,
    )
  }

  if (!response.ok) {
    const errorBody = payload as ApiErrorBody | null
    throw new ApiError(
      response.status,
      errorBody?.error?.code ?? 'INTERNAL_ERROR',
      errorBody?.error?.message ?? `Request failed with status ${response.status}`,
      errorBody?.error?.details,
      errorBody?.error?.requestId ?? response.headers.get('x-request-id') ?? undefined,
    )
  }

  const envelope = payload as { ok: true; data: T } | null
  return (envelope?.data ?? (payload as T)) as T
}

/** Distinguishes "the body was not JSON" from "the body was the JSON value null". */
const NOT_JSON = Symbol('not-json')

function safeParse(text: string): unknown | typeof NOT_JSON {
  try {
    return JSON.parse(text)
  } catch {
    return NOT_JSON
  }
}

// ---------------------------------------------------------------------------
// Verb helpers
// ---------------------------------------------------------------------------

export const api = {
  get: <T>(path: string, options?: RequestOptions) => apiFetch<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: 'PATCH', body }),
  delete: <T>(path: string, options?: RequestOptions) => apiFetch<T>(path, { ...options, method: 'DELETE' }),
}

/** Serialises a query object, dropping empty values. */
export function qs(params: Record<string, string | number | boolean | undefined | null>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    search.set(key, String(value))
  }
  const result = search.toString()
  return result ? `?${result}` : ''
}

export { refreshAccessToken, BASE_URL }
