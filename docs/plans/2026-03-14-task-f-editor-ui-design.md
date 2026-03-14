# Task F 设计文档（编辑器与交互增强）

## 1. 目标

在现有 Task C/D 基础上完成三项增强：

1. 文件编辑链路：文件可选中、可编辑、可保存到后端。
2. 文件管理入口：支持重命名与删除（文件夹删除走后端级联）。
3. 拖拽反馈优化：高亮有效目标、标记无效目标并给出提示。

## 2. 方案选择

已采用：`Store 驱动编辑状态 + FileTree 发事件 + App 统一交互`。

原因：

- 保持现有分层（API/Store/UI）一致，不引入额外状态源。
- FileTree 只负责视图与交互事件，业务逻辑集中在 Store。
- 可在最小改动中覆盖 Task F 全部目标。

## 3. 详细设计

### 3.1 编辑器保存

- `workspace.store` 新增：
  - `activeFileId`
  - `draftContent`
  - `dirty`
- 新增动作：
  - `selectFile(fileId)`
  - `setDraftContent(content)`
  - `saveCurrentFile()`（调用 `PATCH /files/:id`）

UI：
- App 在 Workspace 视图新增右侧编辑区（`textarea` 版，后续可替换 CodeMirror）。
- 仅文件（非 folder）可编辑。

### 3.2 重命名/删除入口

- FileTree 每行增加操作按钮：`重命名`、`删除`。
- App 处理 prompt/confirm。
- Store 新增动作：
  - `renameFile(fileId, newName)`（通过 move API 改路径）
  - `deleteFile(fileId)`（调用 delete file API，folder 自动级联）

### 3.3 拖拽反馈

- FileTree 维护拖拽状态：
  - `hoverTargetPath`
  - `invalidTargetPath`
  - `dropMessage`
- 行和根 dropzone 支持高亮样式：
  - 有效目标：蓝色高亮
  - 无效目标：红色高亮与提示文字

## 4. 测试策略

### 4.1 Store 测试

新增覆盖：
- `saveCurrentFile` 调用 update API。
- `renameFile` 调用 move API。
- `deleteFile` 清理选择状态。

### 4.2 组件测试

新增覆盖：
- FileTree 发出 `select-file` / `rename-file` / `delete-file` 事件。
- 无效拖拽不触发 move 并出现错误提示。

## 5. 非目标

- 不引入复杂编辑器插件。
- 不实现多文件并发编辑。
- 不改动后端接口语义（仅复用现有 move/update/delete）。
