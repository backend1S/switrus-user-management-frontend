import type {
  AttendanceAccess,
  AttendanceMuster,
  LeaveBody,
  Session,
  LoyaltriStatus,
  SyncRun,
  SyncRunDetail,
  User,
  UserCreateBody,
  UserFilters,
  UserStats,
  UserUpdateBody,
} from '../types/api'
import { request } from './api'

const enc = encodeURIComponent

export const authApi = {
  login: (username: string, password: string) =>
    request<Session>('POST', '/auth/login', { body: { username, password } }),
  me: () => request<Session>('GET', '/auth/me'),
  logout: () => request<{ message: string }>('POST', '/auth/logout'),
}

export const usersApi = {
  list: (filters: UserFilters, signal?: AbortSignal) =>
    request<User[]>('GET', '/users', { query: { ...filters }, signal }),
  stats: () => request<UserStats>('GET', '/users/stats'),
  get: (empId: string) => request<User>('GET', `/users/${enc(empId)}`),
  create: (body: UserCreateBody) => request<{ message: string }>('POST', '/users', { body }),
  update: (empId: string, body: UserUpdateBody) => request<User>('PATCH', `/users/${enc(empId)}`, { body }),
  setStatus: (empId: string, isDisabled: boolean) =>
    request<User>('PATCH', `/users/${enc(empId)}/status`, { body: { is_disabled: isDisabled } }),
  setLeave: (empId: string, body: LeaveBody) => request<User>('PUT', `/users/${enc(empId)}/leave`, { body }),
  clearLeave: (empId: string) => request<User>('DELETE', `/users/${enc(empId)}/leave`),
}

export const loyaltriApi = {
  status: () => request<LoyaltriStatus>('GET', '/integrations/loyaltri/status'),
  runs: (limit = 20) => request<SyncRun[]>('GET', '/integrations/loyaltri/runs', { query: { limit } }),
  run: (runId: string) => request<SyncRunDetail>('GET', `/integrations/loyaltri/runs/${enc(runId)}`),
  trigger: () => request<{ run: SyncRun; already_active: boolean }>('POST', '/integrations/loyaltri/sync'),
}

export const attendanceApi = {
  access: () => request<AttendanceAccess>('GET', '/attendance/access'),
  muster: (fromDate: string, toDate: string, signal?: AbortSignal) =>
    request<AttendanceMuster>('GET', '/attendance/muster', { query: { from_date: fromDate, to_date: toDate }, signal }),
}
