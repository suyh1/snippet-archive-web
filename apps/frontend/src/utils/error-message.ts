import { ApiClientError, type ApiErrorCode } from '@/api/http'

const ERROR_MESSAGE_MAP: Record<ApiErrorCode, string> = {
  VALIDATION_ERROR: '输入内容不合法，请检查后重试。',
  UNAUTHORIZED: '请先登录后再执行该操作。',
  FORBIDDEN: '你没有权限执行该操作。',
  NOT_FOUND: '目标不存在，可能已被删除，请刷新后重试。',
  CONFLICT: '名称或路径已存在，请修改后重试。',
  GONE: '该分享链接已失效或被撤销。',
  INTERNAL_ERROR: '服务暂时不可用，请稍后重试。',
}

export function resolveWorkspaceErrorMessage(error: unknown, fallbackMessage: string) {
  if (error instanceof ApiClientError && error.code) {
    return ERROR_MESSAGE_MAP[error.code] ?? fallbackMessage
  }

  return fallbackMessage
}
