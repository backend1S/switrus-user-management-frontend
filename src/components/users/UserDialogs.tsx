import { useState } from 'react'
import { useClearLeave, useSetLeave, useSetStatus } from '../../hooks/useUsers'
import { ApiError } from '../../services/api'
import type { User } from '../../types/api'
import { formatDateLong, todayIST } from '../../utils/format'
import { validateLeave } from '../../utils/validation'
import { DatePicker } from '../ui/DatePicker'
import { Field } from '../ui/Field'
import { Modal } from '../ui/Modal'
import { Callout } from '../ui/States'
import { UserAvatar } from './UserPills'

const nameOf = (u: User) => u.emp_name || u.emp_id

/** Who the change is for, so the confirmation can't be misread. */
function Subject({ user }: { user: User }) {
  const org = [user.role, user.department_id, user.branch_id].filter(Boolean).join(' · ')
  return (
    <div className="subject">
      <UserAvatar name={user.emp_name} id={user.emp_id} size={36} />
      <div className="subject-text">
        <div className="subject-name">{nameOf(user)}</div>
        <div className="subject-sub">{user.emp_id}{org ? ` · ${org}` : ''}</div>
      </div>
    </div>
  )
}

export function StatusDialog({ user, onClose, onDone }: { user: User; onClose: () => void; onDone: (msg: string) => void }) {
  const mutation = useSetStatus()
  const disabling = !user.is_disabled
  const submit = () =>
    mutation.mutate(
      { empId: user.emp_id, disabled: disabling },
      {
        onSuccess: (u) => {
          onDone(`${nameOf(u)} ${u.is_disabled ? 'was disabled' : 'was enabled'}`)
          onClose()
        },
      },
    )
  return (
    <Modal
      size="sm"
      busy={mutation.isPending}
      title={disabling ? `Disable ${nameOf(user)}?` : `Enable ${nameOf(user)}?`}
      description={
        disabling
          ? 'They will not be able to sign in, and they will be hidden from CRM and accounting user lookups. The employee record is not deleted; you can enable the account again at any time.'
          : 'They will be able to sign in again with their existing password, and will appear in CRM and accounting user lookups.'
      }
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </button>
          <button
            type="button"
            data-autofocus
            className={`btn ${disabling ? 'btn-danger' : 'btn-primary'}`}
            onClick={submit}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? (disabling ? 'Disabling…' : 'Enabling…') : disabling ? 'Disable user' : 'Enable user'}
          </button>
        </>
      }
    >
      <Subject user={user} />
      {mutation.error && (
        <Callout tone="error">{mutation.error instanceof ApiError ? mutation.error.message : 'Could not update the account.'}</Callout>
      )}
    </Modal>
  )
}

export function LeaveDialog({ user, onClose, onDone }: { user: User; onClose: () => void; onDone: (msg: string) => void }) {
  const [start, setStart] = useState(user.leave_start ?? '')
  const [end, setEnd] = useState(user.leave_end ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [confirmClear, setConfirmClear] = useState(false)
  const setLeave = useSetLeave()
  const clearLeave = useClearLeave()
  const busy = setLeave.isPending || clearLeave.isPending
  const today = todayIST()
  const error = setLeave.error ?? clearLeave.error
  const hasLeave = !!(user.leave_start && user.leave_end)

  const save = () => {
    const errs = validateLeave(start, end)
    setErrors(errs)
    if (Object.keys(errs).length) return
    setLeave.mutate(
      { empId: user.emp_id, body: { start_date: start, end_date: end } },
      {
        onSuccess: (u) => {
          onDone(`Leave saved for ${nameOf(u)}: ${formatDateLong(u.leave_start)} to ${formatDateLong(u.leave_end)}`)
          onClose()
        },
        onError: (e) => e instanceof ApiError && setErrors(e.fieldErrors),
      },
    )
  }

  const clear = () =>
    clearLeave.mutate(user.emp_id, {
      onSuccess: (u) => {
        onDone(`Leave cleared for ${nameOf(u)}`)
        onClose()
      },
    })

  return (
    <Modal
      busy={busy}
      title={hasLeave ? 'Change leave' : 'Mark leave'}
      description="Both days are included. Each employee has one leave window: saving new dates replaces the current leave."

      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={busy}>
            {setLeave.isPending ? 'Saving…' : 'Save leave'}
          </button>
        </>
      }
    >
      <Subject user={user} />
      {hasLeave && (
        <Callout tone="info" icon="calendar">
          Current leave: <strong>{formatDateLong(user.leave_start)}</strong> to{' '}
          <strong>{formatDateLong(user.leave_end)}</strong>
        </Callout>
      )}
      <div className="form-grid">
        <Field label="Start date" required error={errors.start_date}>
          {({ id, describedBy, invalid }) => (
            <DatePicker id={id} value={start} invalid={invalid} rangeWith={end} aria-describedby={describedBy}
              onChange={(v) => {
                setStart(v)
                if (v && (!end || end < v)) setEnd(v)
              }}
            />
          )}
        </Field>
        <Field label="End date" required error={errors.end_date}>
          {({ id, describedBy, invalid }) => (
            <DatePicker id={id} value={end} invalid={invalid} min={start || undefined} rangeWith={start}
              aria-describedby={describedBy} onChange={setEnd} />
          )}
        </Field>
      </div>
      {end && end < today && (
        <Callout tone="warn">These dates are in the past. That is allowed for correcting records.</Callout>
      )}
      {error && <Callout tone="error">{error instanceof ApiError ? error.message : 'Could not save the leave.'}</Callout>}
      {hasLeave &&
        (confirmClear ? (
          <div className="callout callout-warn" role="group" aria-label="Confirm clearing leave">
            <div style={{ flex: 1 }}>Remove this leave entirely?</div>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => setConfirmClear(false)} disabled={busy}>
              Keep
            </button>
            <button type="button" className="btn btn-sm btn-danger" onClick={clear} disabled={busy}>
              {clearLeave.isPending ? 'Clearing…' : 'Clear leave'}
            </button>
          </div>
        ) : (
          <button type="button" className="btn btn-danger-outline" onClick={() => setConfirmClear(true)} disabled={busy}>
            Clear leave
          </button>
        ))}
    </Modal>
  )
}
