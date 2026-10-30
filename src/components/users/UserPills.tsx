import type { User } from '../../types/api'
import { formatDate, leaveState } from '../../utils/format'
import { Icon } from '../ui/Icon'
import { StatusPill } from '../ui/States'
import { Tooltip } from '../ui/Tooltip'

export function AccountPill({ user }: { user: User }) {
  return user.is_disabled ? <StatusPill tone="ended">Disabled</StatusPill> : <StatusPill tone="ok">Active</StatusPill>
}

/** On leave = blue (in progress), upcoming = amber with dates, none/past = "—". */
export function LeavePill({ user }: { user: User }) {
  const state = user.is_suspended ? 'on_leave' : leaveState(user.leave_start, user.leave_end)
  const range = `${formatDate(user.leave_start)} – ${formatDate(user.leave_end)}`
  if (state === 'on_leave')
    return (
      <Tooltip content={`On leave ${range}`}>
        <span className="pill pill-info" tabIndex={0}>
          <Icon name="plane" size={14} />
          On leave
        </span>
      </Tooltip>
    )
  if (state === 'upcoming')
    return (
      <Tooltip content={`Leave booked ${range}`}>
        <span className="pill pill-wait" tabIndex={0}>
          <Icon name="clock" size={14} />
          From {formatDate(user.leave_start)}
        </span>
      </Tooltip>
    )
  return <span className="muted">—</span>
}

/** "HEMANG C KANANI" -> "HK". Falls back to the first two characters of the ID. */
export function initials(name: string | null | undefined, fallback = ''): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (!words.length) return fallback.replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase()
  const first = words[0][0]
  const last = words.length > 1 ? words[words.length - 1][0] : words[0][1] ?? ''
  return (first + last).toUpperCase()
}

export function UserAvatar({ name, id, size = 48 }: { name: string | null | undefined; id?: string; size?: number }) {
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size >= 40 ? 16 : 12 }} aria-hidden="true">
      {initials(name, id)}
    </span>
  )
}
