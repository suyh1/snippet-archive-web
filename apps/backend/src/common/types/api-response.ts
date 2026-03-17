export type ApiSuccessResponse<T> = {
  data: T
}

export type ApiErrorResponse = {
  error: {
    code:
      | 'VALIDATION_ERROR'
      | 'UNAUTHORIZED'
      | 'FORBIDDEN'
      | 'NOT_FOUND'
      | 'CONFLICT'
      | 'GONE'
      | 'INTERNAL_ERROR'
    message: string
    details?: unknown
  }
}
