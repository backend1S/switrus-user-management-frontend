import { Link, Navigate, Route, Routes } from 'react-router-dom'
import { EmptyState } from './components/ui/States'
import { AppLayout } from './layouts/AppLayout'
import { AdminOnly, RequireAuth } from './layouts/RequireAuth'
import { AttendancePage } from './pages/AttendancePage'
import { LoginPage } from './pages/LoginPage'
import { LoyaltriPage } from './pages/LoyaltriPage'
import { UserRecordPage } from './pages/UserDetailPage'
import { UserFormPage } from './pages/UserFormPage'
import { UsersPage } from './pages/UsersPage'

function NotFound() {
  return (
    <div className="card">
      <EmptyState icon="search" title="Page not found" text="The address may be mistyped or out of date."
        actions={<Link className="btn btn-secondary" to="/users">Go to users</Link>} />
    </div>
  )
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
        <Route index element={<Navigate to="/users" replace />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/users/new" element={<AdminOnly><UserFormPage mode="create" /></AdminOnly>} />
        {/* Employee IDs contain slashes (SHPL/DEL/0417/2026), so match the rest of the path.
            Read-only record for everyone; ?edit=1 opens the form for administrators. */}
        <Route path="/users/*" element={<UserRecordPage />} />
        {/* Read-only; who may see what is decided by the API. */}
        <Route path="/attendance" element={<AttendancePage />} />
        <Route path="/integrations/loyaltri" element={<AdminOnly><LoyaltriPage /></AdminOnly>} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
