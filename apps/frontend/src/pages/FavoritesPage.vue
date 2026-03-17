<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { favoritesApi } from '@/api/favorites'
import type { FavoriteItem } from '@/types/workspace'

const router = useRouter()

const typeFilter = ref<'all' | 'workspace' | 'file'>('all')
const tagFilter = ref('')
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const items = ref<FavoriteItem[]>([])
const loading = ref(false)
const errorMessage = ref('')

const totalPages = computed(() => {
  if (total.value === 0) {
    return 1
  }

  return Math.max(1, Math.ceil(total.value / pageSize.value))
})

async function loadFavorites(options?: { resetPage?: boolean }) {
  if (options?.resetPage) {
    page.value = 1
  }

  loading.value = true
  errorMessage.value = ''

  try {
    const result = await favoritesApi.list({
      type: typeFilter.value,
      tag: tagFilter.value.trim() || undefined,
      page: page.value,
      pageSize: pageSize.value,
    })

    items.value = result.items
    total.value = result.total
    page.value = result.page
    pageSize.value = result.pageSize
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '加载收藏失败，请稍后重试。'
  } finally {
    loading.value = false
  }
}

function clearFilters() {
  typeFilter.value = 'all'
  tagFilter.value = ''
  void loadFavorites({ resetPage: true })
}

function onTagKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    tagFilter.value = ''
    return
  }

  if (event.key !== 'Enter') {
    return
  }

  event.preventDefault()
  void loadFavorites({ resetPage: true })
}

function openFavorite(item: FavoriteItem) {
  void router.push({
    path: '/workspace',
    query: {
      workspaceId: item.workspaceId,
      ...(item.type === 'file' ? { fileId: item.id } : {}),
    },
  })
}

function goToWorkspace() {
  void router.push('/workspace')
}

function goToPage(nextPage: number) {
  page.value = Math.max(1, nextPage)
  void loadFavorites()
}

onMounted(() => {
  void loadFavorites()
})
</script>

<template>
  <main class="favorites-page" data-testid="favorites-page">
    <header class="favorites-header">
      <div>
        <p class="eyebrow">Favorites</p>
        <h2>收藏视图</h2>
      </div>
      <p class="meta">{{ total }} 条收藏</p>
    </header>

    <section class="favorites-filters" data-testid="favorites-filters">
      <label>
        类型
        <select v-model="typeFilter" data-testid="favorites-type-select" @change="loadFavorites({ resetPage: true })">
          <option value="all">全部</option>
          <option value="workspace">工作区</option>
          <option value="file">文件</option>
        </select>
      </label>

      <label>
        标签
        <input
          v-model="tagFilter"
          data-testid="favorites-tag-input"
          type="text"
          placeholder="backend"
          @blur="loadFavorites({ resetPage: true })"
          @keydown="onTagKeydown"
        >
      </label>

      <label>
        每页
        <input
          v-model.number="pageSize"
          data-testid="favorites-page-size"
          type="number"
          min="1"
          max="100"
          @change="loadFavorites({ resetPage: true })"
        >
      </label>

      <div class="favorites-actions">
        <button data-testid="favorites-refresh" type="button" :disabled="loading" @click="loadFavorites({ resetPage: true })">
          {{ loading ? '加载中...' : '刷新' }}
        </button>
        <button data-testid="favorites-clear" type="button" @click="clearFilters">清空过滤</button>
      </div>
    </section>

    <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>

    <section class="favorites-content" data-testid="favorites-content">
      <section v-if="items.length > 0" class="favorites-list" data-testid="favorites-list">
        <article v-for="item in items" :key="`${item.type}-${item.id}`" class="favorites-item" data-testid="favorites-item">
          <div class="favorites-item-main">
            <strong>{{ item.title }}</strong>
            <span>{{ item.workspaceTitle }}</span>
            <code v-if="item.path">{{ item.path }}</code>
            <span class="tag-row">{{ item.tags.join(', ') || '无标签' }}</span>
          </div>
          <button data-testid="favorites-open" type="button" @click="openFavorite(item)">打开</button>
        </article>
      </section>

      <section v-else class="favorites-empty-panel" data-testid="favorites-empty-panel">
        <p class="empty-note" data-testid="favorites-empty">
          {{ loading ? '正在加载收藏...' : '还没有收藏项，先在工作区或文件上点击收藏。' }}
        </p>
        <button
          v-if="!loading"
          type="button"
          class="favorites-empty-action"
          data-testid="favorites-empty-go-workspace"
          @click="goToWorkspace"
        >
          去工作区添加收藏
        </button>
      </section>
    </section>

    <footer v-if="items.length > 0" class="favorites-pagination" data-testid="favorites-pagination">
      <button data-testid="favorites-prev" type="button" :disabled="page <= 1 || loading" @click="goToPage(page - 1)">上一页</button>
      <span data-testid="favorites-page-indicator">第 {{ page }} / {{ totalPages }} 页</span>
      <button data-testid="favorites-next" type="button" :disabled="page >= totalPages || loading" @click="goToPage(page + 1)">下一页</button>
    </footer>
  </main>
</template>

<style scoped>
.favorites-page {
  display: grid;
  grid-template-rows: auto auto auto minmax(0, 1fr) auto;
  align-content: start;
  gap: 12px;
  padding: calc(var(--route-shell-content-top-inset, 0px) + 18px) 16px 16px;
  min-height: 100%;
  width: min(1280px, 100%);
  margin: 0 auto;
}

.favorites-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
  border: 1px solid var(--theme-surface-row-border);
  border-radius: 14px;
  background: var(--theme-surface-glass-card-background);
  backdrop-filter: var(--theme-surface-overlay-blur);
  padding: 12px 14px;
}

.favorites-filters {
  display: grid;
  grid-template-columns: repeat(3, minmax(120px, 210px)) minmax(0, 1fr);
  gap: 10px 12px;
  align-items: end;
  border: 1px solid var(--theme-surface-row-border);
  border-radius: 12px;
  background: var(--theme-surface-glass-card-background);
  backdrop-filter: var(--theme-surface-overlay-blur);
  padding: 10px 12px;
}

.favorites-filters label {
  display: grid;
  gap: 4px;
  color: var(--theme-text-secondary);
  font-size: 12px;
  font-weight: 600;
}

.favorites-filters input,
.favorites-filters select {
  width: 100%;
  border: 1px solid var(--theme-surface-input-border);
  background: var(--theme-surface-input-background);
  color: var(--theme-text-primary);
  border-radius: 8px;
  padding: 0 8px;
  min-height: 34px;
}

.favorites-actions {
  justify-self: end;
}

.favorites-actions,
.favorites-pagination {
  display: flex;
  gap: 8px;
  align-items: center;
}

.favorites-actions button,
.favorites-pagination button,
.favorites-item button {
  border: 1px solid var(--theme-surface-neutral-button-border);
  background: var(--theme-surface-neutral-button-background);
  color: var(--theme-text-primary);
  border-radius: 8px;
  padding: 6px 10px;
  cursor: pointer;
}

.favorites-content {
  min-height: 0;
  border: 1px solid var(--theme-surface-row-border);
  background: var(--theme-surface-glass-card-background);
  border-radius: 12px;
  padding: 10px;
  overflow: auto;
}

.favorites-list {
  display: grid;
  gap: 8px;
  align-content: start;
}

.favorites-item {
  border: 1px solid var(--theme-surface-row-border);
  background: var(--theme-surface-glass-card-background);
  border-radius: 12px;
  padding: 10px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.favorites-item-main {
  display: grid;
  gap: 2px;
}

.favorites-empty-panel {
  min-height: 160px;
  display: grid;
  align-content: center;
  justify-items: start;
  gap: 10px;
  padding: 8px;
}

.favorites-empty-action {
  border: 1px solid var(--theme-accent-primary-button-border);
  background: var(--theme-accent-primary-button-gradient);
  color: var(--theme-accent-primary-button-text);
  border-radius: 8px;
  padding: 7px 12px;
  cursor: pointer;
}

.favorites-pagination {
  justify-content: flex-end;
}

.tag-row,
.meta,
.eyebrow,
.empty-note {
  color: var(--theme-text-tertiary);
}

.error-message {
  color: var(--theme-text-danger-strong);
}

@media (max-width: 960px) {
  .favorites-page {
    padding: calc(var(--route-shell-content-top-inset, 0px) + 14px) 12px 12px;
  }

  .favorites-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .favorites-filters {
    grid-template-columns: 1fr 1fr;
  }

  .favorites-actions {
    justify-self: start;
    grid-column: 1 / -1;
  }
}
</style>
