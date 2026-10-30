import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ApiError, setCsrfToken, setUnauthorizedHandler } from '../services/api'
import { authApi } from '../services/endpoints'
import type { Session } from '../types/api'

const meKey = ['auth', 'me'] as const

interface AuthValue {
  /** undefined while the first check runs, null when signed out. */
  session: Session | null | undefined
  isAdmin: boolean
  /** Readable description of what this person can see, or null for everything. */
  scopeLabel: string | null
  /** GET /auth/me failed for a reason other than "not signed in" (403 role, 5xx, network). */
  checkError: ApiError | null
  retryCheck: () => void
  /** True when a signed-in session was lost (expired, revoked, account disabled). */
  sessionEnded: boolean
  signIn: (username: string, password: string) => Promise<Session>
  signingIn: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

export function describeScope(s: Session | null | undefined): string | null {
  if (!s) return null
  const { scope, scope_branch_id: b, scope_department_id: d } = s.permissions
  if (scope === 'branch_department') return `${d} employees in branch ${b}`
  if (scope === 'branch') return `all departments in branch ${b}`
  return null
}

/** One /auth/me call per page load; its result is shared by every component. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const [sessionEnded, setSessionEnded] = useState(false)

  const me = useQuery({
    queryKey: meKey,
    queryFn: async () => {
      try {
        const s = await authApi.me()
        setCsrfToken(s.csrf_token)
        return s
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          setCsrfToken(null)
          return null
        }
        throw e
      }
    },
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    retry: (count, e) => (!(e instanceof ApiError) || e.status === 0 || e.status >= 500) && count < 1,
  })

  const dropSession = useCallback(() => {
    setCsrfToken(null)
    // Nothing loaded under the old session stays on screen.
    qc.removeQueries({ predicate: (q) => q.queryKey[0] !== 'auth' })
    qc.setQueryData(meKey, null)
  }, [qc])

  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (qc.getQueryData(meKey)) setSessionEnded(true)
      dropSession()
    })
    return () => setUnauthorizedHandler(null)
  }, [qc, dropSession])

  const login = useMutation({
    mutationFn: ({ username, password }: { username: string; password: string }) => authApi.login(username, password),
    onSuccess: (s) => {
      setCsrfToken(s.csrf_token)
      setSessionEnded(false)
      qc.removeQueries({ predicate: (q) => q.queryKey[0] !== 'auth' })
      qc.setQueryData(meKey, s)
    },
  })

  const signOut = useCallback(async () => {
    try {
      await authApi.logout()
    } catch {
      // The cookie is cleared server-side when reachable; locally we sign out regardless.
    } finally {
      setSessionEnded(false)
      dropSession()
    }
  }, [dropSession])

  const value = useMemo<AuthValue>(
    () => ({
      session: me.data,
      isAdmin: !!me.data?.permissions.can_edit,
      scopeLabel: describeScope(me.data),
      checkError: me.isError && me.error instanceof ApiError ? me.error : me.isError ? new ApiError(0, String(me.error)) : null,
      retryCheck: () => void me.refetch(),
      sessionEnded,
      signIn: (username, password) => login.mutateAsync({ username, password }),
      signingIn: login.isPending,
      signOut,
    }),
    [me.data, me.isError, me.error, me.refetch, sessionEnded, login.mutateAsync, login.isPending, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
