import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { loyaltriApi } from '../services/endpoints'

const keys = {
  status: ['loyaltri', 'status'] as const,
  runs: ['loyaltri', 'runs'] as const,
  run: (id: string) => ['loyaltri', 'run', id] as const,
}

/** Polls faster while a sync is queued or running. */
export function useLoyaltriStatus() {
  return useQuery({
    queryKey: keys.status,
    queryFn: loyaltriApi.status,
    refetchInterval: (q) => (q.state.data?.active_run ? 3000 : 30000),
  })
}

export function useSyncRuns(active: boolean) {
  return useQuery({
    queryKey: keys.runs,
    queryFn: () => loyaltriApi.runs(25),
    refetchInterval: active ? 3000 : 30000,
  })
}

export function useSyncRun(runId: string | null) {
  return useQuery({
    queryKey: keys.run(runId ?? ''),
    queryFn: () => loyaltriApi.run(runId!),
    enabled: !!runId,
  })
}

export function useTriggerSync() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: loyaltriApi.trigger,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.status })
      void qc.invalidateQueries({ queryKey: keys.runs })
    },
  })
}
