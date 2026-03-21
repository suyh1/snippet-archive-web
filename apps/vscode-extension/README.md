# Snippet Archive VS Code Extension (PoC)

阶段三线程 I 的最小可用插件原型，目标是打通：

1. 登录 Snippet Archive
2. 保存当前选区/全文为片段
3. 搜索并插入片段
4. 从 VS Code 跳转到 Web 搜索页

## Commands

- `Snippet Archive: Sign In`
- `Snippet Archive: Save Snippet`
- `Snippet Archive: Search and Insert Snippet`
- `Snippet Archive: Open Web Search`

## Settings

- `snippetArchive.apiBaseUrl`（默认 `http://127.0.0.1:3001/api`）
- `snippetArchive.webBaseUrl`（默认 `http://127.0.0.1:5173`）

## Development

```bash
npm install
npm run test
npm run build
```
