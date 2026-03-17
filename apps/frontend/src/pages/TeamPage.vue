<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { auditApi, type AuditLogItem } from '@/api/audit'
import { authApi, type AuthUser } from '@/api/auth'
import {
  organizationApi,
  type Organization,
  type OrganizationMember,
  type OrganizationRole,
} from '@/api/organization'
import { shareApi, type ShareLink, type ShareVisibility } from '@/api/share'
import { getAuthToken, setAuthToken } from '@/api/http'
import { resolveWorkspaceErrorMessage } from '@/utils/error-message'

const bootLoading = ref(true)
const working = ref(false)
const authUser = ref<AuthUser | null>(null)
const message = ref('')
const errorMessage = ref('')

const authName = ref('')
const authEmail = ref('')
const authPassword = ref('')

const organizations = ref<Organization[]>([])
const selectedOrganizationId = ref('')
const organizationName = ref('')
const organizationSlug = ref('')

const members = ref<OrganizationMember[]>([])
const inviteEmail = ref('')
const inviteRole = ref<OrganizationRole>('VIEWER')

const shareWorkspaceId = ref('')
const shareFileId = ref('')
const shareVisibility = ref<ShareVisibility>('PUBLIC')
const shareExpiry = ref('')
const shareLinks = ref<ShareLink[]>([])

const auditAction = ref('')
const auditLogs = ref<AuditLogItem[]>([])

const canSubmitAuth = computed(() => {
  return (
    authName.value.trim().length > 0 &&
    authEmail.value.trim().length > 0 &&
    authPassword.value.trim().length >= 8
  )
})

const canCreateOrganization = computed(() => {
  return (
    organizationName.value.trim().length > 0 &&
    organizationSlug.value.trim().length >= 3
  )
})

const canCreateShareLink = computed(() => {
  return (
    shareWorkspaceId.value.trim().length > 0 && shareFileId.value.trim().length > 0
  )
})

function setError(error: unknown, fallbackMessage: string) {
  errorMessage.value = resolveWorkspaceErrorMessage(error, fallbackMessage)
}

function clearFeedback() {
  message.value = ''
  errorMessage.value = ''
}

function normalizeSlug(rawValue: string) {
  return rawValue
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function normalizeExpiryInput(value: string) {
  if (!value.trim()) {
    return ''
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const yyyy = String(date.getFullYear())
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const mi = String(date.getMinutes()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`
}

function expiryToIso(value: string) {
  if (!value.trim()) {
    return undefined
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return undefined
  }

  return date.toISOString()
}

function currentOrganization() {
  return organizations.value.find((item) => item.id === selectedOrganizationId.value) ?? null
}

async function loadOrganizations() {
  const items = await organizationApi.listOrganizations()
  organizations.value = items

  if (items.length === 0) {
    selectedOrganizationId.value = ''
    members.value = []
    auditLogs.value = []
    return
  }

  if (!items.some((item) => item.id === selectedOrganizationId.value)) {
    selectedOrganizationId.value = items[0].id
  }
}

async function loadMembers() {
  if (!selectedOrganizationId.value) {
    members.value = []
    return
  }

  members.value = await organizationApi.listMembers(selectedOrganizationId.value)
}

async function loadAuditLogs() {
  if (!selectedOrganizationId.value) {
    auditLogs.value = []
    return
  }

  const data = await auditApi.listOrganizationAuditLogs(selectedOrganizationId.value, {
    action: auditAction.value.trim() || undefined,
    page: 1,
    pageSize: 20,
  })
  auditLogs.value = data.items
}

async function loadShareLinks() {
  if (!shareWorkspaceId.value.trim() || !shareFileId.value.trim()) {
    shareLinks.value = []
    return
  }

  shareLinks.value = await shareApi.listFileShareLinks(
    shareWorkspaceId.value.trim(),
    shareFileId.value.trim(),
  )
}

async function register() {
  if (!canSubmitAuth.value || working.value) {
    return
  }

  clearFeedback()
  working.value = true

  try {
    const session = await authApi.register({
      name: authName.value.trim(),
      email: authEmail.value.trim(),
      password: authPassword.value,
    })
    authUser.value = session.user
    await loadOrganizations()
    await loadMembers()
    await loadAuditLogs()
    message.value = '注册并登录成功。'
  } catch (error) {
    setError(error, '注册失败，请稍后重试。')
  } finally {
    working.value = false
  }
}

async function login() {
  if (authEmail.value.trim().length === 0 || authPassword.value.trim().length < 8) {
    return
  }

  clearFeedback()
  working.value = true

  try {
    const session = await authApi.login({
      email: authEmail.value.trim(),
      password: authPassword.value,
    })
    authUser.value = session.user
    await loadOrganizations()
    await loadMembers()
    await loadAuditLogs()
    message.value = '登录成功。'
  } catch (error) {
    setError(error, '登录失败，请稍后重试。')
  } finally {
    working.value = false
  }
}

async function logout() {
  clearFeedback()
  working.value = true

  try {
    await authApi.logout()
  } catch {
    setAuthToken(null)
  } finally {
    authUser.value = null
    organizations.value = []
    selectedOrganizationId.value = ''
    members.value = []
    shareLinks.value = []
    auditLogs.value = []
    shareWorkspaceId.value = ''
    shareFileId.value = ''
    setAuthToken(null)
    working.value = false
  }
}

async function createOrganization() {
  if (!canCreateOrganization.value || working.value) {
    return
  }

  clearFeedback()
  working.value = true

  try {
    const created = await organizationApi.createOrganization({
      name: organizationName.value.trim(),
      slug: normalizeSlug(organizationSlug.value),
    })
    organizations.value = [created, ...organizations.value.filter((item) => item.id !== created.id)]
    selectedOrganizationId.value = created.id
    organizationName.value = ''
    organizationSlug.value = ''
    await loadMembers()
    await loadAuditLogs()
    message.value = '组织创建成功。'
  } catch (error) {
    setError(error, '创建组织失败，请稍后重试。')
  } finally {
    working.value = false
  }
}

async function addMember() {
  if (!selectedOrganizationId.value || inviteEmail.value.trim().length === 0 || working.value) {
    return
  }

  clearFeedback()
  working.value = true

  try {
    const member = await organizationApi.addMember(selectedOrganizationId.value, {
      email: inviteEmail.value.trim(),
      role: inviteRole.value,
    })
    members.value = [member, ...members.value.filter((item) => item.id !== member.id)]
    inviteEmail.value = ''
    await loadAuditLogs()
    message.value = '成员已加入组织。'
  } catch (error) {
    setError(error, '添加成员失败，请稍后重试。')
  } finally {
    working.value = false
  }
}

async function createShareLink() {
  if (!canCreateShareLink.value || working.value) {
    return
  }

  clearFeedback()
  working.value = true

  try {
    await shareApi.createFileShareLink(
      shareWorkspaceId.value.trim(),
      shareFileId.value.trim(),
      {
        visibility: shareVisibility.value,
        permission: 'READ',
        expiresAt: expiryToIso(shareExpiry.value),
      },
    )
    await loadShareLinks()
    await loadAuditLogs()
    message.value = '分享链接已创建。'
  } catch (error) {
    setError(error, '创建分享链接失败，请稍后重试。')
  } finally {
    working.value = false
  }
}

async function revokeShareLink(shareLinkId: string) {
  if (!canCreateShareLink.value || working.value) {
    return
  }

  clearFeedback()
  working.value = true

  try {
    await shareApi.revokeFileShareLink(
      shareWorkspaceId.value.trim(),
      shareFileId.value.trim(),
      shareLinkId,
    )
    await loadShareLinks()
    await loadAuditLogs()
    message.value = '分享链接已撤销。'
  } catch (error) {
    setError(error, '撤销分享链接失败，请稍后重试。')
  } finally {
    working.value = false
  }
}

async function queryAuditLogs() {
  if (!selectedOrganizationId.value) {
    return
  }

  clearFeedback()
  working.value = true

  try {
    await loadAuditLogs()
  } catch (error) {
    setError(error, '加载审计日志失败，请稍后重试。')
  } finally {
    working.value = false
  }
}

function onShareExpiryBlur() {
  shareExpiry.value = normalizeExpiryInput(shareExpiry.value)
}

async function bootstrap() {
  bootLoading.value = true

  try {
    const token = getAuthToken()
    if (!token) {
      return
    }

    authUser.value = await authApi.me()
    await loadOrganizations()
    await loadMembers()
    await loadAuditLogs()
  } catch {
    setAuthToken(null)
    authUser.value = null
  } finally {
    bootLoading.value = false
  }
}

watch(selectedOrganizationId, async () => {
  if (!authUser.value) {
    return
  }

  try {
    await loadMembers()
    await loadAuditLogs()
  } catch (error) {
    setError(error, '加载组织数据失败，请稍后重试。')
  }
})

watch([shareWorkspaceId, shareFileId], async () => {
  if (!authUser.value) {
    return
  }

  try {
    await loadShareLinks()
  } catch (error) {
    setError(error, '加载分享链接失败，请稍后重试。')
  }
})

onMounted(() => {
  void bootstrap()
})
</script>

<template>
  <section class="team-page" data-testid="team-page">
    <header class="team-page-head">
      <h2>团队协作</h2>
      <p>账号、组织、权限、分享与审计统一入口</p>
    </header>

    <p
      v-if="message"
      class="team-feedback success"
      data-testid="team-message"
    >
      {{ message }}
    </p>
    <p
      v-if="errorMessage"
      class="team-feedback error"
      data-testid="team-error"
    >
      {{ errorMessage }}
    </p>

    <div v-if="bootLoading" class="team-loading">加载中...</div>

    <template v-else-if="!authUser">
      <section class="team-card">
        <h3>账号登录</h3>
        <label>
          昵称
          <input
            data-testid="team-auth-name"
            v-model="authName"
            type="text"
            autocomplete="name"
            placeholder="请输入昵称"
          />
        </label>
        <label>
          邮箱
          <input
            data-testid="team-auth-email"
            v-model="authEmail"
            type="email"
            autocomplete="email"
            placeholder="请输入邮箱"
          />
        </label>
        <label>
          密码
          <input
            data-testid="team-auth-password"
            v-model="authPassword"
            type="password"
            autocomplete="current-password"
            placeholder="至少 8 位"
            @keydown.enter.prevent="register"
          />
        </label>
        <div class="team-inline-actions">
          <button
            data-testid="team-register"
            type="button"
            :disabled="!canSubmitAuth || working"
            @click="register"
          >
            注册并登录
          </button>
          <button
            data-testid="team-login"
            type="button"
            :disabled="working"
            @click="login"
          >
            登录
          </button>
        </div>
      </section>
    </template>

    <template v-else>
      <section class="team-card">
        <header class="team-card-head">
          <h3>组织管理</h3>
          <div class="team-inline-actions">
            <span class="team-user-email">{{ authUser.email }}</span>
            <button
              data-testid="team-logout"
              type="button"
              :disabled="working"
              @click="logout"
            >
              退出登录
            </button>
          </div>
        </header>

        <label>
          当前组织
          <select
            data-testid="team-org-select"
            v-model="selectedOrganizationId"
          >
            <option
              v-for="organization in organizations"
              :key="organization.id"
              :value="organization.id"
            >
              {{ organization.name }}（{{ organization.currentUserRole }}）
            </option>
          </select>
        </label>

        <div class="team-form-grid">
          <label>
            组织名称
            <input
              data-testid="team-org-name"
              v-model="organizationName"
              type="text"
              placeholder="例如：Team Alpha"
            />
          </label>
          <label>
            组织 slug
            <input
              data-testid="team-org-slug"
              v-model="organizationSlug"
              type="text"
              placeholder="例如：team-alpha"
              @blur="organizationSlug = normalizeSlug(organizationSlug)"
              @keydown.enter.prevent="createOrganization"
            />
          </label>
          <button
            data-testid="team-org-create"
            type="button"
            :disabled="!canCreateOrganization || working"
            @click="createOrganization"
          >
            创建组织
          </button>
        </div>
      </section>

      <section class="team-card">
        <h3>成员管理</h3>
        <p v-if="!currentOrganization()">请先创建或选择组织。</p>
        <template v-else>
          <div class="team-form-grid">
            <label>
              成员邮箱
              <input
                data-testid="team-member-email"
                v-model="inviteEmail"
                type="email"
                placeholder="member@example.com"
                @keydown.enter.prevent="addMember"
              />
            </label>
            <label>
              角色
              <select
                data-testid="team-member-role"
                v-model="inviteRole"
              >
                <option value="OWNER">OWNER</option>
                <option value="EDITOR">EDITOR</option>
                <option value="VIEWER">VIEWER</option>
              </select>
            </label>
            <button
              data-testid="team-member-add"
              type="button"
              :disabled="working || inviteEmail.trim().length === 0"
              @click="addMember"
            >
              添加成员
            </button>
          </div>

          <ul class="team-list">
            <li
              v-for="member in members"
              :key="member.id"
              data-testid="team-member-item"
            >
              <strong>{{ member.user.name }}</strong>
              <span>{{ member.user.email }}</span>
              <em>{{ member.role }}</em>
            </li>
          </ul>
        </template>
      </section>

      <section class="team-card">
        <h3>分享管理</h3>
        <div class="team-form-grid">
          <label>
            Workspace ID
            <input
              data-testid="team-share-workspace-id"
              v-model="shareWorkspaceId"
              type="text"
              placeholder="输入 workspace UUID"
            />
          </label>
          <label>
            File ID
            <input
              data-testid="team-share-file-id"
              v-model="shareFileId"
              type="text"
              placeholder="输入 file UUID"
              @keydown.enter.prevent="createShareLink"
            />
          </label>
          <label>
            可见性
            <select
              data-testid="team-share-visibility"
              v-model="shareVisibility"
            >
              <option value="PUBLIC">PUBLIC</option>
              <option value="TEAM">TEAM</option>
              <option value="PRIVATE">PRIVATE</option>
            </select>
          </label>
          <label>
            过期时间（可选）
            <input
              data-testid="team-share-expiry"
              v-model="shareExpiry"
              type="datetime-local"
              @blur="onShareExpiryBlur"
            />
          </label>
          <button
            data-testid="team-share-create"
            type="button"
            :disabled="!canCreateShareLink || working"
            @click="createShareLink"
          >
            创建分享链接
          </button>
        </div>

        <ul class="team-list">
          <li
            v-for="shareLink in shareLinks"
            :key="shareLink.id"
            data-testid="team-share-item"
          >
            <span>{{ shareLink.visibility }}</span>
            <code>{{ shareLink.token }}</code>
            <button
              data-testid="team-share-revoke"
              type="button"
              :disabled="working"
              @click="revokeShareLink(shareLink.id)"
            >
              撤销
            </button>
          </li>
        </ul>
      </section>

      <section class="team-card">
        <h3>审计日志</h3>
        <div class="team-inline-actions">
          <input
            data-testid="team-audit-action"
            v-model="auditAction"
            type="text"
            placeholder="按 action 过滤，例如 SHARE_LINK_CREATED"
            @keydown.enter.prevent="queryAuditLogs"
          />
          <button
            data-testid="team-audit-query"
            type="button"
            :disabled="working || !selectedOrganizationId"
            @click="queryAuditLogs"
          >
            查询
          </button>
        </div>

        <ul class="team-list">
          <li
            v-for="audit in auditLogs"
            :key="audit.id"
            data-testid="team-audit-item"
          >
            <strong>{{ audit.action }}</strong>
            <span>{{ audit.resourceType }} / {{ audit.resourceId }}</span>
          </li>
        </ul>
      </section>
    </template>
  </section>
</template>

<style scoped>
.team-page {
  box-sizing: border-box;
  display: grid;
  align-content: start;
  gap: 12px;
  width: min(1280px, 100%);
  height: 100%;
  min-height: 0;
  margin: 0 auto;
  padding: calc(var(--route-shell-content-top-inset, 0px) + 18px) 16px 16px;
  overflow: auto;
}

.team-page-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  border: 1px solid var(--theme-surface-row-border);
  border-radius: 14px;
  background: var(--theme-surface-glass-card-background);
  backdrop-filter: var(--theme-surface-overlay-blur);
  padding: 12px 14px;
}

.team-page-head h2 {
  margin: 0;
  font-size: 26px;
  line-height: 1.1;
  font-weight: 700;
  color: var(--theme-text-primary);
}

.team-page-head p {
  margin: 0;
  color: var(--theme-text-secondary);
  font-size: 13px;
  font-weight: 600;
}

.team-card {
  border: 1px solid var(--theme-surface-row-border);
  border-radius: 12px;
  padding: 10px 12px;
  display: grid;
  gap: 12px;
  background: var(--theme-surface-glass-card-background);
  backdrop-filter: var(--theme-surface-overlay-blur);
}

.team-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.team-card h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--theme-text-primary);
}

.team-card label {
  display: grid;
  gap: 4px;
  font-size: 12px;
  font-weight: 600;
  color: var(--theme-text-secondary);
}

.team-card input,
.team-card select {
  width: 100%;
  min-height: 34px;
  border-radius: 8px;
  border: 1px solid var(--theme-surface-input-border);
  background: var(--theme-surface-input-background);
  color: var(--theme-text-primary);
  padding: 0 10px;
  box-sizing: border-box;
}

.team-card button {
  border: 1px solid var(--theme-surface-neutral-button-border);
  border-radius: 8px;
  background: var(--theme-surface-neutral-button-background);
  color: var(--theme-text-primary);
  min-height: 34px;
  padding: 0 10px;
  cursor: pointer;
}

.team-card button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.team-form-grid {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  align-items: end;
}

.team-inline-actions {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}

.team-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 8px;
}

.team-list li {
  border: 1px solid var(--theme-surface-row-border);
  border-radius: 10px;
  padding: 8px 10px;
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}

.team-feedback {
  margin: 0;
  padding: 10px 12px;
  border-radius: 12px;
  font-size: 13px;
}

.team-feedback.success {
  background: rgba(20, 166, 132, 0.14);
  color: #06745d;
}

.team-feedback.error {
  background: rgba(225, 69, 69, 0.12);
  color: #a43030;
}

.team-loading {
  border: 1px solid var(--theme-surface-row-border);
  border-radius: 12px;
  background: var(--theme-surface-glass-card-background);
  backdrop-filter: var(--theme-surface-overlay-blur);
  padding: 12px;
  color: var(--theme-text-secondary);
}

.team-user-email {
  font-size: 12px;
  color: var(--theme-text-secondary);
}

@media (max-width: 900px) {
  .team-page {
    padding: calc(var(--route-shell-content-top-inset, 0px) + 14px) 12px 12px;
  }

  .team-page-head {
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
  }
}
</style>
