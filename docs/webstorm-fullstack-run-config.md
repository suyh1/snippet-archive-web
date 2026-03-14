# WebStorm 全栈运行配置清单

适用项目目录:

- `/Users/subeipo/Documents/code/utools/snippet-archive-web`

## 1. 前置准备

1. 用 WebStorm 打开项目根目录:
`/Users/subeipo/Documents/code/utools/snippet-archive-web`
2. 确认 Docker Desktop 已启动。
3. 确认 Node 版本可用（建议 LTS）。

## 2. 推荐运行配置

在 WebStorm 顶部 `Run | Edit Configurations...` 中新增以下配置。

### 配置 A: `DB Up`

- 类型: `Shell Script`
- Name: `DB Up`
- Script text: `docker compose up -d`
- Working directory:
`/Users/subeipo/Documents/code/utools/snippet-archive-web`

用途:

- 启动 PostgreSQL 容器（`snippet_archive_postgres`）。

### 配置 B: `Backend Dev`

- 类型: `npm`
- Name: `Backend Dev`
- Package.json:
`/Users/subeipo/Documents/code/utools/snippet-archive-web/package.json`
- Command: `run`
- Scripts: `dev:backend`

### 配置 C: `Frontend Dev`

- 类型: `npm`
- Name: `Frontend Dev`
- Package.json:
`/Users/subeipo/Documents/code/utools/snippet-archive-web/package.json`
- Command: `run`
- Scripts: `dev:frontend`

### 配置 D: `Dev Fullstack`

- 类型: `Compound`
- Name: `Dev Fullstack`
- Add configurations:
1. `Backend Dev`
2. `Frontend Dev`

说明:

- `Compound` 用于并行启动前后端。
- 数据库建议先单独执行一次 `DB Up`。

## 3. 推荐启动顺序

1. 先运行 `DB Up`（只需执行一次，容器会常驻）。
2. 再运行 `Dev Fullstack`。

启动成功后:

- 前端: `http://localhost:5173`
- 后端: `http://localhost:3001/health`
- 数据库: `localhost:54329`

## 4. 可选补充配置

### 配置 E: `DB Down`

- 类型: `Shell Script`
- Name: `DB Down`
- Script text: `docker compose down`
- Working directory:
`/Users/subeipo/Documents/code/utools/snippet-archive-web`

用途:

- 结束当天开发时关闭数据库容器。

## 5. 常见问题

1. `docker compose` 找不到:
确认 Docker Desktop 已启动，并在终端执行 `docker compose version`。
2. 后端启动失败且提示数据库连接错误:
先执行 `DB Up`，再执行 `Backend Dev`。
3. 端口冲突:
- 前端改 `Vite` 端口（`apps/frontend`）
- 后端改 `apps/backend/.env` 中 `PORT`

