const SESSION_KEY = 'strat_admin_session'

export const ADMIN_USERNAME = 'admin'
export const ADMIN_PASSWORD = 'admin'

/** Dev builds skip the login gate. */
export const ADMIN_SKIP_LOGIN = import.meta.env.DEV

export function isAdminAuthenticated(): boolean {
  if (ADMIN_SKIP_LOGIN) return true
  try {
    return sessionStorage.getItem(SESSION_KEY) === '1'
  } catch {
    return false
  }
}

export function verifyAdminLogin(username: string, password: string): boolean {
  return username === ADMIN_USERNAME && password === ADMIN_PASSWORD
}

export function setAdminAuthenticated(): void {
  try {
    sessionStorage.setItem(SESSION_KEY, '1')
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearAdminSession(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY)
  } catch {
    /* ignore */
  }
}

export function canAccessAdmin(): boolean {
  return isAdminAuthenticated()
}
