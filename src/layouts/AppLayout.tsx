import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { Brand } from '../components/ui/Brand'
import { Icon, type IconName } from '../components/ui/Icon'
import { Tooltip } from '../components/ui/Tooltip'
import { UserAvatar } from '../components/users/UserPills'
import { useAttendanceAccess } from '../hooks/useAttendance'
import { useAuth } from '../hooks/useAuth'
import { useMediaQuery } from '../hooks/useMediaQuery'

// Navigation by viewport: full sidebar from 1200px, icon rail from 860px, drawer below.
const RAIL = '(min-width: 860px) and (max-width: 1199.98px)'
const DESKTOP = '(min-width: 860px)'

function NavItems({ isAdmin, attendance, rail, onNavigate }: {
  isAdmin: boolean; attendance: boolean; rail: boolean; onNavigate: () => void
}) {
  const items: { to: string; icon: IconName; label: string }[] = [
    { to: '/users', icon: 'users', label: 'Users' },
    ...(attendance ? [{ to: '/attendance', icon: 'calendar' as const, label: 'Attendance' }] : []),
    ...(isAdmin ? [{ to: '/integrations/loyaltri', icon: 'sync' as const, label: 'Loyaltri sync' }] : []),
  ]
  return (
    <>
      {items.map(({ to, icon, label }) => {
        const link = (
          <NavLink key={to} to={to} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={onNavigate}>
            <Icon name={icon} />
            {/* Visually hidden on the icon rail, still the link's accessible name. */}
            <span className="nav-label">{label}</span>
          </NavLink>
        )
        return rail ? <Tooltip key={to} content={label}>{link}</Tooltip> : link
      })}
    </>
  )
}

export function AppLayout() {
  const { session, isAdmin, signOut } = useAuth()
  const [signingOut, setSigningOut] = useState(false)
  // Below 860px the sidebar is a drawer opened from the header.
  const [navOpen, setNavOpen] = useState(false)
  const toggle = useRef<HTMLButtonElement>(null)
  const nav = useRef<HTMLElement>(null)
  const rail = useMediaQuery(RAIL)
  // Shown when the API allows it; admins also see it so they can read the setup status there.
  const attendance = useAttendanceAccess(!!session)
  const showAttendance = isAdmin || !!attendance.data?.allowed
  const desktop = useMediaQuery(DESKTOP)

  // The drawer only exists below 860px; widening the window closes it.
  useEffect(() => {
    if (desktop) setNavOpen(false)
  }, [desktop])

  useEffect(() => {
    if (!navOpen) return
    nav.current?.querySelector<HTMLElement>('.nav-item')?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setNavOpen(false)
        toggle.current?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [navOpen])

  const onSignOut = async () => {
    setSigningOut(true)
    // Clearing the session makes <RequireAuth> show the sign-in page.
    await signOut()
  }

  const u = session?.user
  const p = session?.permissions

  return (
    <div className="shell">
      <header className="shell-header">
        <button ref={toggle} type="button" className="icon-btn header-icon menu-toggle" aria-label="Open navigation"
          aria-expanded={navOpen} aria-controls="app-nav" onClick={() => setNavOpen((v) => !v)}>
          <Icon name="menu" size={22} />
        </button>
        <Link className="brand" to="/users">
          <Brand />
        </Link>
        <span className="grow" />
        {u && p && (
          <div className="shell-user">
            <UserAvatar name={u.emp_name} id={u.emp_id} size={32} />
            <span className="who">
              <span className="name">{u.emp_name || u.emp_id}</span>
              <span className="role">
                {u.role}
                {isAdmin ? ' · full access' : ' · view only'}
                {p.scope_branch_id ? ` · ${p.scope_branch_id}` : ''}
                {p.scope_department_id ? ` / ${p.scope_department_id}` : ''}
              </span>
            </span>
            <button type="button" className="btn btn-sm btn-header" onClick={() => void onSignOut()} disabled={signingOut}>
              <Icon name="logout" size={16} />
              <span className="label">{signingOut ? 'Signing out…' : 'Sign out'}</span>
            </button>
          </div>
        )}
      </header>
      <div className="shell-body">
        {navOpen && <div className="nav-backdrop" onClick={() => setNavOpen(false)} aria-hidden="true" />}
        <nav ref={nav} id="app-nav" className={`sidebar ${navOpen ? 'open' : ''}`} aria-label="Main">
          <div className="sidebar-head">
            <span className="brand-name">Switrus</span>
            <button type="button" className="icon-btn" aria-label="Close navigation" onClick={() => {
              setNavOpen(false)
              toggle.current?.focus()
            }}>
              <Icon name="x" size={18} />
            </button>
          </div>
          <div className="nav-caption">{isAdmin ? 'Administration' : 'User Management'}</div>
          <NavItems isAdmin={isAdmin} attendance={showAttendance} rail={rail} onNavigate={() => setNavOpen(false)} />
          {p && (
            <div className="sidebar-foot">
              <div className="micro">Your access</div>
              <div className="sidebar-access">{isAdmin ? 'Full access' : 'View only'}</div>
              <div className="sidebar-scope">
                {p.scope === 'all'
                  ? 'All branches and departments'
                  : `Branch ${p.scope_branch_id}${p.scope === 'branch' ? ' · all departments' : ` · ${p.scope_department_id}`}`}
              </div>
            </div>
          )}
        </nav>
        <main className="page" id="main">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
