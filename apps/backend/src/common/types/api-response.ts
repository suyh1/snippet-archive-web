export type ApiSuccessResponse<T> = {
  data: T
}

export type ApiErrorResponse = {
  error: {
    code: 'VALIDATION_ERROR' | 'NOT_FOUND' | 'CONFLICT' | 'INTERNAL_ERROR'
    message: string
    details?: unknown
  }
}
