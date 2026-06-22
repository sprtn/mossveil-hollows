import { describe, it, expect, beforeEach } from 'vitest'
import {
  verifyAdminLogin,
  setAdminAuthenticated,
  clearAdminSession,
  isAdminAuthenticated,
  ADMIN_SKIP_LOGIN,
} from '../../admin/adminAuth'

describe('adminAuth', () => {
  beforeEach(() => {
    clearAdminSession()
  })

  it('accepts admin credentials', () => {
    expect(verifyAdminLogin('admin', 'admin')).toBe(true)
    expect(verifyAdminLogin('admin', 'wrong')).toBe(false)
  })

  it('persists session in sessionStorage when not dev bypass', () => {
    if (ADMIN_SKIP_LOGIN) return
    expect(isAdminAuthenticated()).toBe(false)
    setAdminAuthenticated()
    expect(isAdminAuthenticated()).toBe(true)
  })
})
