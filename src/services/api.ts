// Centralized HTTP client. No API key or secret exists in the bundle: the
// browser is authenticated by the HttpOnly session cookie that POST
// /auth/login sets, which JavaScript cannot read.

const BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') || '/api'

export class ApiError extends Error {
  status: number
  /** Field-level messages from a 422 response, keyed by field name. */
  fieldErrors: Record<string, string>

  constructor(status: number, message: string, fieldErrors: Record<string, string> = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.fieldErrors = fieldErrors
  }
}

// ------------------------------------------------------------------ session state
// The CSRF token is kept in memory only (never localStorage): it comes from
// the sign-in response or GET /auth/me after a reload.

let csrfToken: string | null = null
let onUnauthorized: (() => void) | null = null

export function setCsrfToken(token: string | null) {
  csrfToken = token
}

/** Called when any request finds the session gone (HTTP 401). */
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn
}

// Their 401 means "wrong password" / "not signed in yet", not "session lost".
const NO_SIGN_OUT_ON_401 = new Set(['/auth/login', '/auth/me'])

interface ValidationItem {
  loc?: (string | number)[]
  msg?: string
}

function cleanMsg(msg: string) {
  return msg.replace(/^Value error, /, '')
}

export function parseError(status: number, body: unknown): ApiError {
  const detail = (body as { detail?: unknown } | null)?.detail
  if (typeof detail === 'string') return new ApiError(status, detail)
  if (Array.isArray(detail)) {
    const fieldErrors: Record<string, string> = {}
    for (const item of detail as ValidationItem[]) {
      const field = item.loc?.[item.loc.length - 1]
      if (field !== undefined && item.msg && !(String(field) in fieldErrors)) {
        fieldErrors[String(field)] = cleanMsg(item.msg)
      }
    }
    const first = Object.entries(fieldErrors)[0]
    const message = first ? `${first[0]}: ${first[1]}` : 'Some values are not valid.'
    return new ApiError(status, message, fieldErrors)
  }
  if (status >= 500) return new ApiError(status, 'The server ran into a problem. Try again in a moment.')
  return new ApiError(status, `Request failed (HTTP ${status}).`)
}

type Query = Record<string, string | number | boolean | undefined | null>
type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export async function request<T>(
  method: Method,
  path: string,
  options: { body?: unknown; query?: Query; signal?: AbortSignal } = {},
): Promise<T> {
  const url = new URL(BASE + path, window.location.origin)
  for (const [k, v] of Object.entries(options.query ?? {})) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v))
  }

  const headers: Record<string, string> = { Accept: 'application/json' }
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'
  if (method !== 'GET' && csrfToken) headers['X-CSRF-Token'] = csrfToken

  let res: Response
  try {
    res = await fetch(url, {
      method,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      // Sends the session cookie. The API is same-origin (/api proxy), and the
      // cookie is SameSite=Strict, so other sites still cannot use it.
      credentials: 'include',
      signal: options.signal,
    })
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e
    throw new ApiError(0, 'Cannot reach the Switrus server. Check your connection and try again.')
  }

  const text = await res.text()
  let data: unknown = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = null
    }
  }

  if (!res.ok) {
    const err = parseError(res.status, data)
    if (res.status === 401 && !NO_SIGN_OUT_ON_401.has(path)) onUnauthorized?.()
    throw err
  }
  return data as T
}
