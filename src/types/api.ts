// Response and request shapes of the Switrus User Management API.
// Responses are snake_case; edit/create bodies use the database-style names
// that POST /users established (see docs/API.md).

export interface User {
  emp_id: string
  emp_name: string | null
  department_id: string | null // SW_USER.DepartmentID is text: SALES, VISA, Operations…
  role: string | null
  branch_id: string | null
  email: string | null
  phone: string | null
  manager_id: string | null
  dept_email: string | null
  is_disabled: boolean
  leave_start: string | null // YYYY-MM-DD
  leave_end: string | null
  is_suspended: 0 | 1
}

/** POST /auth/login and GET /auth/me. The CSRF token must go back on every write. */
export type AccessScope = 'all' | 'branch' | 'branch_department'

export interface Session {
  user: { emp_id: string; emp_name: string | null; role: string | null; branch_id: string | null; department_id: string | null }
  permissions: {
    is_admin: boolean
    can_edit: boolean
    /** Which users the API returns to this person (enforced server-side). */
    scope: AccessScope
    scope_branch_id: string | null
    scope_department_id: string | null
  }
  csrf_token: string
}

export interface UserStats {
  total: number
  active: number
  disabled: number
  on_leave: number
}

export interface UserFilters {
  include_disabled?: boolean
  search?: string
  branch_id?: string
  department_id?: string
  role?: string
}

export interface UserCreateBody {
  EmpID: string
  EmpName: string
  EmpPassword: string
  Email: string
  DepartmentID: string
  Roles: string
  BRANCH_ID?: string | null
  Phone?: string | null
  DeptEmail?: string | null
}

export interface UserUpdateBody {
  EmpName?: string
  Email?: string
  DepartmentID?: string
  Roles?: string
  BRANCH_ID?: string | null
  Phone?: string | null
  MANAGER_ID?: string | null
  DeptEmail?: string | null
}

export interface LeaveBody {
  start_date: string
  end_date: string
}

export type SyncStatus = 'queued' | 'running' | 'succeeded' | 'partial' | 'failed' | 'skipped'

export interface SyncRun {
  run_id: string
  trigger_type: string
  requested_by: string | null
  status: SyncStatus
  requested_at: string | null
  started_at: string | null
  finished_at: string | null
  records_received: number
  records_processed: number
  created: number
  updated: number
  unchanged: number
  skipped: number
  conflicts: number
  failed: number
  error_message: string | null
}

export interface SyncItem {
  emp_id: string | null
  outcome: 'created' | 'updated' | 'conflict' | 'new' | 'skipped' | 'failed' | 'unchanged'
  fields: string[]
  message: string | null
}

export interface SyncRunDetail extends SyncRun {
  items: SyncItem[]
}

export interface LoyaltriStatus {
  configured: boolean
  problems: string[]
  tables_ready: boolean
  config: {
    client_mode: 'disabled' | 'mock' | 'http' | string
    base_url: string | null
    credentials_set: boolean
    scheduled_sync_enabled: boolean
    interval_minutes: number
    scheduler_mode: string
    pagination: string
    timeout_seconds: number
    max_retries: number
    field_policy: {
      match_on: string
      owned_fields: string[]
      fill_empty_fields: string[]
      overwrite_local_changes: boolean
      create_mode: string
      never_synced: string[]
    }
  }
  worker: { alive: boolean; last_heartbeat: string | null }
  last_success: SyncRun | null
  last_attempt: SyncRun | null
  active_run: SyncRun | null
  next_scheduled_at: string | null
}

// ------------------------------------------------------------------ attendance (read-only)

/** How a returned status is grouped for counts; the label itself is shown as the API sent it. */
export type AttendanceCategory = 'present' | 'absent' | 'off_day' | 'half_day' | 'leave' | 'other'

export interface AttendanceAccess {
  allowed: boolean
  reason: string | null
  configured: boolean
  mapping_verified: boolean
  max_range_days: number
  problems?: string[] // administrators only
}

export interface AttendanceDay {
  status: string
  category: AttendanceCategory
  in_time: string | null
  out_time: string | null
  work_minutes: number | null
  overtime_minutes: number | null
}

export interface AttendanceSummary {
  present: number
  absent: number
  off_day: number
  half_day: number
  leave: number
  other: number
  days_recorded: number
  work_minutes: number
  overtime_minutes: number
}

export interface AttendanceEmployee {
  emp_id: string | null
  emp_name: string | null
  branch_id: string | null
  department_id: string | null
  is_disabled: boolean
  /** false only for records that match no Switrus user (administrators with ATTENDANCE_ADMIN_SCOPE=all). */
  matched: boolean
  days: Record<string, AttendanceDay> // keyed YYYY-MM-DD
  summary: AttendanceSummary
  /** Numeric counts as reported by the attendance system (payroll fields removed server-side). */
  source_summary: Record<string, number>
}

export interface AttendanceMuster {
  from_date: string
  to_date: string
  dates: string[]
  access: { scope: AccessScope; branch_id: string | null; department_id: string | null }
  mapping_verified: boolean
  employees: AttendanceEmployee[]
  totals: AttendanceSummary & { employees: number }
  states: { label: string; category: AttendanceCategory; count: number }[]
  warnings: string[]
  generated_at: string
  mapping?: {
    upstream_records: number
    matched: number
    unmatched: number
    missing_code: number
    duplicate_code_records: number
    show_unmatched: boolean
  }
}
