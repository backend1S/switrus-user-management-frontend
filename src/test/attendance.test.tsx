// Attendance Muster page against a fake API. All data here is fixture data.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { App } from '../App'
import { AuthProvider } from '../hooks/useAuth'
import { shortLabel } from '../pages/AttendancePage'
import { setCsrfToken } from '../services/api'
import type { AttendanceAccess, AttendanceDay, AttendanceEmployee, AttendanceMuster, Session } from '../types/api'

const MANAGER: Session = {
  user: { emp_id: 'FIX/MGR/1', emp_name: 'Fixture Manager', role: 'Manager', branch_id: 'B008', department_id: 'SALES' },
  permissions: { is_admin: false, can_edit: false, scope: 'branch_department', scope_branch_id: 'B008', scope_department_id: 'SALES' },
  csrf_token: 'c',
}
const ADMIN: Session = {
  user: { emp_id: 'FIX/ADM/1', emp_name: 'Fixture Admin', role: 'ADMIN', branch_id: 'B001', department_id: 'Ops' },
  permissions: { is_admin: true, can_edit: true, scope: 'all', scope_branch_id: null, scope_department_id: null },
  csrf_token: 'c',
}
const ALLOWED: AttendanceAccess = { allowed: true, reason: null, configured: true, mapping_verified: true, max_range_days: 31 }

const day = (status: string, category: AttendanceDay['category'], work: number | null = null, ot: number | null = null): AttendanceDay =>
  ({ status, category, in_time: work ? '09:00' : null, out_time: work ? '18:00' : null, work_minutes: work, overtime_minutes: ot })

function employee(over: Partial<AttendanceEmployee>): AttendanceEmployee {
  return {
    emp_id: 'FIX/AMD/0001', emp_name: 'Fixture One', branch_id: 'B008', department_id: 'SALES', is_disabled: false, matched: true,
    days: {
      '2026-10-01': day('Present', 'present', 510, 75),
      '2026-10-02': day('Work From Home', 'other', 480),
      '2026-10-03': day('Off Day', 'off_day'),
    },
    summary: { present: 1, absent: 0, off_day: 1, half_day: 0, leave: 0, other: 1, days_recorded: 3, work_minutes: 990, overtime_minutes: 75 },
    source_summary: { presentDays: 1 },
    ...over,
  }
}

const MUSTER: AttendanceMuster = {
  from_date: '2026-10-01', to_date: '2026-10-03', dates: ['2026-10-01', '2026-10-02', '2026-10-03'],
  access: { scope: 'branch_department', branch_id: 'B008', department_id: 'SALES' },
  mapping_verified: true,
  employees: [employee({}), employee({ emp_id: 'FIX/AMD/0002', emp_name: 'Fixture Two' })],
  totals: { employees: 2, present: 2, absent: 0, off_day: 2, half_day: 0, leave: 0, other: 2, days_recorded: 6, work_minutes: 1980, overtime_minutes: 150 },
  states: [{ label: 'Present', category: 'present', count: 2 }, { label: 'Work From Home', category: 'other', count: 2 }, { label: 'Off Day', category: 'off_day', count: 2 }],
  warnings: [],
  generated_at: '2026-10-04T00:00:00+00:00',
}

function backend(session: Session, opts: { access?: AttendanceAccess; muster?: { status: number; body: unknown } } = {}) {
  const calls: string[] = []
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status })
  vi.stubGlobal('fetch', vi.fn(async (input: URL | string) => {
    const url = new URL(String(input))
    const path = url.pathname.replace(/^\/api/, '')
    calls.push(path + url.search)
    if (path === '/auth/me') return json(200, session)
    if (path === '/attendance/access') return json(200, opts.access ?? ALLOWED)
    if (path === '/attendance/muster') return json(opts.muster?.status ?? 200, opts.muster?.body ?? MUSTER)
    if (path === '/users/stats') return json(200, { total: 0, active: 0, disabled: 0, on_leave: 0 })
    if (path === '/users') return json(200, [])
    return json(404, { detail: 'not in fake' })
  }))
  return calls
}

function renderAt(path: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
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

describe('Attendance Muster', () => {
  it('does not call the attendance service until a range is loaded', async () => {
    const calls = backend(MANAGER)
    renderAt('/attendance')
    expect(await screen.findByText('Choose a date range')).toBeInTheDocument()
    expect(screen.getByLabelText(/From date/)).toBeInTheDocument()
    expect(screen.getByLabelText(/To date/)).toBeInTheDocument()
    expect(calls.some((c) => c.startsWith('/attendance/muster'))).toBe(false)

    await userEvent.setup().click(screen.getByRole('button', { name: /Load attendance/ }))
    expect(await screen.findByText('Fixture One')).toBeInTheDocument()
    const req = calls.find((c) => c.startsWith('/attendance/muster'))!
    const q = new URLSearchParams(req.split('?')[1])
    expect(q.get('from_date')).toMatch(/^\d{4}-\d{2}-01$/)
    expect(q.get('to_date')).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('shows real totals, returned states and per-employee summaries', async () => {
    backend(MANAGER)
    renderAt('/attendance?from=2026-10-01&to=2026-10-03')
    const counts = await screen.findByRole('region', { name: 'Attendance counts' })
    expect(await within(counts).findByText('33h')).toBeInTheDocument() // 1980 minutes of work (under 100h: shown exactly)
    expect(within(counts).getByText('2h 30m')).toBeInTheDocument()
    expect(within(counts).getByText('In your area')).toBeInTheDocument()
    const states = screen.getByRole('region', { name: 'Statuses returned' })
    expect(within(states).getByText('Work From Home')).toBeInTheDocument() // unexpected state, shown as returned

    const row = screen.getByText('Fixture One').closest('tr')!
    expect(within(row).getByText('16h 30m')).toBeInTheDocument()
    expect(within(row).getByText('1h 15m')).toBeInTheDocument()
  })

  it('hides branch and department filters from a manager and shows them to an admin', async () => {
    backend(MANAGER)
    const { unmount } = renderAt('/attendance?from=2026-10-01&to=2026-10-03')
    await screen.findByText('Fixture One')
    expect(screen.queryByRole('button', { name: 'Branch' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Department' })).not.toBeInTheDocument()
    unmount()
    vi.unstubAllGlobals()

    backend(ADMIN, { muster: { status: 200, body: { ...MUSTER, access: { scope: 'all', branch_id: null, department_id: null } } } })
    renderAt('/attendance?from=2026-10-01&to=2026-10-03')
    await screen.findByText('Fixture One')
    expect(screen.getByRole('button', { name: 'Branch' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Department' })).toBeInTheDocument()
  })

  it('filters by employee search', async () => {
    backend(MANAGER)
    renderAt('/attendance?from=2026-10-01&to=2026-10-03')
    await screen.findByText('Fixture One')
    await userEvent.setup().type(screen.getByPlaceholderText('Search name or employee ID'), 'two')
    expect(screen.queryByText('Fixture One')).not.toBeInTheDocument()
    expect(screen.getByText('Fixture Two')).toBeInTheDocument()
  })

  it('maps each day to its date column in the daily register', async () => {
    backend(MANAGER)
    renderAt('/attendance?from=2026-10-01&to=2026-10-03')
    await screen.findByText('Fixture One')
    await userEvent.setup().click(screen.getByRole('radio', { name: 'Daily register' }))
    const table = screen.getByRole('region', { name: 'Daily attendance register' })
    const heads = within(table).getAllByRole('columnheader').map((h) => h.textContent)
    expect(heads).toEqual(['Employee', '01Thu', '02Fri', '03Sat'])
    const row = within(table).getByRole('button', { name: 'Fixture One' }).closest('tr')!
    const cells = within(row).getAllByRole('cell').map((c) => c.textContent)
    expect(cells).toEqual(['P', 'WFH', 'Off'])
    expect(within(row).getByLabelText(/02\/10\/2026 \(Fri\): Work From Home/)).toBeInTheDocument()
  })

  it('opens an employee-wise detail with every day of the range', async () => {
    backend(MANAGER)
    renderAt('/attendance?from=2026-10-01&to=2026-10-03')
    await screen.findByText('Fixture One')
    await userEvent.setup().click(screen.getByRole('button', { name: 'View attendance for Fixture One' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('01/10/2026')).toBeInTheDocument()
    expect(within(dialog).getByText('03/10/2026')).toBeInTheDocument()
    expect(within(dialog).getByText('Present days')).toBeInTheDocument() // the attendance system's own summary
  })

  it('explains why attendance is unavailable and never calls the muster', async () => {
    const calls = backend(MANAGER, { access: { ...ALLOWED, allowed: false, reason: 'Attendance for your area is not available yet.' } })
    renderAt('/attendance?from=2026-10-01&to=2026-10-03')
    expect(await screen.findByText('Attendance for your area is not available yet.')).toBeInTheDocument()
    expect(calls.some((c) => c.startsWith('/attendance/muster'))).toBe(false)
  })

  it('shows upstream errors with Try again', async () => {
    backend(MANAGER, { muster: { status: 503, body: { detail: 'The attendance service is unavailable. Try again later.' } } })
    renderAt('/attendance?from=2026-10-01&to=2026-10-03')
    expect(await screen.findByText('The attendance service is unavailable. Try again later.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  it('shows an empty state when no employees have records', async () => {
    backend(MANAGER, { muster: { status: 200, body: { ...MUSTER, employees: [], states: [] } } })
    renderAt('/attendance?from=2026-10-01&to=2026-10-03')
    expect(await screen.findByText('No attendance records for this range')).toBeInTheDocument()
  })

  it('lists Attendance in the navigation only when allowed', async () => {
    backend(MANAGER, { access: { ...ALLOWED, allowed: false, reason: 'no' } })
    const { unmount } = renderAt('/users')
    await screen.findByRole('heading', { name: 'User Management' })
    expect(screen.queryByRole('link', { name: 'Attendance' })).not.toBeInTheDocument()
    unmount()
    vi.unstubAllGlobals()
    backend(MANAGER)
    renderAt('/users')
    expect(await screen.findByRole('link', { name: 'Attendance' })).toBeInTheDocument()
  })

  it('abbreviates states for the register without inventing them', () => {
    expect(shortLabel(day('Present', 'present'))).toBe('P')
    expect(shortLabel(day('Casual Leave', 'leave'))).toBe('CL')
    expect(shortLabel(day('Half Day', 'half_day'))).toBe('HD')
    expect(shortLabel(day('WO', 'off_day'))).toBe('WO')
    expect(shortLabel(day('Training', 'other'))).toBe('T')
  })
})
