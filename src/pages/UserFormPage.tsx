import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Crumbs } from '../components/ui/Breadcrumbs'
import { TextField } from '../components/ui/Field'
import { Bone, Callout, EmptyState, ErrorState } from '../components/ui/States'
import { AccountCard, LeaveCard } from '../components/users/UserCards'
import { useAllUsers, useCreateUser, useUpdateUser, useUser } from '../hooks/useUsers'
import { ApiError } from '../services/api'
import type { User, UserUpdateBody } from '../types/api'
import { empIdFromPath, userPath } from '../utils/routes'
import { emptyForm, passwordProblem, validateUserForm, type Errors, type UserFormValues } from '../utils/validation'

const ORDER: (keyof UserFormValues)[] = [
  'EmpID', 'EmpName', 'Email', 'Phone', 'DeptEmail', 'DepartmentID', 'Roles', 'BRANCH_ID', 'MANAGER_ID',
  'EmpPassword', 'ConfirmPassword',
]

function fromUser(u: User): UserFormValues {
  return {
    ...emptyForm,
    EmpID: u.emp_id,
    EmpName: u.emp_name ?? '',
    Email: u.email ?? '',
    Phone: u.phone ?? '',
    DeptEmail: u.dept_email ?? '',
    DepartmentID: u.department_id ?? '',
    Roles: u.role ?? '',
    BRANCH_ID: u.branch_id ?? '',
    MANAGER_ID: u.manager_id ?? '',
  }
}

/** Only the fields that changed, blanks as null (optional fields) per the PATCH contract. */
function diff(before: UserFormValues, after: UserFormValues): UserUpdateBody {
  const body: Record<string, string | null> = {}
  const keys = ['EmpName', 'Email', 'DepartmentID', 'Roles', 'BRANCH_ID', 'Phone', 'MANAGER_ID', 'DeptEmail'] as const
  for (const k of keys) {
    const a = before[k].trim()
    const b = after[k].trim()
    if (a !== b) body[k] = b === '' ? null : b
  }
  return body as UserUpdateBody
}

function focusFirstError(errors: Errors) {
  const first = ORDER.find((k) => errors[k])
  if (!first) return
  const el = document.querySelector<HTMLElement>(`[data-field="${first}"]`)
  el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  el?.focus({ preventScroll: true })
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="card card-section" aria-label={title}>
      <div className="card-header">
        <h2 className="card-title">{title}</h2>
        {hint && <span className="card-hint">{hint}</span>}
      </div>
      <hr className="divider" />
      <div className="form-grid">{children}</div>
    </section>
  )
}

function Suggestions({ id, values }: { id: string; values: string[] }) {
  return (
    <datalist id={id}>
      {values.map((v) => (
        <option key={v} value={v} />
      ))}
    </datalist>
  )
}

function FormSkeleton() {
  return (
    <div className="record skeleton-region" aria-busy="true">
      <span className="sr-only" role="status">Loading user</span>
      <div className="record-main">
        {[4, 4].map((n, i) => (
          <div key={i} className="card card-section">
            <Bone w={140} h={16} />
            <div className="form-grid">
              {Array.from({ length: n }, (_, j) => (
                <div key={j} className="field">
                  <Bone w={90} h={12} />
                  <Bone w="100%" h={40} radius={8} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="record-side">
        <div className="card card-section">
          <Bone w={120} h={16} />
          <Bone w="100%" h={80} />
        </div>
      </div>
    </div>
  )
}

/** Add or edit a user. Administrators only: the route guards it and the API enforces it. */
export function UserFormPage({ mode }: { mode: 'create' | 'edit' }) {
  const empId = empIdFromPath(useParams()['*'])
  const navigate = useNavigate()

  const userQuery = useUser(mode === 'edit' ? empId : undefined)
  const all = useAllUsers()
  const create = useCreateUser()
  const update = useUpdateUser(empId ?? '')

  const [values, setValues] = useState<UserFormValues>(emptyForm)
  const [initial, setInitial] = useState<UserFormValues>(emptyForm)
  const [errors, setErrors] = useState<Errors>({})
  const [formError, setFormError] = useState<string | null>(null)

  const user = userQuery.data
  useEffect(() => {
    if (user) {
      const v = fromUser(user)
      setValues(v)
      setInitial(v)
    }
    // Reset only when a different user loads, not on every cache refresh.
  }, [user?.emp_id])

  const suggestions = useMemo(() => {
    const users = all.data ?? []
    const uniq = (xs: (string | null)[]) =>
      Array.from(new Set(xs.filter((x) => x !== null && x !== '').map(String))).sort()
    return {
      roles: uniq(users.map((u) => u.role?.toUpperCase() ?? null)),
      branches: uniq(users.map((u) => u.branch_id)),
      depts: uniq(users.map((u) => u.department_id)),
      managers: users.filter((u) => !u.is_disabled && u.emp_id !== empId).map((u) => u.emp_id),
      managerNames: new Map(users.map((u) => [u.emp_id.toUpperCase(), u.emp_name])),
    }
  }, [all.data, empId])

  const changes = mode === 'edit' ? diff(initial, values) : {}
  const changeCount = Object.keys(changes).length
  const dirty = mode === 'create' ? ORDER.some((k) => values[k] !== '') : changeCount > 0
  const busy = create.isPending || update.isPending

  const set = (k: keyof UserFormValues) => (e: { target: { value: string } }) => {
    setValues((v) => ({ ...v, [k]: e.target.value }))
    if (errors[k]) setErrors(({ [k]: _drop, ...rest }) => rest)
  }

  const applyServerError = (err: unknown) => {
    if (!(err instanceof ApiError)) {
      setFormError('Something went wrong. Try again.')
      return
    }
    const fieldErrors: Errors = { ...err.fieldErrors }
    // Map known server messages onto the field they concern.
    if (err.status === 409 && /name/i.test(err.message) && !/Employee ID/.test(err.message)) fieldErrors.EmpName = 'This name is already used by another user'
    if (err.status === 409 && /Employee ID/.test(err.message)) fieldErrors.EmpID = 'This employee ID already exists'
    if (err.status === 400 && /^Password/.test(err.message)) fieldErrors.EmpPassword = err.message
    if (err.status === 400 && /Manager/i.test(err.message)) fieldErrors.MANAGER_ID = err.message
    const m = err.message.match(/^(\w+) cannot be empty$/)
    if (m) fieldErrors[m[1]] = 'This field is required'
    setErrors(fieldErrors)
    setFormError(Object.keys(fieldErrors).length ? 'Please fix the highlighted fields.' : err.message)
    focusFirstError(fieldErrors)
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setFormError(null)
    const errs = validateUserForm(values, mode)
    setErrors(errs)
    if (Object.keys(errs).length) {
      setFormError('Please fix the highlighted fields.')
      focusFirstError(errs)
      return
    }
    if (mode === 'create') {
      const t = (s: string) => s.trim() || null
      create.mutate(
        {
          EmpID: values.EmpID.trim(),
          EmpName: values.EmpName.trim(),
          EmpPassword: values.EmpPassword,
          Email: values.Email.trim(),
          DepartmentID: values.DepartmentID.trim(),
          Roles: values.Roles.trim(),
          BRANCH_ID: t(values.BRANCH_ID),
          Phone: t(values.Phone),
          DeptEmail: t(values.DeptEmail),
        },
        {
          onSuccess: () => navigate(userPath(values.EmpID.trim()), { state: { flash: `${values.EmpName.trim()} was added.` } }),
          onError: applyServerError,
        },
      )
    } else {
      if (!dirty || !user) return
      update.mutate(changes, {
        onSuccess: (u) =>
          navigate(userPath(u.emp_id), {
            replace: true,
            state: { flash: `Saved ${changeCount} change${changeCount === 1 ? '' : 's'} to ${u.emp_name || u.emp_id}.` },
          }),
        onError: applyServerError,
      })
    }
  }

  if (mode === 'edit' && userQuery.isPending) {
    return (
      <div className="page-inner">
        <Crumbs label="…" />
        <FormSkeleton />
      </div>
    )
  }
  if (mode === 'edit' && (userQuery.isError || !user)) {
    const notFound = (userQuery.error as ApiError | null)?.status === 404
    return (
      <div className="page-inner">
        <Crumbs label={empId ?? ''} />
        <div className="card">
          {notFound ? (
            <EmptyState icon="search" title={`No employee with ID ${empId}`}
              text="The ID may be mistyped, or the account was never created in Switrus."
              actions={<Link className="btn btn-secondary" to="/users">Back to users</Link>} />
          ) : (
            <ErrorState message={(userQuery.error as Error)?.message || 'Could not load this employee.'}
              onRetry={() => void userQuery.refetch()} />
          )}
        </div>
      </div>
    )
  }

  const managerName = values.MANAGER_ID ? suggestions.managerNames.get(values.MANAGER_ID.trim().toUpperCase()) : null
  const pwProblem = values.EmpPassword ? passwordProblem(values.EmpPassword) : null
  const name = user?.emp_name || user?.emp_id || ''
  const cancelTo = mode === 'edit' && user ? userPath(user.emp_id) : '/users'

  return (
    <form className="page-inner" onSubmit={submit} noValidate>
      {mode === 'edit' && user ? (
        <Crumbs parent={{ to: userPath(user.emp_id), label: name }} label="Edit details" />
      ) : (
        <Crumbs label="Add user" />
      )}

      <div className="page-header">
        <div className="titles">
          <h1 className="page-title">{mode === 'create' ? 'Add user' : `Edit ${name}`}</h1>
          <div className="page-subtitle">
            {mode === 'create'
              ? 'Creates a Switrus account. It can sign in as soon as it is saved.'
              : `Employee ID ${user?.emp_id}. Only the fields you change are saved.`}
          </div>
        </div>
      </div>

      {formError && <Callout tone="error">{formError}</Callout>}

      <div className="record">
        <fieldset className="record-main" disabled={busy}>
          <Section title="Identity" hint="* required">
            <TextField label="Employee ID" name="EmpID" required value={values.EmpID} error={errors.EmpID}
              onChange={set('EmpID')} readOnly={mode === 'edit'} autoComplete="off"
              help={mode === 'edit' ? 'The employee ID never changes.' : 'Must match the HR employee code. Cannot be changed later.'} />
            <TextField label="Employee name" name="EmpName" required value={values.EmpName} error={errors.EmpName}
              onChange={set('EmpName')} autoComplete="off" help="Also the sign-in user name. Must be unique." />
          </Section>

          <Section title="Contact">
            <TextField label="Email" name="Email" type="email" required value={values.Email} error={errors.Email}
              onChange={set('Email')} autoComplete="off" help="Used for password reset codes." />
            <TextField label="Phone" name="Phone" type="tel" value={values.Phone} error={errors.Phone}
              onChange={set('Phone')} autoComplete="off" />
            <TextField label="Department email" name="DeptEmail" type="email" value={values.DeptEmail}
              error={errors.DeptEmail} onChange={set('DeptEmail')} autoComplete="off" fieldClassName="span-2" />
          </Section>

          <Section title="Organisation">
            <TextField label="Department" name="DepartmentID" required value={values.DepartmentID}
              error={errors.DepartmentID} onChange={set('DepartmentID')} list="dl-depts" autoComplete="off"
              help="As stored in Switrus, e.g. SALES, VISA, Operations, FIT, BPO." />
            <TextField label="Role" name="Roles" required value={values.Roles} error={errors.Roles}
              onChange={set('Roles')} list="dl-roles" autoComplete="off" help="Controls what the user can do in Switrus apps." />
            <TextField label="Branch" name="BRANCH_ID" value={values.BRANCH_ID} error={errors.BRANCH_ID}
              onChange={set('BRANCH_ID')} list="dl-branches" autoComplete="off" />
            {mode === 'edit' && (
              <TextField label="Manager (employee ID)" name="MANAGER_ID" value={values.MANAGER_ID}
                error={errors.MANAGER_ID} onChange={set('MANAGER_ID')} list="dl-managers" autoComplete="off"
                help={managerName ? `Manager: ${managerName}` : 'Leave empty if none.'} />
            )}
            <Suggestions id="dl-depts" values={suggestions.depts} />
            <Suggestions id="dl-roles" values={suggestions.roles} />
            <Suggestions id="dl-branches" values={suggestions.branches} />
            <Suggestions id="dl-managers" values={suggestions.managers} />
          </Section>

          {mode === 'create' && (
            <Section title="Sign-in">
              <TextField label="Password" name="EmpPassword" type="password" required value={values.EmpPassword}
                error={errors.EmpPassword} onChange={set('EmpPassword')} autoComplete="new-password"
                help={pwProblem ?? (values.EmpPassword ? 'Strong enough' : '8+ characters with upper and lower case, a digit and a symbol.')} />
              <TextField label="Confirm password" name="ConfirmPassword" type="password" required
                value={values.ConfirmPassword} error={errors.ConfirmPassword} onChange={set('ConfirmPassword')}
                autoComplete="new-password" />
            </Section>
          )}
        </fieldset>

        <aside className="record-side">
          {mode === 'edit' && user ? (
            <>
              <AccountCard user={user} />
              <LeaveCard user={user} />
              <p className="side-note">Account status and leave are changed from the employee page, with a confirmation.</p>
            </>
          ) : (
            <section className="card card-section" aria-label="Before you save">
              <h2 className="card-title">Before you save</h2>
              <hr className="divider" />
              <ul className="checklist">
                <li>The employee ID cannot be changed after saving.</li>
                <li>The employee name is also the sign-in user name, so it must be unique.</li>
                <li>Use the department exactly as Switrus stores it, for example SALES or VISA.</li>
              </ul>
            </section>
          )}
        </aside>
      </div>

      <div className="action-bar">
        <div className="info" role="status">
          {mode === 'create'
            ? 'Fields marked * are required.'
            : dirty
              ? `${changeCount} unsaved change${changeCount === 1 ? '' : 's'}`
              : 'No unsaved changes'}
        </div>
        <div className="buttons">
          <Link to={cancelTo} className="btn btn-secondary btn-bar">Cancel</Link>
          <button type="submit" className="btn btn-primary btn-bar" disabled={busy}
            aria-disabled={mode === 'edit' && !dirty ? true : undefined}>
            {busy ? (
              <>
                <span className="spinner spinner-btn" aria-hidden="true" /> Saving…
              </>
            ) : mode === 'create' ? 'Create user' : 'Save changes'}
          </button>
        </div>
      </div>
    </form>
  )
}
