import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { Brand } from '../components/ui/Brand'
import { Field } from '../components/ui/Field'
import { Icon } from '../components/ui/Icon'
import { Callout } from '../components/ui/States'
import { useAuth } from '../hooks/useAuth'
import { ApiError } from '../services/api'

/** Where to go after signing in: the page that sent us here, if it is ours. */
function returnPath(state: unknown): string {
  const from = (state as { from?: string } | null)?.from
  return from && from.startsWith('/') && !from.startsWith('//') && from !== '/login' ? from : '/users'
}

export function LoginPage() {
  const { session, signIn, signingIn, sessionEnded } = useAuth()
  const location = useLocation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<{ username?: string; password?: string }>({})
  const [formError, setFormError] = useState<{ tone: 'error' | 'warn'; text: string } | null>(null)

  if (session) return <Navigate to={returnPath(location.state)} replace />

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setFormError(null)
    const errs: typeof errors = {}
    if (!username.trim()) errs.username = 'Enter your user name'
    if (!password) errs.password = 'Enter your password'
    setErrors(errs)
    if (Object.keys(errs).length) return
    try {
      await signIn(username.trim(), password)
      // <Navigate> above takes over once the session is stored.
    } catch (err) {
      setPassword('')
      if (!(err instanceof ApiError)) {
        setFormError({ tone: 'error', text: 'Something went wrong. Try again.' })
      } else if (err.status === 403) {
        setFormError({ tone: 'warn', text: err.message })
      } else if (err.status === 422) {
        setFormError({ tone: 'error', text: 'Check the user name and password and try again.' })
      } else {
        setFormError({ tone: 'error', text: err.message })
      }
    }
  }

  return (
    <div className="login-shell">
      <header className="shell-header">
        <span className="brand">
          <Brand />
        </span>
      </header>
      <main className="login-main">
        <form className="card login-card" onSubmit={submit} noValidate aria-labelledby="login-title">
          <div className="login-head">
            <span className="login-mark" aria-hidden="true">
              <Icon name="shield" size={22} />
            </span>
            <h1 className="page-title" id="login-title">Sign in</h1>
            <p className="page-subtitle">Use your Switrus user name and password to open User Management.</p>
          </div>

          {sessionEnded && !formError && (
            <Callout tone="info" icon="clock">Your session ended. Sign in again to continue.</Callout>
          )}
          {formError && <Callout tone={formError.tone}>{formError.text}</Callout>}

          <fieldset className="login-fields" disabled={signingIn}>
            <Field label="User name" required error={errors.username}>
              {({ id, describedBy, invalid }) => (
                <input id={id} className="input" name="username" autoComplete="username" autoFocus
                  value={username} aria-invalid={invalid || undefined} aria-describedby={describedBy}
                  onChange={(e) => {
                    setUsername(e.target.value)
                    if (errors.username) setErrors(({ username: _u, ...rest }) => rest)
                  }} />
              )}
            </Field>
            <Field label="Password" required error={errors.password}>
              {({ id, describedBy, invalid }) => (
                <div className="input-wrap">
                  <input id={id} className="input" name="password" autoComplete="current-password"
                    type={showPassword ? 'text' : 'password'} value={password}
                    aria-invalid={invalid || undefined} aria-describedby={describedBy}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      if (errors.password) setErrors(({ password: _p, ...rest }) => rest)
                    }} />
                  <button type="button" className="icon-btn suffix-btn" onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword}>
                    <Icon name={showPassword ? 'eyeOff' : 'eye'} size={16} />
                  </button>
                </div>
              )}
            </Field>
          </fieldset>

          <button type="submit" className="btn btn-primary login-submit" disabled={signingIn}>
            {signingIn ? (
              <>
                <span className="spinner spinner-btn" aria-hidden="true" /> Signing in…
              </>
            ) : (
              'Sign in'
            )}
          </button>
          <div className="login-foot">
            <p>
              <strong>Forgot your password?</strong> Ask a Switrus administrator to help you reset it.
            </p>
            <p>What you can see and change depends on your Switrus role.</p>
          </div>
        </form>
      </main>
    </div>
  )
}
