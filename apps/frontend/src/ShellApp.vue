<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { authApi } from '@/api/auth'
import { setAuthToken } from '@/api/http'
import { workspaceApi } from '@/api/workspaces'
import type { Workspace } from '@/types/workspace'
import {
  applyLanguageToFileName,
  MANUAL_LANGUAGE_OPTIONS,
  normalizeLanguage,
} from '@/utils/language-detect'

const route = useRoute()
const router = useRouter()

const toolbarOpen = ref(false)
const mainNavRef = ref<HTMLElement | null>(null)
const floatingToolbarRef = ref<HTMLElement | null>(null)
const topActionsRef = ref<HTMLElement | null>(null)
const contentTopInset = ref(0)
const loggingOut = ref(false)
const quickCaptureOpen = ref(false)
const quickCaptureLoading = ref(false)
const quickCaptureSubmitting = ref(false)
const quickCaptureError = ref('')
const quickCaptureWorkspaces = ref<Workspace[]>([])
const quickCaptureWorkspaceId = ref('')
const quickCaptureName = ref('')
const quickCaptureLanguage = ref('plaintext')
const quickCaptureTags = ref('')
const quickCaptureContent = ref('')

const quickCaptureSubmitDisabled = computed(() => {
  return (
    quickCaptureLoading.value ||
    quickCaptureSubmitting.value ||
    quickCaptureWorkspaceId.value.length === 0 ||
    quickCaptureName.value.trim().length === 0
  )
})

function isActive(path: string) {
  return route.path === path
}

const isLoginRoute = computed(() => route.path === '/login')
const isSettingsRoute = computed(() => route.path === '/settings')

function buildQuickCaptureNameSeed() {
  return `quick-capture-${Date.now().toString(36).slice(-5)}`
}

function resetQuickCaptureForm() {
  quickCaptureError.value = ''
  quickCaptureName.value = buildQuickCaptureNameSeed()
  quickCaptureLanguage.value = 'plaintext'
  quickCaptureTags.value = ''
  quickCaptureContent.value = ''
}

function normalizeTagsInput(rawTags: string) {
  const seen = new Set<string>()
  const tags: string[] = []

  for (const raw of rawTags.split(',')) {
    const tag = raw.trim()
    if (!tag || seen.has(tag)) {
      continue
    }

    seen.add(tag)
    tags.push(tag)
  }

  return tags.slice(0, 50)
}

function routeWorkspaceId() {
  const raw = route.query.workspaceId
  if (typeof raw === 'string') {
    return raw
  }

  if (Array.isArray(raw) && raw.length > 0 && typeof raw[0] === 'string') {
    return raw[0]
  }

  return ''
}

async function loadQuickCaptureWorkspaces() {
  quickCaptureLoading.value = true
  quickCaptureError.value = ''

  try {
    const items = await workspaceApi.list()
    quickCaptureWorkspaces.value = items

    const preferredWorkspaceId = routeWorkspaceId()
    if (preferredWorkspaceId && items.some((item) => item.id === preferredWorkspaceId)) {
      quickCaptureWorkspaceId.value = preferredWorkspaceId
      return
    }

    if (items.some((item) => item.id === quickCaptureWorkspaceId.value)) {
      return
    }

    quickCaptureWorkspaceId.value = items[0]?.id ?? ''
  } catch (error) {
    quickCaptureError.value =
      error instanceof Error ? error.message : '加载工作区失败，请稍后重试。'
  } finally {
    quickCaptureLoading.value = false
  }
}

async function openQuickCaptureDialog() {
  if (isLoginRoute.value) {
    return
  }

  toolbarOpen.value = false
  quickCaptureOpen.value = true
  resetQuickCaptureForm()
  await loadQuickCaptureWorkspaces()
}

function closeQuickCaptureDialog() {
  if (quickCaptureSubmitting.value) {
    return
  }

  quickCaptureOpen.value = false
}

function toggleFloatingToolbar() {
  if (isLoginRoute.value) {
    return
  }

  toolbarOpen.value = !toolbarOpen.value
}

function handleToolbarOutsidePointerDown(event: MouseEvent) {
  if (isLoginRoute.value) {
    toolbarOpen.value = false
    return
  }

  if (!toolbarOpen.value) {
    return
  }

  const target = event.target
  if (!(target instanceof Node)) {
    toolbarOpen.value = false
    return
  }

  if (floatingToolbarRef.value?.contains(target)) {
    return
  }

  if (topActionsRef.value?.contains(target)) {
    return
  }

  toolbarOpen.value = false
}

async function submitQuickCapture() {
  if (quickCaptureSubmitDisabled.value) {
    return
  }

  const targetWorkspaceId = quickCaptureWorkspaceId.value
  const sanitizedBaseName = quickCaptureName.value
    .trim()
    .replace(/^\/+/, '')
    .replace(/\/+/g, '-')

  if (!sanitizedBaseName) {
    quickCaptureError.value = '请输入文件名。'
    return
  }

  const language = normalizeLanguage(quickCaptureLanguage.value)
  const finalName = applyLanguageToFileName(sanitizedBaseName, language)
  const tags = normalizeTagsInput(quickCaptureTags.value)

  quickCaptureSubmitting.value = true
  quickCaptureError.value = ''

  try {
    const created = await workspaceApi.createFile(targetWorkspaceId, {
      name: finalName,
      path: `/${finalName}`,
      language,
      content: quickCaptureContent.value,
      tags,
      kind: 'file',
      order: 9999,
    })

    quickCaptureOpen.value = false

    if (route.path === '/workspace') {
      await router.replace('/search')
    }

    await router.push({
      path: '/workspace',
      query: {
        workspaceId: targetWorkspaceId,
        fileId: created.id,
      },
    })
  } catch (error) {
    quickCaptureError.value =
      error instanceof Error ? error.message : '快速捕获失败，请稍后重试。'
  } finally {
    quickCaptureSubmitting.value = false
  }
}

function navigateToWorkspace() {
  void router.push('/workspace')
}

async function logoutToLogin() {
  if (isLoginRoute.value || loggingOut.value) {
    return
  }

  toolbarOpen.value = false
  quickCaptureOpen.value = false
  loggingOut.value = true

  try {
    await authApi.logout()
  } catch {
    setAuthToken(null)
  } finally {
    setAuthToken(null)
    loggingOut.value = false
  }

  await router.replace('/login')
}

function updateContentTopInset() {
  if (isLoginRoute.value) {
    contentTopInset.value = 0
    return
  }

  const navBottom = mainNavRef.value?.getBoundingClientRect().bottom ?? 0
  const topActionsBottom = topActionsRef.value?.getBoundingClientRect().bottom ?? 0
  const insetBase = Math.max(navBottom, topActionsBottom)
  contentTopInset.value = Math.max(0, Math.ceil(insetBase + 10))
}

function scheduleContentTopInsetUpdate() {
  void nextTick(() => {
    updateContentTopInset()
  })
}

function handleViewportResize() {
  updateContentTopInset()
}

watch(
  () => route.path,
  (path) => {
    if (path === '/login') {
      toolbarOpen.value = false
      quickCaptureOpen.value = false
    }

    scheduleContentTopInsetUpdate()
  },
  { immediate: true },
)

function handleGlobalQuickCaptureShortcut(event: KeyboardEvent) {
  if (isLoginRoute.value) {
    return
  }

  if (event.key === 'Escape') {
    if (quickCaptureOpen.value) {
      event.preventDefault()
      closeQuickCaptureDialog()
      return
    }

    if (toolbarOpen.value) {
      event.preventDefault()
      toolbarOpen.value = false
    }
    return
  }

  if (!(event.metaKey || event.ctrlKey)) {
    return
  }

  if (!event.shiftKey) {
    return
  }

  if (event.key.toLowerCase() !== 'k') {
    return
  }

  event.preventDefault()
  toggleFloatingToolbar()
}

onMounted(() => {
  window.addEventListener('keydown', handleGlobalQuickCaptureShortcut)
  window.addEventListener('mousedown', handleToolbarOutsidePointerDown)
  window.addEventListener('resize', handleViewportResize)
  scheduleContentTopInsetUpdate()
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleGlobalQuickCaptureShortcut)
  window.removeEventListener('mousedown', handleToolbarOutsidePointerDown)
  window.removeEventListener('resize', handleViewportResize)
})
</script>

<template>
  <div class="route-shell" data-testid="route-shell">
    <nav
      v-if="!isLoginRoute"
      ref="mainNavRef"
      class="route-shell-main-nav"
      data-testid="app-main-nav"
      aria-label="页面主导航"
    >
      <RouterLink
        data-testid="main-nav-workspace"
        class="main-nav-link"
        :class="{ active: isActive('/workspace') }"
        to="/workspace"
      >
        工作区
      </RouterLink>
      <RouterLink
        data-testid="main-nav-search"
        class="main-nav-link"
        :class="{ active: isActive('/search') }"
        to="/search"
      >
        搜索
      </RouterLink>
      <RouterLink
        data-testid="main-nav-favorites"
        class="main-nav-link"
        :class="{ active: isActive('/favorites') }"
        to="/favorites"
      >
        收藏
      </RouterLink>
      <RouterLink
        data-testid="main-nav-team"
        class="main-nav-link"
        :class="{ active: isActive('/team') }"
        to="/team"
      >
        团队
      </RouterLink>
      <RouterLink
        data-testid="main-nav-settings"
        class="main-nav-link"
        :class="{ active: isActive('/settings') }"
        to="/settings"
      >
        设置
      </RouterLink>
    </nav>

    <header
      v-if="toolbarOpen && !isLoginRoute"
      ref="floatingToolbarRef"
      class="route-shell-header"
      data-testid="floating-toolbar"
    >
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
          data-testid="nav-favorites"
          class="route-shell-link"
          :class="{ active: isActive('/favorites') }"
          to="/favorites"
        >
          收藏
        </RouterLink>
        <RouterLink
          data-testid="nav-team"
          class="route-shell-link"
          :class="{ active: isActive('/team') }"
          to="/team"
        >
          团队
        </RouterLink>
        <button
          type="button"
          class="route-shell-link route-shell-capture-link"
          data-testid="quick-capture-open"
          @click="openQuickCaptureDialog"
        >
          快速捕获
        </button>
      </nav>
    </header>

    <div
      v-if="!isLoginRoute"
      ref="topActionsRef"
      class="route-shell-top-actions"
    >
      <button
        v-if="isSettingsRoute"
        type="button"
        class="route-shell-icon-action"
        data-testid="back-to-workspace"
        aria-label="返回工作台"
        title="返回工作台"
        @click="navigateToWorkspace"
      >
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M7.8 4.6a.9.9 0 0 1 1.3 1.2L5.8 9.1h9.3a.9.9 0 1 1 0 1.8H5.8l3.3 3.3a.9.9 0 0 1-1.3 1.2L3 10.6a.9.9 0 0 1 0-1.2l4.8-4.8Z" />
        </svg>
      </button>
      <RouterLink
        v-else
        data-testid="open-settings"
        class="route-shell-icon-action"
        :class="{ active: isActive('/settings') }"
        to="/settings"
        aria-label="打开设置"
        title="打开设置"
      >
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path
            d="M9.9 2.2a.9.9 0 0 1 1.8 0l.2 1.4a6.8 6.8 0 0 1 1.8.8l1.2-.7a.9.9 0 0 1 1.2.3l.9 1.5a.9.9 0 0 1-.3 1.2l-1.1.7a7.6 7.6 0 0 1 0 2l1.1.7a.9.9 0 0 1 .3 1.2l-.9 1.5a.9.9 0 0 1-1.2.3l-1.2-.7a6.8 6.8 0 0 1-1.8.8l-.2 1.4a.9.9 0 0 1-1.8 0l-.2-1.4a6.8 6.8 0 0 1-1.8-.8l-1.2.7a.9.9 0 0 1-1.2-.3l-.9-1.5a.9.9 0 0 1 .3-1.2l1.1-.7a7.6 7.6 0 0 1 0-2l-1.1-.7a.9.9 0 0 1-.3-1.2l.9-1.5a.9.9 0 0 1 1.2-.3l1.2.7a6.8 6.8 0 0 1 1.8-.8l.2-1.4Zm1 4.9a2.9 2.9 0 1 0 0 5.8 2.9 2.9 0 0 0 0-5.8Z"
          />
        </svg>
      </RouterLink>
      <button
        type="button"
        class="route-shell-icon-action"
        data-testid="global-logout"
        aria-label="退出登录"
        title="退出登录"
        :disabled="loggingOut"
        @click="logoutToLogin"
      >
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M11.2 3.3a.9.9 0 0 1 0 1.8H7.3A2.3 2.3 0 0 0 5 7.4v5.2a2.3 2.3 0 0 0 2.3 2.3h3.9a.9.9 0 1 1 0 1.8H7.3a4.1 4.1 0 0 1-4.1-4.1V7.4a4.1 4.1 0 0 1 4.1-4.1h3.9Zm2.7 3.5a.9.9 0 0 1 1.3 0l2.6 2.6a.9.9 0 0 1 0 1.2l-2.6 2.6a.9.9 0 1 1-1.3-1.2l1.1-1.1H9.3a.9.9 0 1 1 0-1.8H15l-1.1-1.1a.9.9 0 0 1 0-1.2Z" />
        </svg>
      </button>
      <button
        type="button"
        class="route-shell-icon-action primary"
        data-testid="toolbar-toggle"
        aria-label="显示工具栏（Ctrl/Cmd + Shift + K）"
        title="显示工具栏（Ctrl/Cmd + Shift + K）"
        @click="toggleFloatingToolbar"
      >
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M4.2 4.4a.9.9 0 0 1 .9-.9h9.8a.9.9 0 1 1 0 1.8H5.1a.9.9 0 0 1-.9-.9Zm0 5.6a.9.9 0 0 1 .9-.9h9.8a.9.9 0 1 1 0 1.8H5.1a.9.9 0 0 1-.9-.9Zm.9 4.7a.9.9 0 1 0 0 1.8h9.8a.9.9 0 1 0 0-1.8H5.1Z" />
        </svg>
      </button>
    </div>

    <section
      class="route-shell-content"
      :class="{ 'route-shell-content-login': isLoginRoute }"
      :style="{ '--route-shell-content-top-inset': `${contentTopInset}px` }"
    >
      <RouterView />
    </section>

    <Teleport to="body">
      <div
        v-if="quickCaptureOpen && !isLoginRoute"
        class="quick-capture-float"
        data-testid="quick-capture-dialog"
      >
        <section class="quick-capture-card" role="dialog" aria-modal="false" aria-label="快速捕获">
          <header class="quick-capture-head">
            <div>
              <h3>快速捕获</h3>
              <p>先用 Ctrl/Cmd + Shift + K 唤出工具栏</p>
            </div>
            <button type="button" class="quick-capture-close" @click="closeQuickCaptureDialog">
              关闭
            </button>
          </header>

          <div class="quick-capture-body">
            <label>
              工作区
              <select
                v-model="quickCaptureWorkspaceId"
                data-testid="quick-capture-workspace"
                :disabled="quickCaptureLoading || quickCaptureSubmitting"
              >
                <option
                  v-for="item in quickCaptureWorkspaces"
                  :key="item.id"
                  :value="item.id"
                >
                  {{ item.title }}
                </option>
              </select>
            </label>

            <label>
              文件名
              <input
                v-model="quickCaptureName"
                data-testid="quick-capture-name"
                type="text"
                placeholder="quick-capture"
                :disabled="quickCaptureSubmitting"
              >
            </label>

            <label>
              语言
              <select
                v-model="quickCaptureLanguage"
                data-testid="quick-capture-language"
                :disabled="quickCaptureSubmitting"
              >
                <option
                  v-for="option in MANUAL_LANGUAGE_OPTIONS"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </option>
              </select>
            </label>

            <label>
              标签
              <input
                v-model="quickCaptureTags"
                data-testid="quick-capture-tags"
                type="text"
                placeholder="例如 quick, api"
                :disabled="quickCaptureSubmitting"
              >
            </label>

            <label class="content-label">
              内容
              <textarea
                v-model="quickCaptureContent"
                data-testid="quick-capture-content"
                rows="8"
                :disabled="quickCaptureSubmitting"
              />
            </label>
          </div>

          <p v-if="quickCaptureError" class="quick-capture-error">
            {{ quickCaptureError }}
          </p>

          <footer class="quick-capture-actions">
            <button
              type="button"
              data-testid="quick-capture-cancel"
              :disabled="quickCaptureSubmitting"
              @click="closeQuickCaptureDialog"
            >
              取消
            </button>
            <button
              type="button"
              class="primary"
              data-testid="quick-capture-submit"
              :disabled="quickCaptureSubmitDisabled"
              @click="submitQuickCapture"
            >
              {{ quickCaptureSubmitting ? '创建中...' : '创建并打开' }}
            </button>
          </footer>
        </section>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.route-shell {
  position: relative;
  min-height: 100vh;
  background: var(--theme-surface-toolbar-glass-tint-overlay), var(--theme-layout-app-shell-background);
}

.route-shell-main-nav {
  position: fixed;
  top: 12px;
  left: 18px;
  z-index: 25;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  max-width: calc(100vw - 180px);
  padding: 6px 9px;
  border: 1px solid var(--theme-surface-toolbar-glass-border);
  border-radius: 999px;
  background: var(--theme-surface-toolbar-glass-background);
  -webkit-backdrop-filter: var(--theme-surface-toolbar-glass-backdrop-filter);
  backdrop-filter: var(--theme-surface-toolbar-glass-backdrop-filter);
  box-shadow: var(--theme-surface-toolbar-glass-shadow);
}

.main-nav-link {
  text-decoration: none;
  border: 1px solid var(--theme-surface-toolbar-link-border);
  border-radius: 999px;
  padding: 6px 12px;
  color: var(--theme-surface-toolbar-link-text);
  background: var(--theme-surface-toolbar-link-background);
  box-shadow: var(--theme-surface-toolbar-link-inset-shadow);
  cursor: pointer;
  transition:
    border-color 150ms ease,
    background 150ms ease,
    color 150ms ease,
    transform 150ms ease;
  font-size: 13px;
  line-height: 1.2;
}

.main-nav-link:hover {
  border-color: var(--theme-surface-toolbar-link-hover-border);
  background: var(--theme-surface-toolbar-link-hover-background);
  transform: translateY(-1px);
}

.main-nav-link.active {
  border-color: var(--theme-surface-toolbar-link-active-border);
  background: var(--theme-surface-toolbar-link-active-background);
  color: var(--theme-surface-toolbar-link-active-text);
  box-shadow: var(--theme-surface-toolbar-link-active-shadow);
}

.route-shell-header {
  position: fixed;
  top: min(18vh, 136px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 20;
  display: inline-flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border: 1px solid var(--theme-surface-toolbar-glass-border);
  border-radius: 999px;
  background: var(--theme-surface-toolbar-glass-background);
  -webkit-backdrop-filter: var(--theme-surface-toolbar-glass-backdrop-filter);
  backdrop-filter: var(--theme-surface-toolbar-glass-backdrop-filter);
  box-shadow: var(--theme-surface-toolbar-glass-shadow);
  overflow: hidden;
  isolation: isolate;
  animation: toolbar-fade-in 0.16s ease-out;
  color: var(--theme-surface-toolbar-title-text);
}

.route-shell-header::before {
  content: '';
  position: absolute;
  left: -22%;
  right: -22%;
  top: -84px;
  height: 146px;
  background: var(--theme-surface-toolbar-glass-highlight-arc);
  filter: blur(1.2px);
  pointer-events: none;
}

.route-shell-header::after {
  content: '';
  position: absolute;
  inset: 0;
  background: var(--theme-surface-toolbar-glass-tint-overlay);
  pointer-events: none;
}

.route-shell-header > * {
  position: relative;
  z-index: 1;
}

.route-shell-header h1 {
  font-size: 12px;
  margin: 0;
  color: var(--theme-surface-toolbar-title-text);
}

.route-shell-nav {
  display: flex;
  gap: 8px;
}

.route-shell-link {
  text-decoration: none;
  border: 1px solid var(--theme-surface-toolbar-link-border);
  border-radius: 999px;
  padding: 6px 12px;
  color: var(--theme-surface-toolbar-link-text);
  background: var(--theme-surface-toolbar-link-background);
  -webkit-backdrop-filter: blur(12px);
  backdrop-filter: blur(12px);
  box-shadow: var(--theme-surface-toolbar-link-inset-shadow);
  transition:
    border-color 120ms ease,
    background 120ms ease,
    color 120ms ease,
    transform 120ms ease;
  cursor: pointer;
}

.route-shell-capture-link {
  cursor: pointer;
  font: inherit;
  border-color: var(--theme-surface-toolbar-capture-border);
  background: var(--theme-surface-toolbar-capture-background);
}

.route-shell-link:hover {
  border-color: var(--theme-surface-toolbar-link-hover-border);
  background: var(--theme-surface-toolbar-link-hover-background);
  transform: translateY(-1px);
}

.route-shell-link.active {
  color: var(--theme-surface-toolbar-link-active-text);
  border-color: var(--theme-surface-toolbar-link-active-border);
  background: var(--theme-surface-toolbar-link-active-background);
  box-shadow: var(--theme-surface-toolbar-link-active-shadow);
}

.route-shell-top-actions {
  position: fixed;
  top: 12px;
  right: 18px;
  z-index: 25;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 36px;
}

.route-shell-icon-action {
  box-sizing: border-box;
  width: 36px;
  height: 36px;
  border: 1px solid var(--theme-surface-statusbar-border);
  border-radius: 999px;
  background: var(--theme-surface-glass-header-background);
  color: var(--theme-text-secondary);
  backdrop-filter: var(--theme-surface-overlay-blur);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  text-decoration: none;
  padding: 0;
  line-height: 1;
  appearance: none;
  -webkit-appearance: none;
  transition:
    border-color 140ms ease,
    background 140ms ease,
    color 140ms ease,
    transform 140ms ease;
}

.route-shell-icon-action:hover {
  border-color: var(--theme-surface-toolbar-link-hover-border);
  background: var(--theme-surface-toolbar-link-hover-background);
  color: var(--theme-surface-toolbar-link-hover-border);
  transform: translateY(-1px);
}

.route-shell-icon-action:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.route-shell-icon-action svg {
  width: 17px;
  height: 17px;
  fill: currentColor;
}

.route-shell-icon-action.primary {
  border-color: var(--theme-accent-primary-button-border);
  background: var(--theme-accent-primary-button-gradient);
  color: var(--theme-accent-primary-button-text);
}

.route-shell-icon-action.primary:hover {
  border-color: var(--theme-accent-primary-button-border);
  background: var(--theme-accent-primary-button-gradient);
  color: var(--theme-accent-primary-button-text);
  filter: brightness(1.04);
}

.route-shell-icon-action.active {
  border-color: var(--theme-accent-selected-border);
  background: var(--theme-surface-row-active-background);
  color: var(--theme-accent-selected-text);
}

.route-shell-icon-action:focus-visible,
.route-shell-link:focus-visible,
.main-nav-link:focus-visible,
.quick-capture-close:focus-visible,
.quick-capture-actions button:focus-visible,
.quick-capture-body input:focus-visible,
.quick-capture-body select:focus-visible,
.quick-capture-body textarea:focus-visible {
  outline: 2px solid var(--theme-accent-focus-border);
  outline-offset: 2px;
  box-shadow: 0 0 0 3px var(--theme-accent-focus-ring);
}

.route-shell-content {
  height: 100vh;
  overflow: hidden;
}

.quick-capture-float {
  position: fixed;
  top: min(17vh, 140px);
  left: 50%;
  transform: translateX(-50%);
  width: min(680px, calc(100vw - 32px));
  z-index: 60;
}

.quick-capture-card {
  width: 100%;
  max-height: min(66vh, 500px);
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto auto;
  gap: 10px;
  border-radius: 18px;
  border: 1px solid var(--theme-surface-toolbar-glass-border);
  backdrop-filter: var(--theme-surface-toolbar-glass-backdrop-filter);
  background: var(--theme-surface-toolbar-glass-tint-overlay), var(--theme-surface-glass-card-background);
  box-shadow: var(--theme-surface-toolbar-glass-shadow);
  padding: 14px 16px;
}

.quick-capture-head h3 {
  margin: 0;
  color: var(--theme-text-primary);
  font-size: 18px;
}

.quick-capture-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--theme-surface-statusbar-border);
}

.quick-capture-head p {
  margin: 4px 0 0;
  color: var(--theme-text-tertiary);
  font-size: 12px;
}

.quick-capture-close {
  border: 1px solid var(--theme-surface-neutral-button-border);
  background: var(--theme-surface-neutral-button-background);
  color: var(--theme-text-secondary);
  border-radius: 8px;
  padding: 4px 8px;
  font-size: 12px;
  cursor: pointer;
  transition:
    border-color 150ms ease,
    background 150ms ease,
    transform 150ms ease;
}

.quick-capture-close:hover {
  border-color: var(--theme-accent-row-action-border);
  transform: translateY(-1px);
}

.quick-capture-body {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  overflow: auto;
  padding-right: 2px;
}

.quick-capture-body label {
  display: grid;
  gap: 4px;
  color: var(--theme-text-secondary);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.quick-capture-body input,
.quick-capture-body select,
.quick-capture-body textarea {
  border: 1px solid var(--theme-surface-input-border);
  background: var(--theme-surface-input-background);
  color: var(--theme-text-primary);
  border-radius: 8px;
  padding: 6px 9px;
  font: inherit;
}

.quick-capture-body textarea {
  resize: vertical;
  min-height: 160px;
}

.quick-capture-body .content-label {
  grid-column: 1 / -1;
}

.quick-capture-error {
  margin: 0;
  color: var(--theme-text-danger-strong);
  font-size: 12px;
}

.quick-capture-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.quick-capture-actions button {
  border: 1px solid var(--theme-surface-neutral-button-border);
  background: var(--theme-surface-neutral-button-background);
  color: var(--theme-text-primary);
  border-radius: 8px;
  padding: 6px 11px;
  cursor: pointer;
  transition:
    border-color 150ms ease,
    background 150ms ease,
    transform 150ms ease;
}

.quick-capture-actions button:hover {
  border-color: var(--theme-accent-row-action-border);
  transform: translateY(-1px);
}

.quick-capture-actions button.primary {
  border-color: var(--theme-accent-primary-button-border);
  background: var(--theme-accent-primary-button-gradient);
  color: var(--theme-accent-primary-button-text);
}

.quick-capture-actions button.primary:hover {
  border-color: var(--theme-accent-primary-button-border);
  background: var(--theme-accent-primary-button-gradient);
  filter: brightness(1.04);
}

.quick-capture-actions button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

@media (prefers-reduced-motion: reduce) {
  .route-shell-header,
  .route-shell-link,
  .main-nav-link,
  .route-shell-icon-action,
  .quick-capture-close,
  .quick-capture-actions button {
    animation: none;
    transition: none;
  }
}

@media (max-width: 900px) {
  .route-shell-main-nav {
    left: 12px;
    top: 10px;
    max-width: calc(100vw - 132px);
    gap: 6px;
  }

  .main-nav-link {
    padding: 6px 9px;
    font-size: 12px;
  }

  .route-shell-header {
    top: min(14vh, 90px);
    padding: 7px 9px;
  }

  .route-shell-header h1 {
    display: none;
  }

  .route-shell-link {
    padding: 6px 10px;
    font-size: 12px;
  }

  .route-shell-top-actions {
    right: 12px;
    top: 10px;
  }
}

@keyframes toolbar-fade-in {
  from {
    opacity: 0;
    transform: translate(-50%, -10px);
  }
  to {
    opacity: 1;
    transform: translate(-50%, 0);
  }
}
</style>
