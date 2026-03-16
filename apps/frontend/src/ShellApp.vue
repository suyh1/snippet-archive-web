<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { workspaceApi } from '@/api/workspaces'
import type { Workspace } from '@/types/workspace'
import {
  applyLanguageToFileName,
  MANUAL_LANGUAGE_OPTIONS,
  normalizeLanguage,
} from '@/utils/language-detect'

const route = useRoute()
const router = useRouter()

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

function handleGlobalQuickCaptureShortcut(event: KeyboardEvent) {
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
  void openQuickCaptureDialog()
}

onMounted(() => {
  window.addEventListener('keydown', handleGlobalQuickCaptureShortcut)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleGlobalQuickCaptureShortcut)
})
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
          data-testid="nav-favorites"
          class="route-shell-link"
          :class="{ active: isActive('/favorites') }"
          to="/favorites"
        >
          收藏
        </RouterLink>
        <RouterLink
          data-testid="nav-settings"
          class="route-shell-link"
          :class="{ active: isActive('/settings') }"
          to="/settings"
        >
          设置
        </RouterLink>
        <button
          type="button"
          class="route-shell-action"
          data-testid="quick-capture-open"
          @click="openQuickCaptureDialog"
        >
          快速捕获
        </button>
      </nav>
    </header>

    <section class="route-shell-content">
      <RouterView />
    </section>

    <Teleport to="body">
      <div
        v-if="quickCaptureOpen"
        class="quick-capture-overlay"
        data-testid="quick-capture-dialog"
        @click.self="closeQuickCaptureDialog"
      >
        <section class="quick-capture-card" role="dialog" aria-modal="true" aria-label="快速捕获">
          <header class="quick-capture-head">
            <h3>快速捕获</h3>
            <p>快捷键：Ctrl/Cmd + Shift + K</p>
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

.route-shell-action {
  pointer-events: auto;
  border: 1px solid var(--theme-accent-primary-button-border);
  border-radius: 999px;
  padding: 6px 12px;
  color: var(--theme-accent-primary-button-text);
  background: var(--theme-accent-primary-button-gradient);
  cursor: pointer;
  font-size: 12px;
  font-weight: 700;
}

.route-shell-content {
  height: 100vh;
  overflow: hidden;
}

.quick-capture-overlay {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: grid;
  place-items: center;
  background: var(--theme-surface-overlay-strong-background);
  backdrop-filter: var(--theme-surface-overlay-soft-blur);
}

.quick-capture-card {
  width: min(680px, calc(100vw - 32px));
  max-height: min(84vh, 760px);
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto auto;
  gap: 10px;
  border-radius: 16px;
  border: 1px solid var(--theme-surface-glass-panel-border);
  background: var(--theme-surface-glass-card-background);
  box-shadow: var(--theme-surface-glass-panel-shadow);
  padding: 14px 16px;
}

.quick-capture-head h3 {
  margin: 0;
  color: var(--theme-text-primary);
  font-size: 18px;
}

.quick-capture-head p {
  margin: 4px 0 0;
  color: var(--theme-text-tertiary);
  font-size: 12px;
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
  font-weight: 600;
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
}

.quick-capture-actions button.primary {
  border-color: var(--theme-accent-primary-button-border);
  background: var(--theme-accent-primary-button-gradient);
  color: var(--theme-accent-primary-button-text);
}

.quick-capture-actions button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
</style>
