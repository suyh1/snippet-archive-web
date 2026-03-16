<script setup lang="ts">
import { RouterLink, RouterView, useRoute } from 'vue-router'

const route = useRoute()

function isActive(path: string) {
  return route.path === path
}
</script>

<template>
  <div class="route-shell" data-testid="route-shell">
    <header class="route-shell-header">
      <h1>Snippet Archive</h1>
      <nav class="route-shell-nav" aria-label="主导航">
        <RouterLink
          data-testid="nav-workspace"
          class="route-shell-link"
          :class="{ active: isActive('/workspace') }"
          to="/workspace"
        >
          工作区
        </RouterLink>
        <RouterLink
          data-testid="nav-search"
          class="route-shell-link"
          :class="{ active: isActive('/search') }"
          to="/search"
        >
          搜索
        </RouterLink>
        <RouterLink
          data-testid="nav-settings"
          class="route-shell-link"
          :class="{ active: isActive('/settings') }"
          to="/settings"
        >
          设置
        </RouterLink>
      </nav>
    </header>

    <section class="route-shell-content">
      <RouterView />
    </section>
  </div>
</template>

<style scoped>
.route-shell {
  position: relative;
  min-height: 100vh;
  background: radial-gradient(circle at top right, rgba(14, 165, 233, 0.12), transparent 45%),
    var(--theme-layout-app-shell-background);
}

.route-shell-header {
  position: fixed;
  bottom: 10px;
  right: 14px;
  z-index: 20;
  display: inline-flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border: 1px solid var(--theme-surface-statusbar-border);
  border-radius: 999px;
  background: var(--theme-surface-glass-header-background);
  backdrop-filter: var(--theme-surface-overlay-blur);
  pointer-events: none;
}

.route-shell-header h1 {
  font-size: 12px;
  margin: 0;
  color: var(--theme-text-secondary);
}

.route-shell-nav {
  display: flex;
  gap: 8px;
}

.route-shell-link {
  pointer-events: auto;
  text-decoration: none;
  border: 1px solid var(--theme-surface-neutral-button-border);
  border-radius: 999px;
  padding: 6px 12px;
  color: var(--theme-text-secondary);
  background: var(--theme-surface-neutral-button-background);
}

.route-shell-link.active {
  color: var(--theme-accent-selected-text);
  border-color: var(--theme-accent-selected-border);
  background: var(--theme-surface-row-active-background);
}

.route-shell-content {
  height: 100vh;
  overflow: hidden;
}
</style>
