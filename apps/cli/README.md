# Snippet Archive CLI (Thread J PoC)

阶段三线程 J 的首版 CLI，目标覆盖：

1. 片段检索（`search`）
2. 导出协议（`export`）
3. 导入协议（`import` / `sync`）
4. CI 可用的批量同步入口（`sync --input`）

## Commands

```bash
snippet-archive login --email you@example.com --password '***'
snippet-archive search --keyword auth --json
snippet-archive export --output ./snippet-bundle.json
snippet-archive import --input ./snippet-bundle.json
snippet-archive sync --input ./snippet-bundle.json --dry-run
```

## Auth

- 优先级：`--token` > `SNIPPET_ARCHIVE_TOKEN` > `~/.snippet-archive-cli/config.json`
- `login` 会写入本地 config，后续命令可直接复用 token。

## Config

- `--api-base-url` 或环境变量 `SNIPPET_ARCHIVE_API_BASE_URL`
- 默认：`http://127.0.0.1:3001/api`

## Bundle Schema

- 版本：`snippet-archive-bundle/v1`
- Schema 文件：`docs/schemas/snippet-bundle.v1.schema.json`

## Development

```bash
npm install
npm run test
npm run build
```

