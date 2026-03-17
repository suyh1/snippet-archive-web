export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'GONE'
  | 'INTERNAL_ERROR'

export class ApiClientError extends Error {
  readonly code?: ApiErrorCode
  readonly details?: unknown
  readonly status: number

  constructor(status: number, message: string, code?: ApiErrorCode, details?: unknown) {
    super(message)
    this.name = 'ApiClientError'
    this.status = status
    this.code = code
    this.details = details
  }
}

type ApiErrorPayload = {
  error?: {
    code?: ApiErrorCode
    message?: string
    details?: unknown
  }
}

type ApiSuccessPayload<T> = {
  data: T
}

const AUTH_TOKEN_STORAGE_KEY = 'snippet-auth-token-v1'

function getBrowserStorage() {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function getAuthToken() {
  const storage = getBrowserStorage()
  if (!storage) {
    return null
  }

  const token = storage.getItem(AUTH_TOKEN_STORAGE_KEY)
  return token && token.trim().length > 0 ? token : null
}

export function setAuthToken(token: string | null) {
  const storage = getBrowserStorage()
  if (!storage) {
    return
  }

  if (!token) {
    storage.removeItem(AUTH_TOKEN_STORAGE_KEY)
    return
  }

  storage.setItem(AUTH_TOKEN_STORAGE_KEY, token)
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  const hasBody = init?.body !== undefined && init?.body !== null
  const isFormData = typeof FormData !== 'undefined' && init?.body instanceof FormData
  const authToken = getAuthToken()

  if (hasBody && !isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  if (authToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${authToken}`)
  }

  const response = await fetch(`/api${path}`, {
    ...init,
    headers,
  })

  const payload = (await response.json().catch(() => null)) as
    | ApiErrorPayload
    | ApiSuccessPayload<T>
    | null

  if (!response.ok) {
    const errorPayload = payload as ApiErrorPayload | null
    throw new ApiClientError(
      response.status,
      errorPayload?.error?.message ?? 'Request failed',
      errorPayload?.error?.code,
      errorPayload?.error?.details,
    )
  }

  return (payload as ApiSuccessPayload<T>).data
}
