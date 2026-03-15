export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'CONFLICT'
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

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
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
