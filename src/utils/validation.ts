// Client-side checks mirror the server rules so users get feedback before
// submitting. The server validates again; its messages win.

export type Errors = Record<string, string>

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^[0-9+()\-\s]{6,20}$/

export function isEmail(v: string) {
  return EMAIL_RE.test(v.trim())
}

export function isPhone(v: string) {
  return PHONE_RE.test(v.trim())
}

/** Same policy as utils/password_policy.py on the server. */
export function passwordProblem(pw: string): string | null {
  if (pw.length < 8) return 'At least 8 characters'
  if (!/[A-Z]/.test(pw)) return 'Add an uppercase letter'
  if (!/[a-z]/.test(pw)) return 'Add a lowercase letter'
  if (!/\d/.test(pw)) return 'Add a digit'
  if (!/[^\w\s]/.test(pw)) return 'Add a special character'
  return null
}

export interface UserFormValues {
  EmpID: string
  EmpName: string
  Email: string
  Phone: string
  DeptEmail: string
  DepartmentID: string
  Roles: string
  BRANCH_ID: string
  MANAGER_ID: string
  EmpPassword: string
  ConfirmPassword: string
}

export const emptyForm: UserFormValues = {
  EmpID: '',
  EmpName: '',
  Email: '',
  Phone: '',
  DeptEmail: '',
  DepartmentID: '',
  Roles: '',
  BRANCH_ID: '',
  MANAGER_ID: '',
  EmpPassword: '',
  ConfirmPassword: '',
}

export function validateUserForm(v: UserFormValues, mode: 'create' | 'edit'): Errors {
  const e: Errors = {}
  const req = (k: keyof UserFormValues, label: string) => {
    if (!v[k].trim()) e[k] = `${label} is required`
  }
  if (mode === 'create') req('EmpID', 'Employee ID')
  req('EmpName', 'Name')
  req('Email', 'Email')
  req('DepartmentID', 'Department')
  req('Roles', 'Role')

  // SW_USER text columns are nvarchar(50).
  const MAX = 50
  for (const k of ['EmpID', 'EmpName', 'Email', 'DeptEmail', 'DepartmentID', 'Roles', 'BRANCH_ID', 'MANAGER_ID'] as const) {
    if (v[k].trim().length > MAX) e[k] = `At most ${MAX} characters`
  }
  if (v.Email.trim() && !isEmail(v.Email)) e.Email = 'Enter a valid email address'
  if (v.DeptEmail.trim() && !isEmail(v.DeptEmail)) e.DeptEmail = 'Enter a valid email address'
  if (v.Phone.trim() && !isPhone(v.Phone)) e.Phone = '6-20 characters: digits, spaces, + ( ) -'
  if (mode === 'edit' && v.MANAGER_ID.trim() && v.MANAGER_ID.trim().toUpperCase() === v.EmpID.trim().toUpperCase())
    e.MANAGER_ID = 'A user cannot be their own manager'

  if (mode === 'create') {
    const pw = passwordProblem(v.EmpPassword)
    if (!v.EmpPassword) e.EmpPassword = 'Password is required'
    else if (pw) e.EmpPassword = pw
    if (v.EmpPassword && v.ConfirmPassword !== v.EmpPassword) e.ConfirmPassword = 'Passwords do not match'
  }
  return e
}

export function validateLeave(start: string, end: string): Errors {
  const e: Errors = {}
  if (!start) e.start_date = 'Choose the start date'
  if (!end) e.end_date = 'Choose the end date'
  if (start && end && end < start) e.end_date = 'The end date cannot be before the start date'
  return e
}
