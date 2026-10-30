// End-to-end UI flow against a fake backend: sign-in, dashboard, actions, sign-out.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { App } from '../App'
import { AuthProvider } from '../hooks/useAuth'
import { setCsrfToken } from '../services/api'
import type { Session, User } from '../types/api'

const user = (over: Partial<User>): User => ({
  emp_id: 'E1', emp_name: 'Someone', department_id: null, role: 'CRE', branch_id: null, email: null, phone: null,
  manager_id: null, dept_email: null, is_disabled: false, leave_start: null, leave_end: null, is_suspended: 0, ...over,
})

const USERS: User[] = [
  user({ emp_id: 'SHPL/DEL/0417/2026', emp_name: 'AAS MOHAMMED', department_id: 'SALES', role: 'CRE', branch_id: 'B003',
    email: 'aas@switrus.com', phone: '9000000001', manager_id: 'TEMP/107' }),
  user({ emp_id: 'TEMP/107', emp_name: 'Admin', department_id: 'Operations', role: 'Admin', branch_id: 'B001' }),
]
const STATS = { total: 206, active: 204, disabled: 2, on_leave: 0 }

const ADMIN_SESSION: Session = {
  user: { emp_id: 'TEMP/107', emp_name: 'Admin', role: 'Admin', branch_id: 'B001', department_id: 'Operations' },
  permissions: { is_admin: true, can_edit: true, scope: 'all', scope_branch_id: null, scope_department_id: null },
  csrf_token: 'csrf-abc',
}
const MANAGER_SESSION: Session = {
  user: { emp_id: 'SHPL/AMD/0383/2025', emp_name: 'HEMANG C KANANI', role: 'Manager', branch_id: 'B008', department_id: 'SALES' },
  permissions: { is_admin: false, can_edit: false, scope: 'branch_department', scope_branch_id: 'B008', scope_department_id: 'SALES' },
  csrf_token: 'csrf-m',
}

interface Call { method: string; path: string; headers: Record<string, string>; body: unknown }

function fakeBackend(opts: { signedIn?: Session | null; loginResult?: { status: number; body: unknown } } = {}) {
  let session: Session | null = opts.signedIn ?? null
  const calls: Call[] = []
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status })
  const fn = vi.fn(async (input: URL | string, init: RequestInit = {}) => {
    const url = new URL(String(input))
    const path = url.pathname.replace(/^\/api/, '')
    const method = init.method ?? 'GET'
    const headers = (init.headers ?? {}) as Record<string, string>
    calls.push({ method, path: path + url.search, headers, body: init.body ? JSON.parse(String(init.body)) : undefined })

    if (path === '/auth/login') {
      if (opts.loginResult) return json(opts.loginResult.status, opts.loginResult.body)
      session = ADMIN_SESSION
      return json(200, session)
    }
    if (path === '/auth/logout') { session = null; return json(200, { message: 'Signed out' }) }
    if (!session) return json(401, { detail: 'Not signed in' })
    if (path === '/auth/me') return json(200, session)
    if (path === '/users/stats') return json(200, STATS)
    if (path === '/users' && method === 'GET') {
      const dept = url.searchParams.get('department_id')
      return json(200, dept ? USERS.filter((u) => u.department_id === dept) : USERS)
    }
    const status = path.match(/^\/users\/(.+)\/status$/)
    if (status && method === 'PATCH') {
      if (headers['X-CSRF-Token'] !== session.csrf_token) return json(403, { detail: 'CSRF token missing or invalid' })
      const u = USERS.find((x) => x.emp_id === decodeURIComponent(status[1]))!
      return json(200, { ...u, is_disabled: (JSON.parse(String(init.body)) as { is_disabled: boolean }).is_disabled })
    }
    const one = path.match(/^\/users\/(.+)$/)
    if (one && method === 'PATCH') {
      if (headers['X-CSRF-Token'] !== session.csrf_token) return json(403, { detail: 'CSRF token missing or invalid' })
      const u = USERS.find((x) => x.emp_id === decodeURIComponent(one[1]))!
      const body = JSON.parse(String(init.body)) as { Phone?: string }
      return json(200, { ...u, phone: body.Phone ?? u.phone })
    }
    if (one && method === 'GET') {
      const u = USERS.find((x) => x.emp_id === decodeURIComponent(one[1]))
      return u ? json(200, u) : json(404, { detail: `No user found with EMPID ${decodeURIComponent(one[1])}` })
    }
    return json(404, { detail: 'not in fake' })
  })
  vi.stubGlobal('fetch', fn)
  return { calls, fn }
}

function renderApp(path = '/users') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
  setCsrfToken(null)
})

describe('sign-in and dashboard', () => {
  it('sends a signed-out visitor to the sign-in page', async () => {
    const { calls } = fakeBackend()
    renderApp('/users')
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    expect(calls.filter((c) => c.path === '/auth/me')).toHaveLength(1)
    expect(calls.some((c) => c.path.startsWith('/users'))).toBe(false)
  })

  it('signs in, then shows real counts and users with text departments', async () => {
    const { calls } = fakeBackend()
    renderApp('/users')
    const u = userEvent.setup()
    await u.type(await screen.findByLabelText(/User name/), 'Admin')
    await u.type(screen.getByLabelText(/^Password/), 'Str0ng!Pass')
    await u.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('heading', { name: 'User Management' })).toBeInTheDocument()
    const counts = screen.getByRole('region', { name: 'User counts' })
    await waitFor(() => expect(within(counts).getByText('206')).toBeInTheDocument())
    expect(within(counts).getByText('204')).toBeInTheDocument()

    const row = (await screen.findByText('AAS MOHAMMED')).closest('tr')!
    for (const text of ['SHPL/DEL/0417/2026', 'SALES', 'CRE', 'B003', '9000000001', 'TEMP/107', 'Active'])
      expect(within(row).getByText(text)).toBeInTheDocument()

    const login = calls.find((c) => c.path === '/auth/login')!
    expect(login.method).toBe('POST')
    expect(login.body).toEqual({ username: 'Admin', password: 'Str0ng!Pass' })
    // Nothing secret ever goes into a URL.
    expect(calls.every((c) => !/api_key|password|token/i.test(c.path))).toBe(true)
  })

  it('shows the server message for a wrong password and stays on sign-in', async () => {
    fakeBackend({ loginResult: { status: 401, body: { detail: 'Incorrect user name or password' } } })
    renderApp('/login')
    const u = userEvent.setup()
    await u.type(await screen.findByLabelText(/User name/), 'Admin')
    await u.type(screen.getByLabelText(/^Password/), 'nope')
    await u.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByText('Incorrect user name or password')).toBeInTheDocument()
    expect(screen.getByLabelText(/^Password/)).toHaveValue('')
  })

  it('explains a disabled account or a role without access', async () => {
    fakeBackend({ loginResult: { status: 403, body: { detail: 'User account is disabled' } } })
    renderApp('/login')
    const u = userEvent.setup()
    await u.type(await screen.findByLabelText(/User name/), 'Old')
    await u.type(screen.getByLabelText(/^Password/), 'Str0ng!Pass')
    await u.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByText('User account is disabled')).toBeInTheDocument()
  })

  it('requires both fields before calling the API', async () => {
    const { calls } = fakeBackend()
    renderApp('/login')
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Sign in' }))
    expect(screen.getByText('Enter your user name')).toBeInTheDocument()
    expect(calls.some((c) => c.path === '/auth/login')).toBe(false)
  })
})

describe('signed in', () => {
  const admin = ADMIN_SESSION
  const viewer = MANAGER_SESSION

  it('filters by a text department', async () => {
    const { calls } = fakeBackend({ signedIn: admin })
    renderApp('/users?dept=Operations')
    expect(await screen.findByText('TEMP/107', { selector: 'td' })).toBeInTheDocument()
    expect(screen.queryByText('AAS MOHAMMED')).not.toBeInTheDocument()
    expect(calls.some((c) => c.path.startsWith('/users?') && new URLSearchParams(c.path.split('?')[1]).get('department_id') === 'Operations')).toBe(true)
  })

  it('disables a user after confirmation, sending the CSRF token', async () => {
    const { calls } = fakeBackend({ signedIn: admin })
    renderApp('/users')
    const u = userEvent.setup()
    const row = (await screen.findByText('AAS MOHAMMED')).closest('tr')!
    await u.click(within(row).getByRole('button', { name: /More actions/ }))
    await u.click(await screen.findByRole('menuitem', { name: 'Disable user' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/Disable AAS MOHAMMED\?/)).toBeInTheDocument()
    await u.click(within(dialog).getByRole('button', { name: 'Disable user' }))
    expect(await screen.findByText('AAS MOHAMMED was disabled')).toBeInTheDocument()
    const write = calls.find((c) => c.method === 'PATCH')!
    expect(write.path).toBe('/users/SHPL%2FDEL%2F0417%2F2026/status')
    expect(write.headers['X-CSRF-Token']).toBe('csrf-abc')
    expect(write.body).toEqual({ is_disabled: true })
  })

  it('shows employee details as read-only values, not inputs', async () => {
    const { calls } = fakeBackend({ signedIn: viewer })
    renderApp('/users/SHPL%2FDEL%2F0417%2F2026')
    expect(await screen.findByRole('heading', { name: 'AAS MOHAMMED' })).toBeInTheDocument()
    expect(calls.some((c) => c.path === '/users/SHPL%2FDEL%2F0417%2F2026')).toBe(true)
    expect(document.querySelector('input')).toBeNull()

    const org = screen.getByRole('region', { name: 'Organisation' })
    expect(within(org).getByText('SALES')).toBeInTheDocument()
    expect(within(org).getByText('B003')).toBeInTheDocument()
    // Manager shown by name when they are in the visible list, with the ID beneath.
    expect(within(org).getByRole('link', { name: 'Admin' })).toBeInTheDocument()
    expect(within(org).getByText('TEMP/107')).toBeInTheDocument()
    const contact = screen.getByRole('region', { name: 'Contact' })
    expect(within(contact).getByRole('link', { name: 'aas@switrus.com' })).toHaveAttribute('href', 'mailto:aas@switrus.com')
    expect(within(contact).getByText('9000000001')).toBeInTheDocument()
    expect(within(contact).getByLabelText('Not recorded')).toBeInTheDocument() // no department email
    const leave = screen.getByRole('region', { name: 'Leave' })
    expect(within(leave).getByText('No leave recorded')).toBeInTheDocument()

    expect(screen.getByText(/View only. Changes are managed by Switrus administrators./)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Edit details/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Disable account|Mark leave/ })).not.toBeInTheDocument()
  })

  it('keeps a manager on the read-only view even with ?edit=1', async () => {
    fakeBackend({ signedIn: viewer })
    renderApp('/users/SHPL%2FDEL%2F0417%2F2026?edit=1')
    expect(await screen.findByRole('heading', { name: 'AAS MOHAMMED' })).toBeInTheDocument()
    expect(document.querySelector('input')).toBeNull()
  })

  it('lets an admin edit from the record and returns to it after saving', async () => {
    const { calls } = fakeBackend({ signedIn: admin })
    renderApp('/users/SHPL%2FDEL%2F0417%2F2026')
    const u = userEvent.setup()
    const edit = await screen.findByRole('link', { name: /Edit details/ })
    expect(screen.getByRole('button', { name: /Disable account/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Mark leave/ })).toBeInTheDocument()
    await u.click(edit)

    expect(await screen.findByRole('heading', { name: 'Edit AAS MOHAMMED' })).toBeInTheDocument()
    expect(document.querySelector('[name="DepartmentID"]')).toHaveValue('SALES')
    expect(screen.getByLabelText(/^Employee ID/)).toHaveAttribute('readonly')

    const phone = document.querySelector<HTMLInputElement>('[name="Phone"]')!
    await u.clear(phone)
    await u.type(phone, '9000000002')
    await u.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByText('Saved 1 change to AAS MOHAMMED.')).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'AAS MOHAMMED' })).toBeInTheDocument()
    expect(document.querySelector('input')).toBeNull()
    const write = calls.find((c) => c.method === 'PATCH')!
    expect(write.path).toBe('/users/SHPL%2FDEL%2F0417%2F2026')
    expect(write.body).toEqual({ Phone: '9000000002' }) // only what changed
    expect(write.headers['X-CSRF-Token']).toBe('csrf-abc')
  })

  it('opens and closes the navigation drawer from the header', async () => {
    fakeBackend({ signedIn: viewer })
    renderApp('/users')
    await screen.findByText('AAS MOHAMMED')
    const u = userEvent.setup()
    const toggle = screen.getByRole('button', { name: 'Open navigation' })
    await u.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(document.getElementById('app-nav')).toHaveClass('open')
    expect(screen.getByText('User Management', { selector: '.nav-caption' })).toBeInTheDocument()
    await u.keyboard('{Escape}')
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(toggle).toHaveFocus()
  })

  it('shows a manager their scope and no branch or department filters', async () => {
    fakeBackend({ signedIn: MANAGER_SESSION })
    renderApp('/users')
    expect(await screen.findByText('SALES employees in branch B008')).toBeInTheDocument()
    expect(screen.getByText(/Manager · view only · B008 \/ SALES/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Branch' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Department' })).not.toBeInTheDocument()
    expect(screen.getByText('In your area')).toBeInTheDocument()
  })

  it('shows an access message when the role has no access', async () => {
    fakeBackend({ loginResult: { status: 403, body: { detail: 'Your role does not have access to User Management' } } })
    renderApp('/login')
    const u = userEvent.setup()
    await u.type(await screen.findByLabelText(/User name/), 'Someone')
    await u.type(screen.getByLabelText(/^Password/), 'x')
    await u.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByText('Your role does not have access to User Management')).toBeInTheDocument()
  })

  it('hides admin actions from view-only roles', async () => {
    fakeBackend({ signedIn: viewer })
    renderApp('/users')
    await screen.findByText('AAS MOHAMMED')
    expect(screen.queryByRole('link', { name: /Add user/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /More actions/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Loyaltri/ })).not.toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'View' }).length).toBeGreaterThan(0)
  })

  it('signs out and returns to the sign-in page', async () => {
    const { calls } = fakeBackend({ signedIn: admin })
    renderApp('/users')
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Sign out' }))
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    expect(calls.some((c) => c.path === '/auth/logout' && c.method === 'POST')).toBe(true)
    expect(screen.queryByText('AAS MOHAMMED')).not.toBeInTheDocument()
  })

  it('returns to sign-in when the session expires mid-use', async () => {
    const backend = fakeBackend({ signedIn: admin })
    renderApp('/users')
    await screen.findByText('AAS MOHAMMED')
    backend.fn.mockImplementation(async () => new Response(JSON.stringify({ detail: 'Session expired. Sign in again.' }), { status: 401 }))
    const u = userEvent.setup()
    const row = screen.getByText('AAS MOHAMMED').closest('tr')!
    await u.click(within(row).getByRole('button', { name: /More actions/ }))
    await u.click(await screen.findByRole('menuitem', { name: 'Disable user' }))
    await u.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Disable user' }))
    expect(await screen.findByText(/Your session ended/)).toBeInTheDocument()
  })
})
