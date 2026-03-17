export type AuthUser = {
  id: string
  email: string
  name: string
}

export type AuthenticatedRequest = {
  headers: Record<string, string | string[] | undefined>
  authUser?: AuthUser | null
  authToken?: string | null
}
