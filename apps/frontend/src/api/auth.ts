import { apiRequest, setAuthToken } from './http'

export type AuthUser = {
  id: string
  email: string
  name: string
}

export type AuthSession = {
  accessToken: string
  expiresAt?: string
  user: AuthUser
}

export const authApi = {
  async register(payload: { email: string; name: string; password: string }) {
    const session = await apiRequest<AuthSession>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    setAuthToken(session.accessToken)
    return session
  },
  async login(payload: { email: string; password: string }) {
    const session = await apiRequest<AuthSession>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    setAuthToken(session.accessToken)
    return session
  },
  me() {
    return apiRequest<AuthUser>('/auth/me')
  },
  async logout() {
    await apiRequest<{ success: boolean }>('/auth/logout', {
      method: 'POST',
    })
    setAuthToken(null)
  },
}
