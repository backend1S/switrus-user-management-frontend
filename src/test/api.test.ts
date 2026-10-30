import { parseError, request, setCsrfToken, setUnauthorizedHandler } from '../services/api'

function mockFetch(status: number, body: unknown) {
  const fn = vi.fn().mockImplementation(async () => new Response(JSON.stringify(body), { status }))
  vi.stubGlobal('fetch', fn)
  return fn
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('api client', () => {
  it('turns FastAPI string details into messages', () => {
    const e = parseError(409, { detail: 'User name already exists' })
    expect(e.status).toBe(409)
    expect(e.message).toBe('User name already exists')
  })

  it('maps 422 validation lists to field errors', () => {
    const e = parseError(422, { detail: [{ loc: ['body', 'Email'], msg: 'Value error, Invalid email address: bad' }] })
    expect(e.fieldErrors).toEqual({ Email: 'Invalid email address: bad' })
  })

  it('never sends an API key', async () => {
    const fetch = mockFetch(200, { ok: true })
    await request('GET', '/users')
    await request('PATCH', '/users/E1', { body: { Phone: '1' } })
    expect(JSON.stringify(fetch.mock.calls)).not.toMatch(/X-API-Key/i)
    expect(String(fetch.mock.calls[0][0])).toMatch(/\/api\/users$/)
  })

  it('drops empty query params', async () => {
    const fetch = mockFetch(200, [])
    await request('GET', '/users', { query: { include_disabled: true, search: '', role: undefined } })
    expect(String(fetch.mock.calls[0][0])).toMatch(/\/api\/users\?include_disabled=true$/)
  })

  it('reports an unreachable server clearly', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    await expect(request('GET', '/users')).rejects.toMatchObject({ status: 0, message: expect.stringMatching(/Cannot reach/) })
  })
})

describe('api client sessions', () => {
  afterEach(() => {
    setCsrfToken(null)
    setUnauthorizedHandler(null)
  })

  it('sends cookies and adds the CSRF token to writes only', async () => {
    const fetch = mockFetch(200, {})
    setCsrfToken('csrf-123')
    await request('GET', '/users')
    await request('PATCH', '/users/E1', { body: { Phone: '1' } })
    await request('DELETE', '/users/E1/leave')
    const [, getInit] = fetch.mock.calls[0]
    const [, patchInit] = fetch.mock.calls[1]
    const [, delInit] = fetch.mock.calls[2]
    expect(getInit.credentials).toBe('include')
    expect(getInit.headers['X-CSRF-Token']).toBeUndefined()
    expect(patchInit.headers['X-CSRF-Token']).toBe('csrf-123')
    expect(delInit.headers['X-CSRF-Token']).toBe('csrf-123')
  })

  it('never puts credentials in the URL', async () => {
    const fetch = mockFetch(200, {})
    setCsrfToken('csrf-123')
    await request('POST', '/auth/login', { body: { username: 'a', password: 'b' } })
    expect(String(fetch.mock.calls[0][0])).toMatch(/\/api\/auth\/login$/)
  })

  it('reports a lost session once, but not a wrong password', async () => {
    const lost = vi.fn()
    setUnauthorizedHandler(lost)
    mockFetch(401, { detail: 'Session expired. Sign in again.' })
    await expect(request('GET', '/users')).rejects.toMatchObject({ status: 401 })
    expect(lost).toHaveBeenCalledTimes(1)
    mockFetch(401, { detail: 'Incorrect user name or password' })
    await expect(request('POST', '/auth/login', { body: {} })).rejects.toMatchObject({ message: 'Incorrect user name or password' })
    expect(lost).toHaveBeenCalledTimes(1)
  })

  it('does not treat 403 as signed out', async () => {
    const lost = vi.fn()
    setUnauthorizedHandler(lost)
    mockFetch(403, { detail: 'Administrator role required' })
    await expect(request('PATCH', '/users/E1', { body: {} })).rejects.toMatchObject({ status: 403, message: 'Administrator role required' })
    expect(lost).not.toHaveBeenCalled()
  })
})
