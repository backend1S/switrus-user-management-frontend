import { useMemo, useState, type FormEvent, type MouseEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { DatePicker } from '../components/ui/DatePicker'
import { Fact, Facts } from '../components/ui/Facts'
import { Field } from '../components/ui/Field'
import { Icon } from '../components/ui/Icon'
import { Modal } from '../components/ui/Modal'
import { ScrollTable } from '../components/ui/ScrollTable'
import { Select } from '../components/ui/Select'
import { StatCard } from '../components/ui/StatCard'
import { Bone, Callout, EmptyState, ErrorState, LoadingVeil } from '../components/ui/States'
import { Tooltip } from '../components/ui/Tooltip'
import { useAttendanceAccess, useMuster } from '../hooks/useAttendance'
import { useAuth } from '../hooks/useAuth'
import { ApiError } from '../services/api'
import type { AttendanceCategory, AttendanceDay, AttendanceEmployee, AttendanceMuster } from '../types/api'
import { daysInclusive, firstOfMonthIST, formatDate, formatMinutes, pad2, todayIST, weekday } from '../utils/format'
import { distinct } from '../utils/options'

const PILL: Record<AttendanceCategory, string> = {
  present: 'pill-ok', absent: 'pill-danger', off_day: 'pill-ended', half_day: 'pill-wait', leave: 'pill-info', other: 'pill-other',
}

/** Short code for the register: the API's own label when short, else its initials ("Casual Leave" -> "CL"). */
export function shortLabel(day: AttendanceDay): string {
  const label = day.status.trim()
  if (day.category === 'present' && label.length > 3) return 'P'
  if (day.category === 'absent' && label.length > 3) return 'A'
  if (day.category === 'half_day' && label.length > 3) return 'HD'
  if (day.category === 'off_day' && label.length > 3) return 'Off'
  if (label.length <= 4) return label
  const initials = label.split(/[\s/_-]+/).filter(Boolean).map((w) => w[0]).join('').toUpperCase()
  return initials.slice(0, 4) || label.slice(0, 3)
}

function dayTip(date: string, day: AttendanceDay) {
  const bits = [day.in_time && `In ${day.in_time}`, day.out_time && `Out ${day.out_time}`,
    day.work_minutes !== null && `Worked ${formatMinutes(day.work_minutes)}`,
    day.overtime_minutes ? `Overtime ${formatMinutes(day.overtime_minutes)}` : null].filter(Boolean)
  return `${formatDate(date)} (${weekday(date)}): ${day.status}${bits.length ? ` · ${bits.join(' · ')}` : ''}`
}

function StatePill({ day }: { day: AttendanceDay }) {
  return <span className={`pill ${PILL[day.category]}`}>{day.status}</span>
}

/** "presentDays" -> "Present days" for the attendance system's own summary keys. */
function humanize(key: string) {
  const s = key.replace(/[_-]+/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').trim().toLowerCase()
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function EmployeeDialog({ employee, muster, onClose }: { employee: AttendanceEmployee; muster: AttendanceMuster; onClose: () => void }) {
  const s = employee.summary
  const org = [employee.department_id, employee.branch_id].filter(Boolean).join(' · ')
  const reported = Object.entries(employee.source_summary)
  return (
    <Modal size="lg" title={employee.emp_name || employee.emp_id || 'Employee'} onClose={onClose}
      description={`${employee.emp_id ?? 'No employee code'}${org ? ` · ${org}` : ''} · ${formatDate(muster.from_date)} to ${formatDate(muster.to_date)}`}
      footer={<button type="button" className="btn btn-secondary" onClick={onClose} data-autofocus>Close</button>}>
      {!employee.matched && (
        <Callout tone="warn">This record matches no Switrus employee ID, so its branch and department are unknown.</Callout>
      )}
      <dl className="facts cols-4" aria-label="Summary for this range">
          <Fact label="Present">{String(s.present)}</Fact>
          <Fact label="Absent">{String(s.absent)}</Fact>
          <Fact label="Off days">{String(s.off_day)}</Fact>
          <Fact label="Leave">{String(s.leave)}</Fact>
          <Fact label="Half days">{String(s.half_day)}</Fact>
          <Fact label="Other states">{String(s.other)}</Fact>
          <Fact label="Work hours">{formatMinutes(s.work_minutes)}</Fact>
          <Fact label="Overtime">{formatMinutes(s.overtime_minutes)}</Fact>
      </dl>
      <div className="modal-scroll">
        <table className="table">
          <thead>
            <tr>
              <th scope="col" className="left">Date</th>
              <th scope="col">Status</th>
              <th scope="col">In</th>
              <th scope="col">Out</th>
              <th scope="col">Worked</th>
              <th scope="col">Overtime</th>
            </tr>
          </thead>
          <tbody>
            {muster.dates.map((d) => {
              const day = employee.days[d]
              return (
                <tr key={d}>
                  <td className="left num">{formatDate(d)} <span className="muted">{weekday(d)}</span></td>
                  <td>{day ? <StatePill day={day} /> : <span className="muted">No record</span>}</td>
                  <td className="num">{day?.in_time ?? '—'}</td>
                  <td className="num">{day?.out_time ?? '—'}</td>
                  <td className="num">{day ? formatMinutes(day.work_minutes) : '—'}</td>
                  <td className="num">{day ? formatMinutes(day.overtime_minutes) : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {reported.length > 0 && (
        <div className="card-section">
          <h3 className="card-title" style={{ fontSize: 14 }}>Reported by the attendance system</h3>
          <Facts>
            {reported.map(([k, v]) => (
              <Fact key={k} label={humanize(k)}>{String(v)}</Fact>
            ))}
          </Facts>
        </div>
      )}
    </Modal>
  )
}

/** Big totals as whole hours ("1,293h") so the card stays one line; the exact figure goes in the caption. */
function hoursCard(minutes: number | undefined): { value: string | undefined; caption: string } {
  if (minutes === undefined) return { value: undefined, caption: 'As recorded' }
  if (minutes < 100 * 60) return { value: formatMinutes(minutes), caption: 'As recorded' }
  return { value: `${Math.round(minutes / 60).toLocaleString('en-IN')}h`, caption: `Exactly ${formatMinutes(minutes)}` }
}

function Stats({ muster }: { muster?: AttendanceMuster }) {
  const t = muster?.totals
  const scoped = muster && muster.access.scope !== 'all'
  const work = hoursCard(t?.work_minutes)
  const ot = hoursCard(t?.overtime_minutes)
  return (
    <section className="stats" aria-label="Attendance counts">
      <StatCard label="Employees" value={t?.employees} caption={scoped ? 'In your area' : 'With attendance records'} tone="blue" icon="users" dot="#3B6FD8" />
      <StatCard label="Present" value={t?.present} caption="Employee-days" tone="green" icon="userCheck" dot="#4DB764" />
      <StatCard label="Absent" value={t?.absent} caption="Employee-days" tone="red" icon="userOff" dot="#E5484D" />
      <StatCard label="Off days" value={t?.off_day} caption="Off and holidays" tone="grey" icon="calendar" dot="#7F8690" />
      <StatCard label="Leave" value={t?.leave} caption="All leave types" tone="amber" icon="plane" dot="#A15C07" />
      <StatCard label="Half days" value={t?.half_day} caption={t?.other ? `Other states: ${t.other}` : 'Employee-days'} tone="amber" icon="clock" dot="#A15C07" />
      <StatCard label="Work hours" value={work.value} caption={work.caption} tone="purple" icon="clock" dot="#6D28D9" />
      <StatCard label="Overtime" value={ot.value} caption={ot.caption} tone="blue" icon="clock" dot="#3B6FD8" />
    </section>
  )
}

function TableSkeleton() {
  return (
    <div className="table-wrap" aria-hidden="true">
      <table className="table">
        <tbody>
          {Array.from({ length: 6 }, (_, r) => (
            <tr key={r}>
              {[120, 160, 60, 50, 40, 40, 40, 40, 70].map((w, c) => (
                <td key={c}><Bone w={w} h={12} /></td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const SUMMARY_COLUMNS = ['Employee ID', 'Employee name', 'Department', 'Branch', 'Present', 'Absent', 'Off', 'Leave', 'Half day', 'Other', 'Work hours', 'Overtime', 'Actions']

export function AttendancePage() {
  const { session } = useAuth()
  const scope = session?.permissions.scope ?? 'all'
  const access = useAttendanceAccess()
  const [params, setParams] = useSearchParams()
  const applied = params.get('from') && params.get('to') ? { from: params.get('from')!, to: params.get('to')! } : null

  const [from, setFrom] = useState(applied?.from ?? firstOfMonthIST())
  const [to, setTo] = useState(applied?.to ?? todayIST())
  const [errors, setErrors] = useState<{ from?: string; to?: string }>({})
  const [view, setView] = useState<'summary' | 'register'>('summary')
  const [search, setSearch] = useState('')
  const [branch, setBranch] = useState('')
  const [dept, setDept] = useState('')
  const [detail, setDetail] = useState<AttendanceEmployee | null>(null)

  const allowed = !!access.data?.allowed
  const muster = useMuster(allowed ? applied : null)
  const maxDays = access.data?.max_range_days ?? 31

  const load = (e: FormEvent) => {
    e.preventDefault()
    const errs: typeof errors = {}
    if (!from) errs.from = 'Choose the first day'
    if (!to) errs.to = 'Choose the last day'
    if (from && to && to < from) errs.to = 'The last day cannot be before the first day'
    else if (from && to && daysInclusive(from, to) > maxDays) errs.to = `Choose at most ${maxDays} days`
    setErrors(errs)
    if (Object.keys(errs).length) return
    setParams({ from, to }, { replace: false })
  }

  const data = muster.data
  const options = useMemo(() => ({
    branch: distinct((data?.employees ?? []).map((e) => e.branch_id)),
    dept: distinct((data?.employees ?? []).map((e) => e.department_id)),
  }), [data])

  const rows = useMemo(() => {
    const q = search.trim().toUpperCase()
    return (data?.employees ?? []).filter((e) =>
      (!q || (e.emp_name ?? '').toUpperCase().includes(q) || (e.emp_id ?? '').toUpperCase().includes(q)) &&
      (!branch || (e.branch_id ?? '').toUpperCase() === branch.toUpperCase()) &&
      (!dept || (e.department_id ?? '').toUpperCase() === dept.toUpperCase()))
  }, [data, search, branch, dept])
  const filtered = !!(search.trim() || branch || dept)
  const clearFilters = () => {
    setSearch('')
    setBranch('')
    setDept('')
  }

  const openRow = (e: AttendanceEmployee, ev: MouseEvent) => {
    if ((ev.target as HTMLElement).closest('button, a, input') || window.getSelection()?.toString()) return
    setDetail(e)
  }

  const header = (
    <div className="page-header">
      <div className="titles">
        <h1 className="page-title">Attendance Muster</h1>
        <div className="page-subtitle">Read-only attendance from the Switrus attendance system.</div>
      </div>
    </div>
  )

  if (access.isPending) {
    return (
      <div className="page-inner">
        {header}
        <div className="card"><Bone w="60%" h={14} /></div>
      </div>
    )
  }
  if (access.isError || !allowed) {
    const reason = access.isError ? (access.error as Error).message : access.data?.reason
    return (
      <div className="page-inner">
        {header}
        <div className="card">
          {access.isError ? (
            <ErrorState message={reason || 'Could not check attendance access.'} onRetry={() => void access.refetch()} />
          ) : (
            <EmptyState icon="shield" title="Attendance is not available to you" text={reason ?? undefined} />
          )}
          {!!access.data?.problems?.length && (
            <Callout tone="warn">
              <strong>Configuration needed:</strong>
              <ul className="problems">{access.data.problems.map((p) => <li key={p}>{p}</li>)}</ul>
            </Callout>
          )}
        </div>
      </div>
    )
  }

  const err = muster.error instanceof ApiError ? muster.error : null
  const firstLoad = muster.isFetching && !data

  return (
    <div className="page-inner">
      {header}

      <form className="card range-form" onSubmit={load} noValidate aria-label="Date range">
        <Field label="From date" required error={errors.from}>
          {({ id, describedBy, invalid }) => (
            <DatePicker id={id} value={from} invalid={invalid} rangeWith={to} aria-describedby={describedBy}
              onChange={(v) => {
                setFrom(v)
                setErrors({})
              }} />
          )}
        </Field>
        <Field label="To date" required error={errors.to}>
          {({ id, describedBy, invalid }) => (
            <DatePicker id={id} value={to} invalid={invalid} min={from || undefined} rangeWith={from}
              aria-describedby={describedBy} onChange={(v) => {
                setTo(v)
                setErrors({})
              }} />
          )}
        </Field>
        <button type="submit" className="btn btn-primary" disabled={muster.isFetching}>
          <Icon name="search" size={16} />
          {muster.isFetching ? 'Loading…' : 'Load attendance'}
        </button>
        <div className="range-hint">Both days are included, up to {maxDays} days at a time.</div>
      </form>

      {!applied ? (
        <div className="card">
          <EmptyState icon="calendar" title="Choose a date range"
            text="Pick the first and last day, then load attendance. Nothing is fetched until you do." />
        </div>
      ) : err && !data ? (
        <div className="card">
          {err.status === 403 ? (
            <EmptyState icon="shield" title="Attendance is not available to you" text={err.message} />
          ) : (
            <ErrorState message={err.message || 'Could not load attendance.'} onRetry={() => void muster.refetch()} />
          )}
        </div>
      ) : (
        <>
          {data?.warnings.map((w) => <Callout key={w} tone="warn">{w}</Callout>)}
          {data?.mapping && (
            <Callout tone="info" icon="link">
              {data.mapping.matched} of {data.mapping.upstream_records} attendance records match a Switrus employee ID.
              {data.mapping.unmatched > 0 &&
                ` ${data.mapping.unmatched} do not${data.mapping.show_unmatched ? ' and are listed as “Not in Switrus”.' : ' and are hidden.'}`}
              {data.mapping.duplicate_code_records > 0 &&
                ` ${data.mapping.duplicate_code_records} share an employee code and are not shown.`}
              {data.mapping.missing_code > 0 && ` ${data.mapping.missing_code} have no employee code.`}
            </Callout>
          )}
          {err && data && <Callout tone="error">Showing the last loaded range. Refresh failed: {err.message}</Callout>}

          <Stats muster={firstLoad ? undefined : data} />

          {!!data?.states.length && (
            <section className="card card-section" aria-label="Statuses returned">
              <div>
                <h2 className="card-title">Statuses returned</h2>
                <p className="field-help" style={{ margin: '4px 0 0', fontSize: 12 }}>
                  Exactly as the attendance system sends them, counted in employee-days.
                </p>
              </div>
              <div className="state-list">
                {data.states.map((s) => (
                  <span key={s.label} className={`pill ${PILL[s.category]}`}>
                    {s.label}<span className="count">{s.count}</span>
                  </span>
                ))}
              </div>
            </section>
          )}

          <section className="card card-section" aria-labelledby="att-heading">
            <div className="card-header">
              <h2 className="card-title" id="att-heading">Employees</h2>
              {data && <span className="count-badge">{rows.length > 99 ? '99+' : pad2(rows.length)}</span>}
              <span className="grow" />
              <div className="segmented" role="radiogroup" aria-label="View">
                <button type="button" role="radio" aria-checked={view === 'summary'} onClick={() => setView('summary')}>Summary</button>
                <button type="button" role="radio" aria-checked={view === 'register'} onClick={() => setView('register')}>Daily register</button>
              </div>
            </div>

            <div className="filter-bar" role="search">
              <label className="search">
                <Icon name="search" size={16} />
                <span className="sr-only">Search by employee name or ID</span>
                <input type="search" placeholder="Search name or employee ID" value={search} onChange={(e) => setSearch(e.target.value)} />
              </label>
              {scope !== 'branch_department' && (
                <Select aria-label="Department" placeholder="All departments" value={dept}
                  options={[{ value: '', label: 'All departments' }, ...options.dept]} onChange={setDept} />
              )}
              {scope === 'all' && (
                <Select aria-label="Branch" placeholder="All branches" value={branch}
                  options={[{ value: '', label: 'All branches' }, ...options.branch]} onChange={setBranch} />
              )}
            </div>

            {firstLoad ? (
              <TableSkeleton />
            ) : rows.length === 0 ? (
              <div className="table-wrap">
                {filtered ? (
                  <EmptyState icon="search" title="No employees match these filters"
                    actions={<button type="button" className="btn btn-secondary" onClick={clearFilters}>Clear filters</button>} />
                ) : (
                  <EmptyState icon="calendar" title="No attendance records for this range"
                    text={data?.access.scope === 'all'
                      ? 'The attendance system returned no records that match Switrus employees for these dates.'
                      : 'The attendance system returned no records for employees in your area for these dates.'} />
                )}
              </div>
            ) : view === 'summary' ? (
              <ScrollTable label="Attendance summary table" busy={muster.isFetching} resetKey={`${applied.from}${applied.to}`}
                overlay={muster.isFetching ? <LoadingVeil label="Updating attendance" /> : null}>
                <table className="table">
                  <thead>
                    <tr>
                      {SUMMARY_COLUMNS.map((c, i) => (
                        <th key={c} scope="col" className={i < 2 ? 'left' : i === SUMMARY_COLUMNS.length - 1 ? 'sticky-end' : undefined}>{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((e, i) => (
                      <tr key={e.emp_id ?? `row-${i}`} className="clickable" onClick={(ev) => openRow(e, ev)}>
                        <td className="left">{e.emp_id ?? <span className="muted">—</span>}</td>
                        <td className="left cell-name">
                          <Tooltip content={e.emp_name} onlyWhenTruncated>
                            <span className="cell-truncate">{e.emp_name ?? '—'}</span>
                          </Tooltip>
                          {!e.matched && <> <span className="pill pill-wait">Not in Switrus</span></>}
                        </td>
                        <td>{e.department_id ?? <span className="muted">—</span>}</td>
                        <td>{e.branch_id ?? <span className="muted">—</span>}</td>
                        <td className="num">{e.summary.present}</td>
                        <td className="num">{e.summary.absent}</td>
                        <td className="num">{e.summary.off_day}</td>
                        <td className="num">{e.summary.leave}</td>
                        <td className="num">{e.summary.half_day}</td>
                        <td className="num">{e.summary.other}</td>
                        <td className="num">{formatMinutes(e.summary.work_minutes)}</td>
                        <td className="num">{formatMinutes(e.summary.overtime_minutes)}</td>
                        <td className="keep sticky-end">
                          <button type="button" className="btn btn-sm btn-row-soft" onClick={() => setDetail(e)}
                            aria-label={`View attendance for ${e.emp_name ?? e.emp_id}`}>View</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollTable>
            ) : (
              <ScrollTable label="Daily attendance register" busy={muster.isFetching} resetKey={`${applied.from}${applied.to}`}
                overlay={muster.isFetching ? <LoadingVeil label="Updating attendance" /> : null}>
                <table className="table register">
                  <thead>
                    <tr>
                      <th scope="col" className="sticky-start">Employee</th>
                      {data!.dates.map((d) => (
                        <th key={d} scope="col" className={`day ${['Sat', 'Sun'].includes(weekday(d)) ? 'weekend' : ''}`}>
                          {d.slice(8)}<span className="dow">{weekday(d)}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((e, i) => (
                      <tr key={e.emp_id ?? `row-${i}`}>
                        <th scope="row" className="sticky-start">
                          <button type="button" className="btn-link register-name" onClick={() => setDetail(e)}>
                            {e.emp_name ?? e.emp_id ?? '—'}
                          </button>
                          <div className="muted" style={{ fontSize: 11, fontWeight: 400 }}>{e.emp_id}</div>
                        </th>
                        {data!.dates.map((d) => {
                          const day = e.days[d]
                          return (
                            <td key={d} className="day">
                              {day ? (
                                <Tooltip content={dayTip(d, day)}>
                                  <span className={`day-chip ${day.category}`} tabIndex={0} aria-label={dayTip(d, day)}>
                                    {shortLabel(day)}
                                  </span>
                                </Tooltip>
                              ) : (
                                <span className="muted" aria-label={`${formatDate(d)}: no record`}>—</span>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollTable>
            )}
          </section>
        </>
      )}

      {detail && data && <EmployeeDialog employee={detail} muster={data} onClose={() => setDetail(null)} />}
    </div>
  )
}
