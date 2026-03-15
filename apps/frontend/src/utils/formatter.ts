import { normalizeLanguage } from './language-detect'

type FormatterInput = {
  language: string
  content: string
}

export type FormatterResult = {
  ok: boolean
  content: string
  reason?: 'unsupported' | 'error'
  errorMessage?: string
}

type LoadedPrettierModules = {
  prettier: typeof import('prettier/standalone')
  babelPlugin: typeof import('prettier/plugins/babel')
  estreePlugin: typeof import('prettier/plugins/estree')
  htmlPlugin: typeof import('prettier/plugins/html')
  markdownPlugin: typeof import('prettier/plugins/markdown')
  typescriptPlugin: typeof import('prettier/plugins/typescript')
}

let prettierModulesPromise: Promise<LoadedPrettierModules> | null = null

function loadPrettierModules() {
  if (!prettierModulesPromise) {
    prettierModulesPromise = Promise.all([
      import('prettier/standalone'),
      import('prettier/plugins/babel'),
      import('prettier/plugins/estree'),
      import('prettier/plugins/html'),
      import('prettier/plugins/markdown'),
      import('prettier/plugins/typescript'),
    ]).then(
      ([
        prettier,
        babelPlugin,
        estreePlugin,
        htmlPlugin,
        markdownPlugin,
        typescriptPlugin,
      ]) => {
        return {
          prettier,
          babelPlugin,
          estreePlugin,
          htmlPlugin,
          markdownPlugin,
          typescriptPlugin,
        }
      },
    )
  }

  return prettierModulesPromise
}

function resolveParser(language: string) {
  if (language === 'typescript') {
    return 'typescript'
  }
  if (language === 'javascript') {
    return 'babel'
  }
  if (language === 'json') {
    return 'json'
  }
  if (language === 'markdown') {
    return 'markdown'
  }
  if (language === 'html') {
    return 'html'
  }
  if (language === 'vue') {
    return 'vue'
  }
  return null
}

export async function formatSnippetContent(input: FormatterInput): Promise<FormatterResult> {
  const normalizedLanguage = normalizeLanguage(input.language)
  const parser = resolveParser(normalizedLanguage)
  if (!parser) {
    return {
      ok: false,
      reason: 'unsupported',
      content: input.content,
    }
  }

  try {
    const {
      prettier,
      babelPlugin,
      estreePlugin,
      htmlPlugin,
      markdownPlugin,
      typescriptPlugin,
    } = await loadPrettierModules()

    const content = await prettier.format(input.content, {
      parser,
      plugins: [
        babelPlugin,
        estreePlugin,
        htmlPlugin,
        markdownPlugin,
        typescriptPlugin,
      ],
      semi: false,
      singleQuote: true,
    })

    return {
      ok: true,
      content,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : '格式化失败'
    return {
      ok: false,
      reason: 'error',
      content: input.content,
      errorMessage: message,
    }
  }
}
