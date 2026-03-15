const MAX_RENAME_LENGTH = 120

export function validateRenameInput(value: string, siblingNames: string[]) {
  if (!value) {
    return '名称不能为空。'
  }

  if (value !== value.trim()) {
    return '名称不能包含首尾空格。'
  }

  if (value.includes('/')) {
    return '名称不能包含 "/"。'
  }

  if (value === '.' || value === '..') {
    return '名称不能为 "." 或 ".."。'
  }

  if (value.length > MAX_RENAME_LENGTH) {
    return '名称长度不能超过 120 个字符。'
  }

  if (siblingNames.includes(value)) {
    return '同级目录下已存在同名项。'
  }

  return null
}
