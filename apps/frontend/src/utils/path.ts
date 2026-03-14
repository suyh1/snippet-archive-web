export function normalizePath(path: string) {
  const trimmed = path.trim()
  if (!trimmed.startsWith('/')) {
    return normalizePath(`/${trimmed}`)
  }

  const segments = trimmed.split('/').filter(Boolean)
  if (segments.length === 0) {
    return '/'
  }

  return `/${segments.join('/')}`
}

export function joinPath(parentPath: string, childName: string) {
  const safeParent = normalizePath(parentPath)
  const safeChild = childName.trim().replaceAll('/', '')

  if (!safeChild) {
    return safeParent
  }

  if (safeParent === '/') {
    return `/${safeChild}`
  }

  return `${safeParent}/${safeChild}`
}

export function getParentPath(path: string) {
  const safePath = normalizePath(path)
  if (safePath === '/') {
    return '/'
  }

  const index = safePath.lastIndexOf('/')
  if (index <= 0) {
    return '/'
  }

  return safePath.slice(0, index)
}

export function basename(path: string) {
  const safePath = normalizePath(path)
  const segments = safePath.split('/').filter(Boolean)
  return segments[segments.length - 1] ?? ''
}
