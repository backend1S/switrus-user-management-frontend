import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { attendanceApi } from '../services/endpoints'

export const attendanceKeys = {
  access: ['attendance', 'access'] as const,
  muster: (from: string, to: string) => ['attendance', 'muster', from, to] as const,
}

/** Whether this person may open the attendance page (no call to the attendance service). */
export function useAttendanceAccess(enabled = true) {
  return useQuery({ queryKey: attendanceKeys.access, queryFn: attendanceApi.access, staleTime: 5 * 60_000, enabled })
}

/** Loads only once a range has been chosen and submitted. */
export function useMuster(range: { from: string; to: string } | null) {
  return useQuery({
    queryKey: attendanceKeys.muster(range?.from ?? '', range?.to ?? ''),
    queryFn: ({ signal }) => attendanceApi.muster(range!.from, range!.to, signal),
    enabled: !!range,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  })
}
