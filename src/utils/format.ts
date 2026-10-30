const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Today's date in IST (the server evaluates leave in IST), as YYYY-MM-DD. */
export function todayIST(now: Date = new Date()): string {
  const ist = new Date(now.getTime() + (330 + now.getTimezoneOffset()) * 60_000)
  return toISODate(ist)
}

export function toISODate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export function parseISODate(s: string | null | undefined): Date | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const [y, m, d] = s.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.getMonth() === m - 1 ? date : null
}

/** DD/MM/YYYY for tables and fields; "—" for missing. */
export function formatDate(s: string | null | undefined): string {
  const d = parseISODate(s)
  if (!d) return '—'
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

/** "3 Nov 2026" */
export function formatDateLong(s: string | null | undefined): string {
  const d = parseISODate(s)
  return d ? `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}` : '—'
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${hh}:${mm}`
}

export function relativeTime(iso: string | null | undefined, now: number = Date.now()): string {
  if (!iso) return 'never'
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return '—'
  const s = Math.round((now - t) / 1000)
  if (s < 0) {
    const ahead = -s
    if (ahead < 60) return 'in under a minute'
    if (ahead < 3600) return `in ${Math.round(ahead / 60)} min`
    return `in ${Math.round(ahead / 3600)} h`
  }
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.round(s / 60)} min ago`
  if (s < 86400) return `${Math.round(s / 3600)} h ago`
  return `${Math.round(s / 86400)} d ago`
}

export function duration(start: string | null, end: string | null): string {
  if (!start || !end) return '—'
  const ms = new Date(end).getTime() - new Date(start).getTime()
  if (!(ms >= 0)) return '—'
  if (ms < 1000) return '<1s'
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`
}

export function compactNumber(n: number): string {
  if (n < 1000) return String(n)
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0).replace(/\.0$/, '')}K`
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
}

export function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

export type LeaveState = 'none' | 'on_leave' | 'upcoming' | 'past'

export function leaveState(start: string | null, end: string | null, today = todayIST()): LeaveState {
  if (!start || !end) return 'none'
  if (start <= today && today <= end) return 'on_leave'
  if (start > today) return 'upcoming'
  return 'past'
}

/** 510 -> "8h 30m"; 0 -> "0h"; null -> "—". */
export function formatMinutes(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || !Number.isFinite(minutes)) return '—'
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  return m ? `${h}h ${m}m` : `${h}h`
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** "2026-10-01" -> "Thu" */
export function weekday(iso: string): string {
  const d = parseISODate(iso)
  return d ? WEEKDAYS[d.getDay()] : ''
}

/** First day of the current month in IST, YYYY-MM-DD. */
export function firstOfMonthIST(now: Date = new Date()): string {
  return todayIST(now).slice(0, 8) + '01'
}

/** Inclusive number of days between two ISO dates (0 if either is invalid). */
export function daysInclusive(from: string, to: string): number {
  const a = parseISODate(from)
  const b = parseISODate(to)
  if (!a || !b) return 0
  return Math.round((b.getTime() - a.getTime()) / 86_400_000) + 1
}
