import type { ReactNode } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { EmptyState, ErrorState } from '../components/ui/States'
import { useAuth } from '../hooks/useAuth'

/** Signed-in users only; others go to /login and come back afterwards. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, checkError, retryCheck, signOut } = useAuth()
  const location = useLocation()

  if (checkError) {
    return (
      <div className="login-shell">
        <main className="login-main">
          <div className="card login-card">
            {checkError.status === 403 ? (
              <EmptyState icon="shield" title="No access to User Management" text={checkError.message}
                actions={<button type="button" className="btn btn-secondary" onClick={() => void signOut()}>Sign out</button>} />
            ) : (
              <ErrorState message={checkError.message} onRetry={retryCheck} />
            )}
          </div>
        </main>
      </div>
    )
  }
  if (session === undefined) {
    return (
      <div className="login-shell" aria-busy="true">
        <div className="login-main">
          <div className="spinner" role="status" aria-label="Checking your session" />
        </div>
      </div>
    )
  }
  if (session === null) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }
  return <>{children}</>
}

/** Admin-only pages. The API enforces this too; this only avoids a dead end. */
export function AdminOnly({ children }: { children: ReactNode }) {
  const { isAdmin } = useAuth()
  if (isAdmin) return <>{children}</>
  return (
    <div className="card">
      <EmptyState icon="shield" title="Administrator access needed"
        text="Your role can view users but not change them. Ask an administrator if you need this page."
        actions={<Link className="btn btn-secondary" to="/users">Back to users</Link>} />
    </div>
  )
}
