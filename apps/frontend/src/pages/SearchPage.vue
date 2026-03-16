<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useSearchStore } from '@/stores/search.store'
import type { SearchSnippet } from '@/types/workspace'

const router = useRouter()
const searchStore = useSearchStore()
const {
  keyword,
  language,
  tag,
  workspaceId,
  updatedFrom,
  updatedTo,
  page,
  pageSize,
  total,
  items,
  loading,
  errorMessage,
  presets,
} = storeToRefs(searchStore)

const presetName = ref('')
const hasResults = computed(() => items.value.length > 0)
const totalPages = computed(() => searchStore.totalPages)

async function submitSearch() {
  await searchStore.runSearch({ resetPage: true })
}

async function clearSearch() {
  searchStore.clearFilters()
}

function onKeywordEsc() {
  keyword.value = ''
}

function savePreset() {
  searchStore.savePreset(presetName.value)
  presetName.value = ''
}

async function applyPreset(presetId: string) {
  searchStore.applyPreset(presetId)
  await searchStore.runSearch({ resetPage: true })
}

async function goToPage(targetPage: number) {
  searchStore.setPage(targetPage)
  await searchStore.runSearch()
}

function openResult(item: SearchSnippet) {
  void router.push({
    path: '/workspace',
    query: {
      workspaceId: item.workspaceId,
      fileId: item.id,
    },
  })
}
</script>

<template>
  <main class="search-page" data-testid="search-page">
    <header class="search-header">
      <div>
        <p class="eyebrow">Search Center</p>
        <h2>全局检索</h2>
      </div>
      <p class="meta">{{ total }} 条结果</p>
    </header>

    <section class="search-filters">
      <form class="search-form" @submit.prevent="submitSearch">
        <label>
          关键词
          <input
            v-model="keyword"
            data-testid="search-keyword-input"
            type="search"
            placeholder="标题 / 路径 / 内容"
            @keydown.enter.prevent="submitSearch"
            @keydown.esc.prevent="onKeywordEsc"
          />
        </label>

        <label>
          语言
          <input
            v-model="language"
            data-testid="search-language-input"
            type="text"
            placeholder="typescript"
          />
        </label>

        <label>
          标签
          <input
            v-model="tag"
            data-testid="search-tag-input"
            type="text"
            placeholder="backend"
          />
        </label>

        <label>
          工作区
          <input
            v-model="workspaceId"
            data-testid="search-workspace-input"
            type="text"
            placeholder="workspace id"
          />
        </label>

        <label>
          起始时间
          <input
            v-model="updatedFrom"
            data-testid="search-updated-from"
            type="datetime-local"
          />
        </label>

        <label>
          结束时间
          <input
            v-model="updatedTo"
            data-testid="search-updated-to"
            type="datetime-local"
          />
        </label>

        <label>
          每页
          <input
            v-model.number="pageSize"
            data-testid="search-page-size"
            type="number"
            min="1"
            max="100"
          />
        </label>

        <div class="search-actions">
          <button data-testid="search-submit" type="submit" :disabled="loading">
            {{ loading ? '搜索中...' : '搜索' }}
          </button>
          <button data-testid="search-clear" type="button" @click="clearSearch">清空</button>
        </div>
      </form>

      <div class="preset-block">
        <label>
          保存当前筛选
          <input
            v-model="presetName"
            data-testid="search-preset-name"
            type="text"
            placeholder="例如：backend-auth"
          />
        </label>
        <button data-testid="search-preset-save" type="button" @click="savePreset">保存预设</button>

        <ul class="preset-list" data-testid="search-preset-list">
          <li v-for="preset in presets" :key="preset.id">
            <button type="button" @click="applyPreset(preset.id)">{{ preset.name }}</button>
          </li>
        </ul>
      </div>
    </section>

    <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>

    <section v-if="hasResults" class="search-results" data-testid="search-result-list">
      <article v-for="item in items" :key="item.id" class="search-result-item" data-testid="search-result-item">
        <div class="search-result-meta">
          <strong>{{ item.name }}</strong>
          <span>{{ item.workspaceTitle }}</span>
          <code>{{ item.path }}</code>
        </div>
        <button data-testid="search-result-open" type="button" @click="openResult(item)">打开</button>
      </article>
    </section>

    <p v-else class="empty-note" data-testid="search-empty">
      {{ loading ? '正在检索...' : '暂无结果，请调整关键词或筛选条件。' }}
    </p>

    <footer class="search-pagination">
      <button
        data-testid="search-page-prev"
        type="button"
        :disabled="page <= 1 || loading"
        @click="goToPage(page - 1)"
      >
        上一页
      </button>
      <span data-testid="search-page-indicator">第 {{ page }} / {{ totalPages }} 页</span>
      <button
        data-testid="search-page-next"
        type="button"
        :disabled="page >= totalPages || loading"
        @click="goToPage(page + 1)"
      >
        下一页
      </button>
    </footer>
  </main>
</template>

<style scoped>
.search-page {
  display: grid;
  gap: 16px;
  padding: 20px;
  min-height: 100%;
}

.search-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.search-form {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
}

.search-form label {
  display: grid;
  gap: 4px;
  font-size: 12px;
}

.search-form input {
  min-height: 34px;
  border-radius: 10px;
  border: 1px solid var(--theme-surface-neutral-button-border);
  background: var(--theme-surface-input-background);
  color: var(--theme-text-primary);
  padding: 0 10px;
}

.search-actions {
  display: flex;
  align-items: end;
  gap: 8px;
}

.search-actions button,
.preset-block button,
.search-pagination button,
.search-result-item button {
  border: 1px solid var(--theme-surface-neutral-button-border);
  background: var(--theme-surface-neutral-button-background);
  color: var(--theme-text-primary);
  border-radius: 10px;
  min-height: 34px;
  padding: 0 12px;
}

.preset-block {
  display: grid;
  gap: 8px;
}

.preset-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.search-results {
  display: grid;
  gap: 10px;
}

.search-result-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  border: 1px solid var(--theme-surface-row-border);
  background: var(--theme-surface-glass-card-background);
  border-radius: 12px;
  padding: 12px;
}

.search-result-meta {
  display: grid;
  gap: 2px;
}

.search-pagination {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.error-message {
  color: var(--theme-text-danger-strong);
}

.empty-note,
.meta,
.eyebrow {
  color: var(--theme-text-tertiary);
}
</style>
