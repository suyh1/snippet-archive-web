import * as path from 'node:path'
import * as vscode from 'vscode'
import { SnippetArchiveClient, SnippetArchiveClientError } from './api/client'
import type { SearchSnippet, Workspace } from './api/types'
import { upsertSnippetToWorkspace } from './core/snippet-service'

const AUTH_TOKEN_SECRET_KEY = 'snippetArchive.accessToken'

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand('snippetArchive.signIn', async () => {
      await signIn(context)
    }),
    vscode.commands.registerCommand('snippetArchive.saveSnippet', async () => {
      await saveSnippet(context)
    }),
    vscode.commands.registerCommand('snippetArchive.searchAndInsert', async () => {
      await searchAndInsertSnippet(context)
    }),
    vscode.commands.registerCommand('snippetArchive.openWebSearch', async () => {
      await openWebSearch()
    }),
  )
}

export function deactivate() {
  // no-op
}

async function signIn(context: vscode.ExtensionContext) {
  const email = await vscode.window.showInputBox({
    title: 'Snippet Archive 登录',
    prompt: '请输入账号邮箱',
    ignoreFocusOut: true,
    placeHolder: 'you@example.com',
  })

  if (!email) {
    return
  }

  const password = await vscode.window.showInputBox({
    title: 'Snippet Archive 登录',
    prompt: '请输入密码',
    password: true,
    ignoreFocusOut: true,
  })

  if (!password) {
    return
  }

  const apiBaseUrl = getApiBaseUrl()
  const client = new SnippetArchiveClient(apiBaseUrl)

  try {
    const session = await client.login({ email: email.trim(), password })
    await context.secrets.store(AUTH_TOKEN_SECRET_KEY, session.accessToken)
    vscode.window.showInformationMessage(`Snippet Archive 登录成功：${session.user.email}`)
  } catch (error) {
    showError(error, '登录失败')
  }
}

async function saveSnippet(context: vscode.ExtensionContext) {
  const editor = vscode.window.activeTextEditor
  if (!editor) {
    vscode.window.showWarningMessage('请先打开一个可编辑文件')
    return
  }

  const content = editor.selection.isEmpty
    ? editor.document.getText()
    : editor.document.getText(editor.selection)

  if (content.trim().length === 0) {
    vscode.window.showWarningMessage('当前选区内容为空，无法保存片段')
    return
  }

  const client = await createAuthedClient(context)
  if (!client) {
    return
  }

  let workspaces: Workspace[]
  try {
    workspaces = await client.listWorkspaces()
  } catch (error) {
    showError(error, '加载工作区失败')
    return
  }

  if (workspaces.length === 0) {
    vscode.window.showWarningMessage('当前账号下没有可用工作区')
    return
  }

  const workspacePick = await vscode.window.showQuickPick(
    workspaces.map((workspace) => ({
      label: workspace.title,
      description: workspace.id,
      workspace,
    })),
    {
      title: '选择保存到的工作区',
      ignoreFocusOut: true,
    },
  )

  if (!workspacePick) {
    return
  }

  const documentName = path.basename(editor.document.fileName || '')
  const defaultName = inferDefaultName(documentName, editor.document.languageId)

  const name = await vscode.window.showInputBox({
    title: '片段名称',
    value: defaultName,
    prompt: '输入片段文件名',
    ignoreFocusOut: true,
  })

  if (!name || name.trim().length === 0) {
    return
  }

  const defaultPath = `snippets/${name.trim()}`
  const snippetPath = await vscode.window.showInputBox({
    title: '片段路径',
    value: defaultPath,
    prompt: '输入片段存储路径（工作区内）',
    ignoreFocusOut: true,
  })

  if (!snippetPath || snippetPath.trim().length === 0) {
    return
  }

  const tagsRaw = await vscode.window.showInputBox({
    title: '标签（可选）',
    prompt: '逗号分隔，例如 quick, api',
    ignoreFocusOut: true,
  })

  const tags =
    tagsRaw
      ?.split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0) ?? []

  try {
    await upsertSnippetToWorkspace(client, {
      workspaceId: workspacePick.workspace.id,
      name: name.trim(),
      path: snippetPath.trim(),
      language: editor.document.languageId,
      content,
      tags,
    })

    vscode.window.showInformationMessage(
      `片段已保存到 ${workspacePick.workspace.title}：${snippetPath.trim()}`,
    )
  } catch (error) {
    showError(error, '保存片段失败')
  }
}

async function searchAndInsertSnippet(context: vscode.ExtensionContext) {
  const editor = vscode.window.activeTextEditor
  if (!editor) {
    vscode.window.showWarningMessage('请先打开一个可编辑文件')
    return
  }

  const client = await createAuthedClient(context)
  if (!client) {
    return
  }

  const keyword = await vscode.window.showInputBox({
    title: '搜索片段',
    prompt: '输入关键词（可为空，默认返回最新片段）',
    ignoreFocusOut: true,
  })

  if (keyword === undefined) {
    return
  }

  let items: SearchSnippet[]
  try {
    const result = await client.searchSnippets({
      keyword: keyword.trim() || undefined,
      page: 1,
      pageSize: 20,
    })
    items = result.items
  } catch (error) {
    showError(error, '搜索片段失败')
    return
  }

  if (items.length === 0) {
    vscode.window.showInformationMessage('没有匹配的片段结果')
    return
  }

  const pick = await vscode.window.showQuickPick(
    items.map((item) => ({
      label: item.name,
      description: `${item.workspaceTitle} · ${item.path}`,
      detail: previewContent(item.content),
      snippet: item,
    })),
    {
      title: '选择要插入的片段',
      ignoreFocusOut: true,
    },
  )

  if (!pick) {
    return
  }

  await editor.edit((builder) => {
    builder.replace(editor.selection, pick.snippet.content)
  })

  vscode.window.showInformationMessage(`已插入片段：${pick.snippet.name}`)
}

async function openWebSearch() {
  const selectedText = vscode.window.activeTextEditor?.document
    .getText(vscode.window.activeTextEditor.selection)
    .trim()

  const keyword = selectedText && selectedText.length > 0
    ? selectedText
    : await vscode.window.showInputBox({
        title: '打开 Web 搜索',
        prompt: '输入关键词（可选）',
        ignoreFocusOut: true,
      })

  if (keyword === undefined) {
    return
  }

  const url = buildWebSearchUrl(getWebBaseUrl(), keyword.trim())
  await vscode.env.openExternal(vscode.Uri.parse(url))
}

function getApiBaseUrl() {
  const config = vscode.workspace.getConfiguration('snippetArchive')
  return String(config.get('apiBaseUrl') ?? 'http://127.0.0.1:3001/api')
}

function getWebBaseUrl() {
  const config = vscode.workspace.getConfiguration('snippetArchive')
  return String(config.get('webBaseUrl') ?? 'http://127.0.0.1:5173')
}

function inferDefaultName(fileName: string, languageId: string) {
  if (fileName && fileName.trim().length > 0 && fileName !== 'Untitled-1') {
    return fileName
  }

  const suffix = inferFileSuffix(languageId)
  return `snippet-${Date.now()}${suffix}`
}

function inferFileSuffix(languageId: string) {
  const known: Record<string, string> = {
    javascript: '.js',
    typescript: '.ts',
    json: '.json',
    markdown: '.md',
    html: '.html',
    css: '.css',
    shellscript: '.sh',
  }

  return known[languageId] ?? '.txt'
}

function buildWebSearchUrl(webBaseUrl: string, keyword: string) {
  const normalized = webBaseUrl.endsWith('/') ? webBaseUrl : `${webBaseUrl}/`
  const target = new URL('search', normalized)
  if (keyword) {
    target.searchParams.set('keyword', keyword)
  }

  return target.toString()
}

async function createAuthedClient(context: vscode.ExtensionContext) {
  const token = await context.secrets.get(AUTH_TOKEN_SECRET_KEY)
  if (!token) {
    const action = await vscode.window.showWarningMessage(
      '尚未登录 Snippet Archive，是否现在登录？',
      '立即登录',
    )

    if (action === '立即登录') {
      await signIn(context)
      const retryToken = await context.secrets.get(AUTH_TOKEN_SECRET_KEY)
      if (!retryToken) {
        return null
      }

      return new SnippetArchiveClient(getApiBaseUrl(), retryToken)
    }

    return null
  }

  return new SnippetArchiveClient(getApiBaseUrl(), token)
}

function previewContent(content: string) {
  const normalized = content.replace(/\s+/g, ' ').trim()
  if (normalized.length <= 100) {
    return normalized
  }

  return `${normalized.slice(0, 100)}...`
}

function showError(error: unknown, fallbackTitle: string) {
  if (error instanceof SnippetArchiveClientError) {
    vscode.window.showErrorMessage(
      `${fallbackTitle}（HTTP ${error.status}${error.code ? `/${error.code}` : ''}）：${error.message}`,
    )
    return
  }

  if (error instanceof Error) {
    vscode.window.showErrorMessage(`${fallbackTitle}：${error.message}`)
    return
  }

  vscode.window.showErrorMessage(fallbackTitle)
}
