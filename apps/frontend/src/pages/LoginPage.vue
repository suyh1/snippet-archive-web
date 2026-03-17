<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { authApi } from '@/api/auth'
import { resolveWorkspaceErrorMessage } from '@/utils/error-message'

type AuthMode = 'login' | 'register'

const route = useRoute()
const router = useRouter()

const mode = ref<AuthMode>('login')
const loading = ref(false)
const name = ref('')
const email = ref('')
const password = ref('')
const feedbackMessage = ref('')
const errorMessage = ref('')

const canLogin = computed(() => {
  return email.value.trim().length > 0 && password.value.trim().length >= 8
})

const canRegister = computed(() => {
  return (
    name.value.trim().length > 0 &&
    email.value.trim().length > 0 &&
    password.value.trim().length >= 8
  )
})

const registerDisabledReason = computed(() => {
  if (!name.value.trim()) {
    return '请输入昵称。'
  }

  if (!email.value.trim()) {
    return '请输入邮箱。'
  }

  if (password.value.trim().length < 8) {
    return '密码至少 8 位。'
  }

  if (loading.value) {
    return '正在提交，请稍候。'
  }

  return ''
})

function clearFeedback() {
  feedbackMessage.value = ''
  errorMessage.value = ''
}

function resolveRedirectTarget() {
  const redirect = route.query.redirect
  if (typeof redirect !== 'string' || !redirect.startsWith('/')) {
    return '/workspace'
  }

  return redirect === '/login' ? '/workspace' : redirect
}

function showLoginValidationError() {
  if (!email.value.trim()) {
    errorMessage.value = '请输入邮箱。'
    return
  }

  if (password.value.trim().length < 8) {
    errorMessage.value = '密码至少 8 位。'
    return
  }
}

function showRegisterValidationError() {
  errorMessage.value = registerDisabledReason.value || '请完善注册信息。'
}

async function submitLogin() {
  if (loading.value) {
    return
  }

  clearFeedback()
  if (!canLogin.value) {
    showLoginValidationError()
    return
  }

  loading.value = true
  try {
    await authApi.login({
      email: email.value.trim(),
      password: password.value,
    })
    feedbackMessage.value = '登录成功。'
    await router.replace(resolveRedirectTarget())
  } catch (error) {
    errorMessage.value = resolveWorkspaceErrorMessage(error, '登录失败，请稍后重试。')
  } finally {
    loading.value = false
  }
}

async function submitRegister() {
  if (loading.value) {
    return
  }

  clearFeedback()
  if (!canRegister.value) {
    showRegisterValidationError()
    return
  }

  loading.value = true
  try {
    await authApi.register({
      email: email.value.trim(),
      name: name.value.trim(),
      password: password.value,
    })
    feedbackMessage.value = '注册成功，正在进入工作区。'
    await router.replace(resolveRedirectTarget())
  } catch (error) {
    errorMessage.value = resolveWorkspaceErrorMessage(error, '注册失败，请稍后重试。')
  } finally {
    loading.value = false
  }
}

function onPasswordEnter() {
  if (mode.value === 'register') {
    void submitRegister()
    return
  }

  void submitLogin()
}
</script>

<template>
  <main class="login-page" data-testid="login-page">
    <section class="login-card">
      <header class="login-head">
        <p class="eyebrow">Snippet Archive</p>
        <h1>账号登录</h1>
        <p>登录后访问你的工作区、搜索、收藏与团队协作页面。</p>
      </header>

      <div class="mode-switch" role="tablist" aria-label="登录模式">
        <button
          type="button"
          data-testid="login-mode-login"
          :aria-selected="mode === 'login'"
          @click="mode = 'login'"
        >
          登录
        </button>
        <button
          type="button"
          data-testid="login-mode-register"
          :aria-selected="mode === 'register'"
          @click="mode = 'register'"
        >
          注册
        </button>
      </div>

      <p v-if="feedbackMessage" class="feedback success">{{ feedbackMessage }}</p>
      <p v-if="errorMessage" class="feedback error" data-testid="login-error">{{ errorMessage }}</p>

      <form class="login-form" @submit.prevent="mode === 'register' ? submitRegister() : submitLogin()">
        <label v-if="mode === 'register'">
          昵称
          <input
            v-model="name"
            data-testid="login-name"
            type="text"
            autocomplete="name"
            placeholder="请输入昵称"
            :disabled="loading"
          >
        </label>

        <label>
          邮箱
          <input
            v-model="email"
            data-testid="login-email"
            type="email"
            autocomplete="email"
            placeholder="请输入邮箱"
            :disabled="loading"
          >
        </label>

        <label>
          密码
          <input
            v-model="password"
            data-testid="login-password"
            type="password"
            autocomplete="current-password"
            placeholder="至少 8 位"
            :disabled="loading"
            @keydown.enter.prevent="onPasswordEnter"
          >
        </label>

        <button
          v-if="mode === 'register'"
          type="button"
          data-testid="register-submit"
          :disabled="!canRegister || loading"
          @click="submitRegister"
        >
          {{ loading ? '注册中...' : '注册并登录' }}
        </button>
        <button
          v-else
          type="button"
          data-testid="login-submit"
          :disabled="loading"
          @click="submitLogin"
        >
          {{ loading ? '登录中...' : '登录' }}
        </button>
      </form>

      <p
        v-if="mode === 'register' && (!canRegister || loading)"
        class="disabled-reason"
        data-testid="register-disabled-reason"
      >
        {{ registerDisabledReason }}
      </p>
    </section>
  </main>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 20px;
  background: radial-gradient(circle at 12% 12%, rgba(14, 165, 233, 0.18), transparent 38%),
    radial-gradient(circle at 88% 86%, rgba(34, 197, 94, 0.16), transparent 42%),
    var(--theme-layout-app-shell-background);
}

.login-card {
  width: min(460px, 100%);
  border: 1px solid var(--theme-surface-row-border);
  border-radius: 16px;
  background: var(--theme-surface-glass-card-background);
  backdrop-filter: var(--theme-surface-overlay-blur);
  box-shadow: var(--theme-surface-glass-panel-shadow);
  padding: 18px 18px 16px;
  display: grid;
  gap: 12px;
}

.login-head h1 {
  margin: 2px 0 6px;
  color: var(--theme-text-primary);
  font-size: 24px;
}

.login-head p {
  margin: 0;
  color: var(--theme-text-secondary);
}

.eyebrow {
  margin: 0;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--theme-text-tertiary);
}

.mode-switch {
  display: inline-flex;
  gap: 8px;
}

.mode-switch button {
  border: 1px solid var(--theme-surface-neutral-button-border);
  background: var(--theme-surface-neutral-button-background);
  color: var(--theme-text-secondary);
  border-radius: 999px;
  padding: 6px 12px;
  cursor: pointer;
}

.mode-switch button[aria-selected='true'] {
  border-color: var(--theme-accent-selected-border);
  background: var(--theme-surface-row-active-background);
  color: var(--theme-accent-selected-text);
}

.login-form {
  display: grid;
  gap: 10px;
}

.login-form label {
  display: grid;
  gap: 4px;
  color: var(--theme-text-secondary);
  font-size: 12px;
  font-weight: 600;
}

.login-form input {
  border: 1px solid var(--theme-surface-input-border);
  background: var(--theme-surface-input-background);
  color: var(--theme-text-primary);
  border-radius: 8px;
  padding: 8px 10px;
  min-height: 36px;
}

.login-form button {
  border: 1px solid var(--theme-accent-primary-button-border);
  background: var(--theme-accent-primary-button-gradient);
  color: var(--theme-accent-primary-button-text);
  border-radius: 8px;
  padding: 8px 12px;
  cursor: pointer;
  min-height: 36px;
}

.login-form button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.feedback {
  margin: 0;
  font-size: 13px;
}

.feedback.success {
  color: var(--theme-accent-selected-text);
}

.feedback.error {
  color: var(--theme-text-danger-strong);
}

.disabled-reason {
  margin: 0;
  font-size: 12px;
  color: var(--theme-text-tertiary);
}
</style>
