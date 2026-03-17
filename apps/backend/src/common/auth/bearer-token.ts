export function parseBearerToken(rawAuthorization: string | undefined) {
  if (!rawAuthorization) {
    return null
  }

  const [scheme, token] = rawAuthorization.split(' ')
  if (!scheme || !token) {
    return null
  }

  if (scheme.toLowerCase() !== 'bearer') {
    return null
  }

  const normalized = token.trim()
  return normalized.length > 0 ? normalized : null
}
