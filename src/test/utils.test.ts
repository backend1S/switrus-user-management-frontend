import { formatDate, leaveState, todayIST } from '../utils/format'
import { emptyForm, passwordProblem, validateLeave, validateUserForm } from '../utils/validation'

describe('dates', () => {
  it('formats ISO as DD/MM/YYYY and missing as a dash', () => {
    expect(formatDate('2026-11-03')).toBe('03/11/2026')
    expect(formatDate(null)).toBe('—')
    expect(formatDate('2026-02-30')).toBe('—')
  })

  it('computes today in IST, not the browser zone', () => {
    // 20:00 UTC on 31 Oct is already 1 Nov in India.
    expect(todayIST(new Date(Date.UTC(2026, 9, 31, 20, 0)))).toBe('2026-11-01')
    expect(todayIST(new Date(Date.UTC(2026, 9, 31, 10, 0)))).toBe('2026-10-31')
  })

  it('classifies leave windows inclusively', () => {
    expect(leaveState('2026-11-03', '2026-11-07', '2026-11-03')).toBe('on_leave')
    expect(leaveState('2026-11-03', '2026-11-07', '2026-11-07')).toBe('on_leave')
    expect(leaveState('2026-11-03', '2026-11-07', '2026-11-02')).toBe('upcoming')
    expect(leaveState('2026-11-03', '2026-11-07', '2026-11-08')).toBe('past')
    expect(leaveState(null, null)).toBe('none')
  })
})

describe('validation', () => {
  it('mirrors the server password policy', () => {
    expect(passwordProblem('short')).toMatch(/8/)
    expect(passwordProblem('alllowercase1!')).toMatch(/uppercase/)
    expect(passwordProblem('NoDigits!!')).toMatch(/digit/)
    expect(passwordProblem('NoSymbol11')).toMatch(/special/)
    expect(passwordProblem('Str0ng!Pass')).toBeNull()
  })

  it('requires the create fields and checks formats', () => {
    const e = validateUserForm({ ...emptyForm, Email: 'nope', Phone: 'abc' }, 'create')
    expect(Object.keys(e).sort()).toEqual(['DepartmentID', 'Email', 'EmpID', 'EmpName', 'EmpPassword', 'Phone', 'Roles'].sort())
  })

  it('does not require a password when editing', () => {
    const v = { ...emptyForm, EmpID: 'E1', EmpName: 'A', Email: 'a@b.co', DepartmentID: '5', Roles: 'ADMIN' }
    expect(validateUserForm(v, 'edit')).toEqual({})
    expect(validateUserForm({ ...v, MANAGER_ID: 'e1' }, 'edit').MANAGER_ID).toBeDefined()
  })

  it('rejects reversed leave ranges', () => {
    expect(validateLeave('2026-11-07', '2026-11-03').end_date).toBeDefined()
    expect(validateLeave('2026-11-03', '2026-11-03')).toEqual({})
  })
})
