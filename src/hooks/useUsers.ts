import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { usersApi } from '../services/endpoints'
import type { LeaveBody, User, UserCreateBody, UserFilters, UserUpdateBody } from '../types/api'

export const userKeys = {
  all: ['users'] as const,
  list: (f: UserFilters) => ['users', 'list', f] as const,
  options: ['users', 'options'] as const,
  stats: ['users', 'stats'] as const,
  one: (id: string) => ['users', 'one', id.toUpperCase()] as const,
}

export function useUserList(filters: UserFilters) {
  return useQuery({
    queryKey: userKeys.list(filters),
    queryFn: ({ signal }) => usersApi.list(filters, signal),
    placeholderData: keepPreviousData,
  })
}

/** Every user (including disabled), for filter options and form suggestions. */
export function useAllUsers() {
  return useQuery({
    queryKey: userKeys.options,
    queryFn: ({ signal }) => usersApi.list({ include_disabled: true }, signal),
    staleTime: 5 * 60_000,
  })
}

export function useUserStats() {
  return useQuery({ queryKey: userKeys.stats, queryFn: usersApi.stats })
}

export function useUser(empId: string | undefined) {
  return useQuery({
    queryKey: userKeys.one(empId ?? ''),
    queryFn: () => usersApi.get(empId!),
    enabled: !!empId,
    retry: (count, err) => (err as { status?: number }).status !== 404 && count < 2,
  })
}

/** Put the server's returned user into every cache, then refresh counts. */
function adoptUser(qc: QueryClient, user: User) {
  qc.setQueryData(userKeys.one(user.emp_id), user)
  qc.setQueriesData<User[]>({ queryKey: ['users', 'list'] }, (rows) =>
    rows?.map((r) => (r.emp_id === user.emp_id ? user : r)),
  )
  qc.setQueryData<User[]>(userKeys.options, (rows) => rows?.map((r) => (r.emp_id === user.emp_id ? user : r)))
  // Filters (e.g. "hide disabled") and stats may now include/exclude this row.
  void qc.invalidateQueries({ queryKey: ['users', 'list'] })
  void qc.invalidateQueries({ queryKey: userKeys.stats })
}

export function useCreateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: UserCreateBody) => usersApi.create(body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: userKeys.all }),
  })
}

export function useUpdateUser(empId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: UserUpdateBody) => usersApi.update(empId, body),
    onSuccess: (user) => adoptUser(qc, user),
  })
}

export function useSetStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ empId, disabled }: { empId: string; disabled: boolean }) => usersApi.setStatus(empId, disabled),
    onSuccess: (user) => adoptUser(qc, user),
  })
}

export function useSetLeave() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ empId, body }: { empId: string; body: LeaveBody }) => usersApi.setLeave(empId, body),
    onSuccess: (user) => adoptUser(qc, user),
  })
}

export function useClearLeave() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (empId: string) => usersApi.clearLeave(empId),
    onSuccess: (user) => adoptUser(qc, user),
  })
}
