import { describe, expect, it } from 'vitest'
import { ApiClientError } from '@/api/http'
import { resolveWorkspaceErrorMessage } from './error-message'

describe('resolveWorkspaceErrorMessage', () => {
  it('maps CONFLICT error code to friendly message', () => {
    const error = new ApiClientError(409, 'Path already exists', 'CONFLICT')

    expect(resolveWorkspaceErrorMessage(error, '操作失败，请重试。')).toBe(
      '名称或路径已存在，请修改后重试。',
    )
  })

  it('uses fallback message for non-api errors', () => {
    expect(resolveWorkspaceErrorMessage(new Error('boom'), '加载失败，请稍后重试。')).toBe(
      '加载失败，请稍后重试。',
    )
  })
})
