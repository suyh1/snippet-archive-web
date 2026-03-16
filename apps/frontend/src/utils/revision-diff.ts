export type UnifiedDiffRowType = 'context' | 'removed' | 'added'

export type UnifiedDiffRow = {
  type: UnifiedDiffRowType
  text: string
  oldLine: number | null
  newLine: number | null
}

function splitLines(input: string) {
  return input.replace(/\r\n?/g, '\n').split('\n')
}

export function buildUnifiedLineDiff(before: string, after: string): UnifiedDiffRow[] {
  const beforeLines = splitLines(before)
  const afterLines = splitLines(after)

  const n = beforeLines.length
  const m = afterLines.length

  const lcs = Array.from({ length: n + 1 }, () => Array<number>(m + 1).fill(0))

  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      if (beforeLines[i] === afterLines[j]) {
        lcs[i][j] = lcs[i + 1][j + 1] + 1
      } else {
        lcs[i][j] = Math.max(lcs[i + 1][j], lcs[i][j + 1])
      }
    }
  }

  const rows: UnifiedDiffRow[] = []
  let i = 0
  let j = 0
  let oldLine = 1
  let newLine = 1

  while (i < n && j < m) {
    if (beforeLines[i] === afterLines[j]) {
      rows.push({
        type: 'context',
        text: beforeLines[i] ?? '',
        oldLine,
        newLine,
      })
      i += 1
      j += 1
      oldLine += 1
      newLine += 1
      continue
    }

    if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      rows.push({
        type: 'removed',
        text: beforeLines[i] ?? '',
        oldLine,
        newLine: null,
      })
      i += 1
      oldLine += 1
      continue
    }

    rows.push({
      type: 'added',
      text: afterLines[j] ?? '',
      oldLine: null,
      newLine,
    })
    j += 1
    newLine += 1
  }

  while (i < n) {
    rows.push({
      type: 'removed',
      text: beforeLines[i] ?? '',
      oldLine,
      newLine: null,
    })
    i += 1
    oldLine += 1
  }

  while (j < m) {
    rows.push({
      type: 'added',
      text: afterLines[j] ?? '',
      oldLine: null,
      newLine,
    })
    j += 1
    newLine += 1
  }

  return rows
}
