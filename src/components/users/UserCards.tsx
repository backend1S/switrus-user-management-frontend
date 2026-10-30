import type { User } from '../../types/api'
import { formatDate, leaveState } from '../../utils/format'
import { Fact, Facts, InfoCard } from '../ui/Facts'
import { Icon } from '../ui/Icon'
import { AccountPill, LeavePill } from './UserPills'

/** Account availability. `onChange` is passed only for people allowed to change it. */
export function AccountCard({ user, onChange }: { user: User; onChange?: () => void }) {
  return (
    <InfoCard title="Account" extra={<AccountPill user={user} />}>
      <p className="card-text">
        {user.is_disabled
          ? 'This account cannot sign in to Switrus apps and is hidden from CRM and accounting user lookups. The employee record is kept.'
          : 'This account can sign in to Switrus apps and appears in CRM and accounting user lookups.'}
      </p>
      {onChange &&
        (user.is_disabled ? (
          <button type="button" className="btn btn-outline" onClick={onChange}>
            <Icon name="userCheck" size={18} /> Enable account
          </button>
        ) : (
          <button type="button" className="btn btn-danger-outline" onClick={onChange}>
            <Icon name="userOff" size={18} /> Disable account
          </button>
        ))}
    </InfoCard>
  )
}

const LEAVE_TEXT = {
  on_leave: 'On leave today',
  upcoming: 'Leave booked',
  past: 'Last leave has ended',
  none: 'No leave recorded',
} as const

/** The one leave window per user (suspend_start / suspend_end). */
export function LeaveCard({ user, onChange }: { user: User; onChange?: () => void }) {
  const state = user.is_suspended ? 'on_leave' : leaveState(user.leave_start, user.leave_end)
  return (
    <InfoCard title="Leave" extra={<LeavePill user={user} />}>
      <Facts>
        <Fact label="Start date">{user.leave_start ? formatDate(user.leave_start) : null}</Fact>
        <Fact label="End date">{user.leave_end ? formatDate(user.leave_end) : null}</Fact>
        <Fact label="Current status" wide>{LEAVE_TEXT[state]}</Fact>
      </Facts>
      {onChange && (
        <button type="button" className="btn btn-outline" onClick={onChange}>
          <Icon name="calendar" size={18} /> {user.leave_start ? 'Change or clear leave' : 'Mark leave'}
        </button>
      )}
    </InfoCard>
  )
}
