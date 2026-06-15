// lib/supabase/__tests__/middleware-client.test.ts
import { describe, it, expect } from 'vitest'
import { getRedirectForRole } from '../middleware-client'

describe('getRedirectForRole', () => {
  it('redirects employee away from /admin', () => {
    expect(getRedirectForRole('employee', '/admin/projects')).toBe('/timesheet/daily')
  })

  it('redirects employee away from /manager', () => {
    expect(getRedirectForRole('employee', '/manager/approvals')).toBe('/timesheet/daily')
  })

  it('allows manager on /manager routes', () => {
    expect(getRedirectForRole('manager', '/manager/approvals')).toBeNull()
  })

  it('redirects manager away from /admin', () => {
    expect(getRedirectForRole('manager', '/admin/users')).toBe('/timesheet/daily')
  })

  it('allows admin on /admin routes', () => {
    expect(getRedirectForRole('admin', '/admin/projects')).toBeNull()
  })

  it('allows admin on /manager routes', () => {
    expect(getRedirectForRole('admin', '/manager/approvals')).toBeNull()
  })

  it('returns null for non-guarded routes', () => {
    expect(getRedirectForRole('employee', '/timesheet/daily')).toBeNull()
  })
})
