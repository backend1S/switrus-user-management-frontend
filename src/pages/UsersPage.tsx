import { useEffect, useMemo, useState, type MouseEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Icon } from '../components/ui/Icon'
import { RowMenu, type MenuAction } from '../components/ui/RowMenu'
import { Select } from '../components/ui/Select'
import { StatCard } from '../components/ui/StatCard'
import { Bone, Callout, EmptyState, ErrorState, LoadingVeil } from '../components/ui/States'
import { ScrollTable } from '../components/ui/ScrollTable'
import { Tooltip } from '../components/ui/Tooltip'
import { LeaveDialog, StatusDialog } from '../components/users/UserDialogs'
import { AccountPill, LeavePill } from '../components/users/UserPills'
import { useAuth } from '../hooks/useAuth'
import { useAllUsers, useUserList, useUserStats } from '../hooks/useUsers'
import type { User, UserFilters } from '../types/api'
import { pad2 } from '../utils/format'
import { distinct } from '../utils/options'
import { userPath } from '../utils/routes'

const PAGE_SIZE = 20
const COLUMNS = ['Employee ID', 'Employee name', 'Department', 'Role', 'Branch', 'Email', 'Phone', 'Manager ID', 'Account', 'Leave', 'Actions']
/** Text columns read better left-aligned; short codes and pills stay centred. */
const LEFT = new Set([0, 1, 5])
const ACTIONS = COLUMNS.length - 1
/** Left-aligned columns, and the Actions column pinned to the right edge so View is always reachable. */
const colClass = (i: number) => [LEFT.has(i) ? 'left' : '', i === ACTIONS ? 'sticky-end' : ''].join(' ').trim() || undefined

/** One line with an ellipsis; the full text shows on hover and keyboard focus, only when cut. */
function Truncate({ children, size, focusable }: { children: string | null; size?: 'sm'; focusable?: boolean }) {
  if (!children) return <span className="muted">—</span>
  return (
    <Tooltip content={children} onlyWhenTruncated>
      <span className={`cell-truncate ${size ?? ''}`} tabIndex={focusable ? 0 : undefined}>{children}</span>
    </Tooltip>
  )
}

/** Manager ID, cut to fit; the tooltip gives the full ID and, when visible to this person, the name. */
function ManagerCell({ id, names }: { id: string | null; names: Map<string, string | null> }) {
  if (!id) return <span className="muted">—</span>
  const name = names.get(id.trim().toUpperCase())
  if (!name) return <Truncate size="sm" focusable>{id}</Truncate>
  return (
    <Tooltip content={`${id} · Manager: ${name}`}>
      <span className="cell-truncate sm has-tip" tabIndex={0}>{id}</span>
    </Tooltip>
  )
}

function SkeletonRows() {
  const widths = [56, 120, 48, 52, 40, 150, 84, 64, 56, 56, 90]
  return (
    <>
      {Array.from({ length: 6 }, (_, r) => (
        <tr key={r} aria-hidden="true">
          {widths.map((w, c) => (
            <td key={c} className={colClass(c)}>
              <Bone w={w} h={c >= 8 ? 26 : 12} radius={c >= 8 ? 8 : 4} />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

function Pagination({ page, total, onPage }: { page: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  if (total === 0) return null
  const from = (page - 1) * PAGE_SIZE + 1
  const to = Math.min(total, page * PAGE_SIZE)
  const nums: (number | '…')[] = []
  for (let p = 1; p <= pages; p++) {
    if (p === 1 || p === pages || Math.abs(p - page) <= 1 || pages <= 7) nums.push(p)
    else if (nums[nums.length - 1] !== '…') nums.push('…')
  }
  return (
    <nav className="pagination" aria-label="Pagination">
      <div className="summary">
        Showing {from}–{to} of {total} user{total === 1 ? '' : 's'}
      </div>
      {pages > 1 && (
        <div className="pages">
          <button type="button" className="page-btn" aria-label="Previous page" disabled={page === 1} onClick={() => onPage(page - 1)}>
            <Icon name="chevronLeft" size={18} />
          </button>
          {nums.map((n, i) =>
            n === '…' ? (
              <span key={`e${i}`} className="muted" aria-hidden="true">…</span>
            ) : (
              <button key={n} type="button" className="page-btn" aria-current={n === page ? 'page' : undefined} onClick={() => onPage(n)}>
                {n}
              </button>
            ),
          )}
          <button type="button" className="page-btn" aria-label="Next page" disabled={page === pages} onClick={() => onPage(page + 1)}>
            <Icon name="chevronRight" size={18} />
          </button>
        </div>
      )}
    </nav>
  )
}

export function UsersPage() {
  const navigate = useNavigate()
  const { isAdmin, session, scopeLabel } = useAuth()
  const scope = session?.permissions.scope ?? 'all'
  const [params, setParams] = useSearchParams()
  const [searchText, setSearchText] = useState(params.get('q') ?? '')
  const [dialog, setDialog] = useState<{ kind: 'status' | 'leave'; user: User } | null>(null)
  const [flash, setFlash] = useState<string | null>(null)

  const filters: UserFilters = {
    include_disabled: params.get('disabled') === '1',
    search: params.get('q') ?? undefined,
    branch_id: params.get('branch') ?? undefined,
    department_id: params.get('dept') ?? undefined,
    role: params.get('role') ?? undefined,
  }
  const page = Math.max(1, Number(params.get('page') ?? 1) || 1)

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(changes)) {
      if (v === null || v === '') next.delete(k)
      else next.set(k, v)
    }
    if (!('page' in changes)) next.delete('page') // any filter change returns to page 1
    setParams(next, { replace: true })
  }

  // Debounced search into the URL.
  useEffect(() => {
    const t = window.setTimeout(() => {
      if ((params.get('q') ?? '') !== searchText.trim()) update({ q: searchText.trim() || null })
    }, 300)
    return () => window.clearTimeout(t)
  }, [searchText]) // only the typed text drives this


  useEffect(() => {
    if (!flash) return
    const t = window.setTimeout(() => setFlash(null), 5000)
    return () => window.clearTimeout(t)
  }, [flash])

  const list = useUserList(filters)
  const stats = useUserStats()
  const all = useAllUsers()

  const options = useMemo(() => {
    const users = all.data ?? []
    return {
      branch: distinct(users.map((u) => u.branch_id)),
      dept: distinct(users.map((u) => u.department_id)),
      role: distinct(users.map((u) => u.role?.toUpperCase() ?? null)),
    }
  }, [all.data])

  const managerNames = useMemo(
    () => new Map((all.data ?? []).map((u) => [u.emp_id.trim().toUpperCase(), u.emp_name])),
    [all.data],
  )

  const rows = list.data ?? []
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const filtered = !!(filters.search || filters.branch_id || filters.department_id || filters.role)

  const clearFilters = () => {
    setSearchText('')
    update({ q: null, branch: null, dept: null, role: null })
  }

  const openRow = (u: User, e: MouseEvent) => {
    const target = e.target as HTMLElement
    if (target.closest('button, a, input, label') || window.getSelection()?.toString()) return
    navigate(userPath(u.emp_id))
  }

  const rowActions = (u: User): MenuAction[] => [
    { label: 'Edit details', icon: 'edit', onSelect: () => navigate(userPath(u.emp_id, true)) },
    { label: u.leave_start ? 'Change leave' : 'Mark leave', icon: 'calendar', onSelect: () => setDialog({ kind: 'leave', user: u }) },
    u.is_disabled
      ? { label: 'Enable user', icon: 'userCheck', onSelect: () => setDialog({ kind: 'status', user: u }) }
      : { label: 'Disable user', icon: 'userOff', danger: true, onSelect: () => setDialog({ kind: 'status', user: u }) },
  ]

  return (
    <div className="page-inner">
      <div className="page-header" style={{ marginBottom: 8 }}>
        <div className="titles">
          <h1 className="page-title">User Management</h1>
          <div className="page-subtitle">
            {isAdmin ? 'Switrus accounts, access and leave.' : 'Employee accounts and leave in your area, view only.'}
          </div>
        </div>
        {isAdmin && (
          <div className="page-actions">
            <Link to="/users/new" className="btn btn-primary">
              <Icon name="plus" size={18} />
              Add user
            </Link>
          </div>
        )}
      </div>

      {stats.isError ? (
        <div className="card">
          <ErrorState message="Could not load the user counts." onRetry={() => void stats.refetch()} />
        </div>
      ) : (
        <section className="stats" aria-label="User counts">
          <StatCard label="Total users" value={stats.data?.total} caption={scope === 'all' ? 'All accounts' : 'In your area'} tone="blue" icon="users" dot="#3B6FD8" />
          <StatCard label="Active users" value={stats.data?.active} caption="Can sign in" tone="green" icon="userCheck" dot="#4DB764" />
          <StatCard label="Disabled users" value={stats.data?.disabled} caption="Cannot sign in" tone="red" icon="userOff" dot="#7F8690" />
          <StatCard label="On leave today" value={stats.data?.on_leave} caption="Today (IST)" tone="amber" icon="plane" dot="#A15C07" />
        </section>
      )}

      {scopeLabel && (
        <Callout tone="info" icon="shield">
          You can view <strong>{scopeLabel}</strong>. Changes are managed by Switrus administrators.
        </Callout>
      )}

      {flash && (
        <div role="status">
          <Callout tone="ok">{flash}</Callout>
        </div>
      )}

      <section className="card card-section" aria-labelledby="users-heading">
        <div className="card-header">
          <h2 className="card-title" id="users-heading">Employees</h2>
          {list.data && <span className="count-badge">{rows.length > 99 ? '99+' : pad2(rows.length)}</span>}
          <span className="grow" />
        </div>

        <div className="filter-bar" role="search">
          <label className="search">
            <Icon name="search" size={16} />
            <span className="sr-only">Search by name, employee ID or email</span>
            <input
              type="search"
              placeholder="Search name, ID or email"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </label>
          {scope !== 'branch_department' && (
            <Select aria-label="Department" placeholder="All departments" value={filters.department_id ?? ''}
              options={[{ value: '', label: 'All departments' }, ...options.dept]}
              onChange={(v) => update({ dept: v || null })} />
          )}
          <Select aria-label="Role" placeholder="All roles" value={filters.role?.toUpperCase() ?? ''}
            options={[{ value: '', label: 'All roles' }, ...options.role]} onChange={(v) => update({ role: v || null })} />
          {scope === 'all' && (
            <Select aria-label="Branch" placeholder="All branches" value={filters.branch_id ?? ''}
              options={[{ value: '', label: 'All branches' }, ...options.branch]} onChange={(v) => update({ branch: v || null })} />
          )}
          <button type="button" className="toggle-chip" aria-pressed={!!filters.include_disabled}
            onClick={() => update({ disabled: filters.include_disabled ? null : '1' })}>
            {filters.include_disabled && <Icon name="check" size={14} />}
            Show disabled
          </button>
        </div>

        {list.isError && !list.data ? (
          <div className="table-wrap">
            <ErrorState
              message={(list.error as Error)?.message || 'Could not load users.'}
              onRetry={() => void list.refetch()}
            />
          </div>
        ) : (
          <ScrollTable label="Employees table" busy={list.isFetching}
            resetKey={JSON.stringify(filters) + page}
            overlay={list.isFetching && list.data ? <LoadingVeil label="Updating users" /> : null}>
            <table className="table">
              <thead>
                <tr>
                  {COLUMNS.map((c, i) => (
                    <th key={c} scope="col" className={colClass(i)}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.isPending ? (
                  <SkeletonRows />
                ) : pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={COLUMNS.length} style={{ height: 'auto' }}>
                      {filtered ? (
                        <EmptyState icon="search" title="No users match these filters"
                          text="Try a different name, ID or email, or clear the filters to see everyone."
                          actions={<button type="button" className="btn btn-secondary" onClick={clearFilters}>Clear filters</button>} />
                      ) : (
                        <EmptyState title="No users yet"
                          text={filters.include_disabled ? 'There are no Switrus accounts.' : 'There are no active Switrus accounts. Disabled accounts are hidden; use "Show disabled" to see them.'}
                          actions={isAdmin ? <Link to="/users/new" className="btn btn-primary">Add user</Link> : undefined} />
                      )}
                    </td>
                  </tr>
                ) : (
                  pageRows.map((u) => (
                    <tr key={u.emp_id} className={`clickable ${u.is_disabled ? 'is-disabled' : ''}`} onClick={(e) => openRow(u, e)}>
                      <td className="left">{u.emp_id}</td>
                      <td className="left cell-name"><Truncate>{u.emp_name}</Truncate></td>
                      <td>{u.department_id ?? <span className="muted">—</span>}</td>
                      <td>{u.role ?? <span className="muted">—</span>}</td>
                      <td>{u.branch_id ?? <span className="muted">—</span>}</td>
                      <td className="left"><Truncate focusable>{u.email}</Truncate></td>
                      <td>{u.phone ?? <span className="muted">—</span>}</td>
                      <td><ManagerCell id={u.manager_id} names={managerNames} /></td>
                      <td className="keep"><AccountPill user={u} /></td>
                      <td className="keep"><LeavePill user={u} /></td>
                      <td className="keep sticky-end">
                        <div className="actions-cell">
                          <Link className="btn btn-sm btn-row-soft" to={userPath(u.emp_id)}>View</Link>
                          {isAdmin && <RowMenu label={`More actions for ${u.emp_name ?? u.emp_id}`} actions={rowActions(u)} />}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </ScrollTable>
        )}
        {list.isError && list.data && (
          <Callout tone="error">Showing the last loaded list. Refresh failed: {(list.error as Error).message}</Callout>
        )}
        <Pagination page={page} total={rows.length} onPage={(p) => update({ page: String(p) })} />
      </section>

      {dialog?.kind === 'status' && <StatusDialog user={dialog.user} onClose={() => setDialog(null)} onDone={setFlash} />}
      {dialog?.kind === 'leave' && <LeaveDialog user={dialog.user} onClose={() => setDialog(null)} onDone={setFlash} />}
    </div>
  )
}
