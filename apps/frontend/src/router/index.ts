import { createRouter, createWebHistory } from 'vue-router'
import FavoritesPage from '@/pages/FavoritesPage.vue'
import SearchPage from '@/pages/SearchPage.vue'
import SettingsPage from '@/pages/SettingsPage.vue'
import WorkspacePage from '@/pages/WorkspacePage.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: '/workspace',
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
      path: '/settings',
      component: SettingsPage,
    },
  ],
})
