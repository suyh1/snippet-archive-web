# 主题编写教程（Glass Theme File v1）

本项目的全局主题文件使用模块化 JSON 结构，目标是让用户能直接读懂并改写。

## 1. 文件结构

```json
{
  "schemaVersion": 1,
  "meta": {
    "id": "your-theme-id",
    "name": "Your Theme Name",
    "version": "1.0.0",
    "author": "Your Name",
    "description": "Theme description"
  },
  "modules": {
    "layout": {},
    "text": {},
    "surface": {},
    "accent": {},
    "danger": {}
  }
}
```

- `schemaVersion`：当前必须是 `1`。
- `meta`：主题元信息，`id` 与 `name` 必填。
- `modules`：主题 token 分组，所有分组都必须存在。

## 2. 模块职责

- `layout`：页面级布局外观（字体、主背景、侧栏背景等）
- `text`：文本颜色（主文本、次文本、强调、危险态）
- `surface`：卡片、面板、输入框、遮罩、列表行等表面样式
- `accent`：主品牌色按钮、选中态、焦点态、侧栏主按钮
- `danger`：危险操作颜色（删除、报错、强提醒）

## 3. 起步方式（推荐）

1. 在设置页「常规」点击“导出主题文件”。
2. 复制该文件并修改 `meta.id` / `meta.name`。
3. 小步修改 `modules` 中的 token 值（优先改 `layout.appShellBackground`、`accent.primaryButtonGradient`）。
4. 回到设置页点击“导入主题文件”验证效果。

## 3.1 系统预置主题

当前内置 9 套可随时切换（设置页「常规」）：

1. `glass-gradient`（默认）
2. `nordic-fog`
3. `graphite-pro`
4. `tokyo-neon`
5. `paper-ink`
6. `forest-glass`
7. `sunset-ui`
8. `mono-minimal`
9. `aurora-night`

## 4. 常见 token 示例

```json
{
  "modules": {
    "layout": {
      "appShellBackground": "linear-gradient(160deg, #fff7ed 0%, #fed7aa 52%, #fdba74 100%)"
    },
    "accent": {
      "primaryButtonGradient": "linear-gradient(130deg, #f97316, #fb7185)"
    },
    "danger": {
      "strongGradient": "linear-gradient(135deg, #dc2626, #f87171)"
    }
  }
}
```

## 5. 编写约束

- 每个 token 值必须是非空字符串。
- 建议颜色统一用 `#hex` 或 `rgba(...)`。
- 渐变建议使用 `linear-gradient(...)` 或 `radial-gradient(...)`。
- 模糊效果 token 直接写 CSS 值，例如 `blur(8px)`。

## 6. 排错

- 导入失败提示 “版本不匹配”：检查 `schemaVersion` 是否为 `1`。
- 导入失败提示 “缺少模块/token”：用导出文件对照补全字段。
- 导入后视觉无变化：确认改的是已被界面使用的 token（优先改 `layout`、`surface.glassPanelBackground`）。

## 7. 参考模板

默认模板文件：`apps/frontend/src/themes/glass-gradient.theme.json`
