import { createRouter, createWebHistory } from 'vue-router'
import { authApi } from '@/api/auth'
import { getAuthToken, setAuthToken } from '@/api/http'
import FavoritesPage from '@/pages/FavoritesPage.vue'
import LoginPage from '@/pages/LoginPage.vue'
import SearchPage from '@/pages/SearchPage.vue'
import SettingsPage from '@/pages/SettingsPage.vue'
import TeamPage from '@/pages/TeamPage.vue'
import WorkspacePage from '@/pages/WorkspacePage.vue'

let authValidationToken: string | null = null
let authValidationResult = false
let authValidationPromise: Promise<boolean> | null = null

function resetAuthValidation() {
  authValidationToken = null
  authValidationResult = false
  authValidationPromise = null
}

function sanitizeRedirectTarget(value: unknown) {
  if (typeof value !== 'string' || !value.startsWith('/')) {
    return '/workspace'
  }

  return value === '/login' ? '/workspace' : value
}

async function ensureAuthenticated() {
  const token = getAuthToken()
  if (!token) {
    resetAuthValidation()
    return false
  }

  if (authValidationToken === token && authValidationResult) {
    return true
  }

  if (authValidationToken === token && authValidationPromise) {
    return authValidationPromise
  }

  authValidationToken = token
  authValidationPromise = authApi
    .me()
    .then(() => {
      authValidationResult = true
      return true
    })
    .catch(() => {
      setAuthToken(null)
      resetAuthValidation()
      return false
    })
    .finally(() => {
      authValidationPromise = null
    })

  return authValidationPromise
}

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: '/login',
    },
    {
      path: '/login',
      component: LoginPage,
    },
    {
      path: '/workspace',
      component: WorkspacePage,
    },
    {
      path: '/search',
      component: SearchPage,
    },
    {
      path: '/favorites',
      component: FavoritesPage,
    },
    {
      path: '/team',
      component: TeamPage,
    },
    {
      path: '/settings',
      component: SettingsPage,
    },
  ],
})

router.beforeEach(async (to) => {
  if (to.path === '/login') {
    const authenticated = await ensureAuthenticated()
    if (!authenticated) {
      return true
    }

    return sanitizeRedirectTarget(to.query.redirect)
  }

  const authenticated = await ensureAuthenticated()
  if (authenticated) {
    return true
  }

  return {
    path: '/login',
    query: {
      redirect: to.fullPath,
    },
  }
})
