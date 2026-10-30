import { Fragment, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../components/ui/Icon'
import { Bone, Callout, EmptyState, ErrorState, StatusPill } from '../components/ui/States'
import { Tooltip } from '../components/ui/Tooltip'
import { useLoyaltriStatus, useSyncRun, useSyncRuns, useTriggerSync } from '../hooks/useLoyaltri'
import { ApiError } from '../services/api'
import type { SyncItem, SyncRun } from '../types/api'
import { duration, formatDateTime, relativeTime } from '../utils/format'

const RUN_TONE: Record<string, 'ok' | 'wait' | 'info' | 'danger' | 'ended'> = {
  queued: 'wait',
  running: 'info',
  succeeded: 'ok',
  partial: 'wait',
  failed: 'danger',
  skipped: 'ended',
}
const RUN_LABEL: Record<string, string> = {
  queued: 'Queued',
  running: 'Running',
  succeeded: 'Succeeded',
  partial: 'Partly failed',
  failed: 'Failed',
  skipped: 'Skipped',
}
const ITEM: Record<SyncItem['outcome'], { tone: 'ok' | 'wait' | 'info' | 'danger' | 'ended'; label: string }> = {
  created: { tone: 'ok', label: 'Created' },
  updated: { tone: 'ok', label: 'Updated' },
  conflict: { tone: 'wait', label: 'Kept local value' },
  new: { tone: 'info', label: 'Not in Switrus' },
  skipped: { tone: 'ended', label: 'Skipped' },
  failed: { tone: 'danger', label: 'Failed' },
  unchanged: { tone: 'ended', label: 'Note' },
}
const TRIGGER: Record<string, string> = { manual: 'Manual', schedule: 'Scheduled', 'manual-cli': 'Command line' }

function RunPill({ run }: { run: SyncRun }) {
  return <StatusPill tone={RUN_TONE[run.status] ?? 'ended'}>{RUN_LABEL[run.status] ?? run.status}</StatusPill>
}

function Counts({ run }: { run: SyncRun }) {
  return (
    <div className="counts">
      <span><b>{run.records_received}</b> received</span>
      <span><b>{run.created}</b> created</span>
      <span><b>{run.updated}</b> updated</span>
      <span><b>{run.unchanged}</b> unchanged</span>
      <span><b>{run.conflicts}</b> kept local</span>
      <span><b>{run.skipped}</b> skipped</span>
      <span><b>{run.failed}</b> failed</span>
    </div>
  )
}

function RunDetail({ runId, colSpan }: { runId: string; colSpan: number }) {
  const q = useSyncRun(runId)
  return (
    <tr className="detail-row" id={`run-${runId}`}>
      <td colSpan={colSpan}>
        {q.isPending ? (
          <Bone w="60%" h={14} />
        ) : q.isError ? (
          <ErrorState message={(q.error as Error).message} onRetry={() => void q.refetch()} />
        ) : (
          <div className="card-section" style={{ gap: 12 }}>
            {q.data.error_message && (
              <Callout tone={q.data.status === 'failed' ? 'error' : 'info'}>{q.data.error_message}</Callout>
            )}
            {q.data.items.length === 0 ? (
              <span className="muted">
                {q.data.status === 'failed' ? 'No records were processed.' : 'Every record matched Switrus; nothing needed attention.'}
              </span>
            ) : (
              <div className="table-wrap" style={{ minHeight: 0 }}>
                <table className="table table-sub">
                  <thead>
                    <tr>
                      <th scope="col">Employee ID</th>
                      <th scope="col">Result</th>
                      <th scope="col">Fields</th>
                      <th scope="col">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {q.data.items.map((it, i) => (
                      <tr key={i}>
                        <td>
                          {it.emp_id ? <Link to={`/users/${encodeURIComponent(it.emp_id)}`}>{it.emp_id}</Link> : '—'}
                        </td>
                        <td><StatusPill tone={ITEM[it.outcome]?.tone ?? 'ended'}>{ITEM[it.outcome]?.label ?? it.outcome}</StatusPill></td>
                        <td>{it.fields.length ? it.fields.join(', ') : '—'}</td>
                        <td>{it.message ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </td>
    </tr>
  )
}

export function LoyaltriPage() {
  const status = useLoyaltriStatus()
  const active = !!status.data?.active_run
  const runs = useSyncRuns(active)
  const trigger = useTriggerSync()
  const [open, setOpen] = useState<string | null>(null)
  const s = status.data
  // Switched off on purpose (LOYALTRI_CLIENT=disabled): a setting, not a fault.
  const notConfigured = s?.config.client_mode === 'disabled'

  const syncBlocked = !s ? 'Loading status…'
    : notConfigured ? 'Loyaltri sync is not configured on the server.'
    : !s.tables_ready ? 'The sync tables are not installed yet.'
    : !s.configured ? 'Loyaltri is not configured yet.'
    : active ? 'A sync is already queued or running.'
    : null

  const workerNote = s && s.configured && s.tables_ready && !s.worker.alive

  return (
    <div className="page-inner">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link to="/users">Users</Link>
        <span className="sep" aria-hidden="true">/</span>
        <span aria-current="page">Loyaltri sync</span>
      </nav>
      <div className="page-header">
        <div className="titles">
          <h1 className="page-title">Loyaltri HRMS sync</h1>
          <div className="page-subtitle">Copies permitted employee details from Loyaltri into Switrus.</div>
        </div>
        <div className="page-actions">
          <Tooltip content={syncBlocked}>
            <button
              type="button"
              className="btn btn-primary"
              aria-disabled={syncBlocked || trigger.isPending ? true : undefined}
              onClick={() => !syncBlocked && !trigger.isPending && trigger.mutate()}
            >
              <Icon name="sync" size={18} />
              {trigger.isPending ? 'Queuing…' : active ? 'Sync in progress…' : 'Sync now'}
            </button>
          </Tooltip>
        </div>
      </div>

      <Callout tone="info" icon="shield">
        <strong>Switrus does not depend on Loyaltri.</strong> Sign-in, user editing, disabling and leave keep working
        when Loyaltri is slow or offline; a failed sync changes nothing in Switrus. The sync never deletes or disables
        users and never changes passwords, roles or leave.
      </Callout>

      {trigger.isError && (
        <Callout tone="error">{trigger.error instanceof ApiError ? trigger.error.message : 'Could not queue the sync.'}</Callout>
      )}
      {trigger.data?.already_active && <Callout tone="info">A sync was already queued; showing its progress.</Callout>}
      {workerNote && (
        <Callout tone="warn">
          <strong>No sync worker is running.</strong> Queued syncs will wait until the worker starts
          {s?.worker.last_heartbeat ? ` (last seen ${relativeTime(s.worker.last_heartbeat)})` : ''}. Start it with{' '}
          <code>python -m services.loyaltri.loyaltri_scheduler</code> or the <code>sync-worker</code> container.
        </Callout>
      )}

      {status.isError ? (
        <div className="card">
          <ErrorState message={(status.error as Error).message} onRetry={() => void status.refetch()} />
        </div>
      ) : !s ? (
        <div className="health-strip skeleton-region" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="health"><Bone w={80} h={10} /><Bone w={140} h={18} /><Bone w={180} h={10} /></div>
          ))}
        </div>
      ) : (
        <>
          <section className="health-strip" aria-label="Sync status">
            <div className={`health ${notConfigured ? 'info' : s.configured && s.tables_ready ? 'ok' : 'warn'}`}>
              <span className="micro">Connection</span>
              <span className="value">
                {notConfigured ? <StatusPill tone="ended">Not configured</StatusPill>
                  : s.configured && s.tables_ready ? <StatusPill tone="ok">Configured</StatusPill>
                  : <StatusPill tone="wait">Not ready</StatusPill>}
                <span style={{ fontSize: 13 }}>
                  {s.config.client_mode === 'mock' ? 'Mock data (development)' : s.config.client_mode === 'http' ? 'Loyaltri API' : 'Disabled'}
                </span>
              </span>
              <span className="sub">
                {s.config.base_url ?? 'No API address set'} · credentials {s.config.credentials_set ? 'set' : 'not set'}
              </span>
            </div>
            <div className={`health ${s.last_success ? 'ok' : 'info'}`}>
              <span className="micro">Last successful sync</span>
              <span className="value">{s.last_success ? relativeTime(s.last_success.finished_at) : 'Never'}</span>
              <span className="sub">
                {s.last_success ? formatDateTime(s.last_success.finished_at) : 'No sync has completed yet.'}
              </span>
            </div>
            <div className={`health ${!s.last_attempt ? 'info' : s.last_attempt.status === 'failed' ? 'bad' : s.last_attempt.status === 'partial' ? 'warn' : 'ok'}`}>
              <span className="micro">Last attempt</span>
              <span className="value">
                {s.active_run ? <RunPill run={s.active_run} /> : s.last_attempt ? <RunPill run={s.last_attempt} /> : 'None yet'}
                {s.last_attempt && !s.active_run && <span style={{ fontSize: 13 }}>{relativeTime(s.last_attempt.finished_at)}</span>}
              </span>
              <span className="sub">
                {s.config.scheduled_sync_enabled
                  ? `Every ${s.config.interval_minutes} min${s.next_scheduled_at ? ` · next ${relativeTime(s.next_scheduled_at)}` : ''}`
                  : 'Scheduled sync is off; manual only'}
              </span>
            </div>
          </section>

          {s.last_attempt?.status === 'failed' && !s.active_run && (
            <Callout tone="error">
              <strong>The last sync failed:</strong> {s.last_attempt.error_message ?? 'unknown error'}. Switrus users were
              not changed. Fix the cause and choose Sync now, or wait for the next scheduled run.
            </Callout>
          )}

          <div className="two-col">
            {notConfigured ? (
              <section className="card card-section" aria-label="Not configured">
                <div className="card-header">
                  <h2 className="card-title">Not configured</h2>
                  <span className="grow" />
                  <StatusPill tone="ended">Off</StatusPill>
                </div>
                <hr className="divider" />
                <p className="modal-text" style={{ margin: 0 }}>
                  Loyaltri sync is switched off on the server. Everything else in User Management works normally.
                </p>
                <span className="field-help">
                  To turn it on later: get the Loyaltri API documentation and credentials, set the LOYALTRI_* environment
                  variables{!s.tables_ready ? ', run database/migrations/001_audit_and_loyaltri.sql' : ''} and restart the
                  API. See docs/LOYALTRI.md in the backend project.
                </span>
              </section>
            ) : s.problems.length > 0 && (
              <section className="card card-section" aria-label="Setup needed">
                <div className="card-header">
                  <h2 className="card-title">Setup needed</h2>
                </div>
                <hr className="divider" />
                <ul className="problems">
                  {s.problems.map((p) => <li key={p}>{p}</li>)}
                </ul>
                <span className="field-help">Settings are environment variables on the server. See docs/LOYALTRI.md in the backend project.</span>
              </section>
            )}
            {s.last_attempt && (
              <section className="card card-section" aria-label="Last sync result">
                <div className="card-header">
                  <h2 className="card-title">Last sync result</h2>
                  <span className="grow" />
                  <RunPill run={s.last_attempt} />
                </div>
                <hr className="divider" />
                <Counts run={s.last_attempt} />
                <span className="field-help">
                  Started {formatDateTime(s.last_attempt.started_at)} · took {duration(s.last_attempt.started_at, s.last_attempt.finished_at)}
                </span>
              </section>
            )}
            <section className="card card-section" aria-label="Field ownership">
              <div className="card-header">
                <h2 className="card-title">What the sync may change</h2>
              </div>
              <hr className="divider" />
              <dl className="kv">
                <dt>Matched on</dt>
                <dd>Employee ID (Loyaltri code = Switrus EMPID)</dd>
                <dt>Loyaltri owns</dt>
                <dd className="chips">
                  {s.config.field_policy.owned_fields.length ? s.config.field_policy.owned_fields.map((f) => <span key={f} className="chip">{f}</span>) : '—'}
                </dd>
                <dt>Fills if empty</dt>
                <dd className="chips">
                  {s.config.field_policy.fill_empty_fields.length ? s.config.field_policy.fill_empty_fields.map((f) => <span key={f} className="chip">{f}</span>) : '—'}
                </dd>
                <dt>Local edits</dt>
                <dd>{s.config.field_policy.overwrite_local_changes ? 'Loyaltri overwrites them' : 'Kept; reported as "kept local value"'}</dd>
                <dt>New employees</dt>
                <dd>{s.config.field_policy.create_mode === 'disabled' ? 'Created as disabled accounts for review' : 'Reported only, not created'}</dd>
                <dt>Never changed</dt>
                <dd className="chips">
                  {['passwords', 'role', 'disabled status', 'leave', 'employee ID'].map((f) => <span key={f} className="chip grey">{f}</span>)}
                </dd>
              </dl>
            </section>
          </div>
        </>
      )}

      <section className="card card-section" aria-labelledby="history-heading">
        <div className="card-header">
          <h2 className="card-title" id="history-heading">Sync history</h2>
        </div>
        {runs.isError ? (
          <ErrorState message={(runs.error as Error).message} onRetry={() => void runs.refetch()} />
        ) : runs.data && runs.data.length === 0 ? (
          <EmptyState icon="sync" title="No syncs yet"
            text={s?.configured ? 'Choose Sync now to run the first one.' : 'Configure Loyaltri on the server, then run the first sync.'} />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col" className="left">Requested</th>
                  <th scope="col">Trigger</th>
                  <th scope="col">Status</th>
                  <th scope="col">Received</th>
                  <th scope="col">Created</th>
                  <th scope="col">Updated</th>
                  <th scope="col">Kept local</th>
                  <th scope="col">Failed</th>
                  <th scope="col">Duration</th>
                  <th scope="col">Details</th>
                </tr>
              </thead>
              <tbody>
                {!runs.data
                  ? Array.from({ length: 3 }, (_, i) => (
                      <tr key={i} aria-hidden="true">
                        {Array.from({ length: 10 }, (_, c) => <td key={c}><Bone w={c === 0 ? 120 : 40} /></td>)}
                      </tr>
                    ))
                  : runs.data.map((r) => {
                      const isOpen = open === r.run_id
                      return (
                        <Fragment key={r.run_id}>
                          <tr className={`clickable ${isOpen ? 'open-row' : ''}`} onClick={(e) => {
                            if (!(e.target as HTMLElement).closest('button, a')) setOpen(isOpen ? null : r.run_id)
                          }}>
                            <td className="left">
                              <div className="stack left">
                                {formatDateTime(r.requested_at)}
                                <span className="sub">{r.requested_by ? `by ${r.requested_by}` : relativeTime(r.requested_at)}</span>
                              </div>
                            </td>
                            <td>{TRIGGER[r.trigger_type] ?? r.trigger_type}</td>
                            <td><RunPill run={r} /></td>
                            <td>{r.records_received}</td>
                            <td>{r.created}</td>
                            <td>{r.updated}</td>
                            <td>{r.conflicts}</td>
                            <td>{r.failed}</td>
                            <td>{duration(r.started_at, r.finished_at)}</td>
                            <td>
                              <button type="button" className="btn btn-sm btn-ghost" aria-expanded={isOpen}
                                aria-controls={`run-${r.run_id}`} onClick={() => setOpen(isOpen ? null : r.run_id)}
                                style={{ minWidth: 90 }}>
                                {isOpen ? 'Hide' : 'View'}
                                <Icon name="chevronDown" size={14} className={`chevron ${isOpen ? 'open' : ''}`} />
                              </button>
                            </td>
                          </tr>
                          {isOpen && <RunDetail runId={r.run_id} colSpan={10} />}
                        </Fragment>
                      )
                    })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
