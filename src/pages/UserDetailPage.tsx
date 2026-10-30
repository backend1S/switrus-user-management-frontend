import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Crumbs } from '../components/ui/Breadcrumbs'
import { Fact, Facts, InfoCard } from '../components/ui/Facts'
import { Icon } from '../components/ui/Icon'
import { Bone, Callout, EmptyState, ErrorState } from '../components/ui/States'
import { AccountCard, LeaveCard } from '../components/users/UserCards'
import { LeaveDialog, StatusDialog } from '../components/users/UserDialogs'
import { AccountPill, LeavePill, UserAvatar } from '../components/users/UserPills'
import { useAuth } from '../hooks/useAuth'
import { useAllUsers, useUser } from '../hooks/useUsers'
import { ApiError } from '../services/api'
import { empIdFromPath, userPath } from '../utils/routes'
import { UserFormPage } from './UserFormPage'

/** /users/<id> shows the record; administrators get the edit form with ?edit=1. */
export function UserRecordPage() {
  const [params] = useSearchParams()
  const { isAdmin } = useAuth()
  if (isAdmin && params.get('edit') === '1') return <UserFormPage mode="edit" />
  return <UserDetailPage />
}

function DetailSkeleton() {
  const facts = (n: number) => (
    <div className="facts">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="fact">
          <Bone w={72} h={10} />
          <Bone w="70%" h={14} />
        </div>
      ))}
    </div>
  )
  return (
    <div className="page-inner skeleton-region" aria-busy="true">
      <span className="sr-only" role="status">Loading employee</span>
      <Bone w={180} h={14} />
      <div className="card summary">
        <div className="summary-id">
          <Bone w={48} h={48} radius={999} />
          <div className="summary-names">
            <Bone w={200} h={20} />
            <Bone w={140} h={12} />
          </div>
        </div>
      </div>
      <div className="record">
        <div className="record-main">
          {[2, 3, 4].map((n) => (
            <div key={n} className="card card-section">
              <Bone w={120} h={16} />
              {facts(n)}
            </div>
          ))}
        </div>
        <div className="record-side">
          {[1, 3].map((n) => (
            <div key={n} className="card card-section">
              <Bone w={100} h={16} />
              {facts(n)}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** A mail link, or null so <Fact> shows its "not recorded" dash. */
function mail(value: string | null) {
  return value ? <a className="fact-link" href={`mailto:${value}`}>{value}</a> : null
}

export function UserDetailPage() {
  const empId = empIdFromPath(useParams()['*'])
  const { isAdmin } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const userQuery = useUser(empId)
  const all = useAllUsers()
  const [dialog, setDialog] = useState<'status' | 'leave' | null>(null)
  const [flash, setFlash] = useState<string | null>((location.state as { flash?: string } | null)?.flash ?? null)

  // A message handed over by the add/edit form is shown once, not again on reload.
  useEffect(() => {
    if ((location.state as { flash?: string } | null)?.flash) {
      navigate(location.pathname + location.search, { replace: true, state: null })
    }
  }, [])

  useEffect(() => {
    if (!flash) return
    const t = window.setTimeout(() => setFlash(null), 6000)
    return () => window.clearTimeout(t)
  }, [flash])

  const user = userQuery.data
  const manager = useMemo(() => {
    const id = user?.manager_id?.trim().toUpperCase()
    return id ? all.data?.find((u) => u.emp_id.trim().toUpperCase() === id) : undefined
  }, [all.data, user?.manager_id])

  if (userQuery.isPending) return <DetailSkeleton />

  if (userQuery.isError || !user) {
    const status = userQuery.error instanceof ApiError ? userQuery.error.status : 0
    return (
      <div className="page-inner">
        <Crumbs label={empId ?? ''} />
        <div className="card">
          {status === 404 ? (
            <EmptyState icon="search" title={`No employee with ID ${empId}`}
              text="The ID may be mistyped, or the employee is outside the area you can view."
              actions={<Link className="btn btn-secondary" to="/users">Back to users</Link>} />
          ) : status === 403 ? (
            <EmptyState icon="shield" title="You cannot view this employee" text={(userQuery.error as Error).message}
              actions={<Link className="btn btn-secondary" to="/users">Back to users</Link>} />
          ) : (
            <ErrorState message={(userQuery.error as Error)?.message || 'Could not load this employee.'}
              onRetry={() => void userQuery.refetch()} />
          )}
        </div>
      </div>
    )
  }

  const name = user.emp_name || user.emp_id

  return (
    <div className="page-inner">
      <Crumbs label={name} />

      <section className="card summary" aria-label="Employee summary">
        <div className="summary-id">
          <UserAvatar name={user.emp_name} id={user.emp_id} />
          <div className="summary-names">
            <h1 className="page-title">{name}</h1>
            <div className="summary-sub">{user.emp_id}</div>
          </div>
        </div>
        <dl className="summary-items">
          <div className="summary-item"><dt className="micro">Role</dt><dd>{user.role || '—'}</dd></div>
          <div className="summary-item"><dt className="micro">Department</dt><dd>{user.department_id || '—'}</dd></div>
          <div className="summary-item"><dt className="micro">Branch</dt><dd>{user.branch_id || '—'}</dd></div>
          <div className="summary-item"><dt className="micro">Account</dt><dd><AccountPill user={user} /></dd></div>
          <div className="summary-item"><dt className="micro">Leave</dt><dd><LeavePill user={user} /></dd></div>
        </dl>
      </section>

      {flash && (
        <div role="status">
          <Callout tone="ok">{flash}</Callout>
        </div>
      )}

      <div className="record">
        <div className="record-main">
          <InfoCard title="Identity">
            <Facts>
              <Fact label="Employee ID">{user.emp_id}</Fact>
              <Fact label="Employee name">{user.emp_name}</Fact>
            </Facts>
          </InfoCard>

          <InfoCard title="Contact">
            <Facts>
              <Fact label="Email">{mail(user.email)}</Fact>
              <Fact label="Phone">{user.phone}</Fact>
              <Fact label="Department email" wide>{mail(user.dept_email)}</Fact>
            </Facts>
          </InfoCard>

          <InfoCard title="Organisation">
            <Facts>
              <Fact label="Department">{user.department_id}</Fact>
              <Fact label="Role">{user.role}</Fact>
              <Fact label="Branch">{user.branch_id}</Fact>
              <Fact label="Manager" sub={user.manager_id && manager?.emp_name ? user.manager_id : undefined}>
                {manager?.emp_name ? (
                  <Link className="fact-link" to={userPath(manager.emp_id)}>{manager.emp_name}</Link>
                ) : (
                  user.manager_id
                )}
              </Fact>
            </Facts>
          </InfoCard>
        </div>

        <aside className="record-side">
          <AccountCard user={user} onChange={isAdmin ? () => setDialog('status') : undefined} />
          <LeaveCard user={user} onChange={isAdmin ? () => setDialog('leave') : undefined} />
        </aside>
      </div>

      <div className="action-bar">
        <div className="info">
          {isAdmin ? (
            'Saved record. Use Edit details to change it.'
          ) : (
            <>
              <Icon name="shield" size={18} /> View only. Changes are managed by Switrus administrators.
            </>
          )}
        </div>
        <div className="buttons">
          <Link to="/users" className="btn btn-secondary btn-bar">Back to users</Link>
          {isAdmin && (
            <Link to={userPath(user.emp_id, true)} className="btn btn-primary btn-bar">
              <Icon name="edit" size={18} /> Edit details
            </Link>
          )}
        </div>
      </div>

      {dialog === 'status' && <StatusDialog user={user} onClose={() => setDialog(null)} onDone={setFlash} />}
      {dialog === 'leave' && <LeaveDialog user={user} onClose={() => setDialog(null)} onDone={setFlash} />}
    </div>
  )
}
