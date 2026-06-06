# CLAUDE.md — 历史剪贴板项目 AI 助手工作指引

## 项目简介
Windows 历史剪贴板管理工具，基于 Electron 开发。监听用户复制操作，以卡片形式展示历史记录（文字+图片），支持搜索、置顶、删除和自动过期清理。

## 文档索引

| 文档 | 路径 | 说明 |
|------|------|------|
| 功能需求 | [docs/requirements.md](docs/requirements.md) | 完整功能需求详述 |
| 技术规范 | [docs/tech-spec.md](docs/tech-spec.md) | 技术选型、版本、依赖 |
| 设计规范 | [docs/design-spec.md](docs/design-spec.md) | UI 颜色、布局、交互行为 |
| 架构设计 | [docs/architecture.md](docs/architecture.md) | 模块关系与数据流 |
| 执行步骤 | [docs/execution-steps.md](docs/execution-steps.md) | 分步执行计划与验证标准 |

## 开发日志

每次开发结束后，在 `dev-logs/` 目录下写入当日日志：
- 文件名格式：`YYYY-MM-DD.md`
- 内容模板：
  ```
  # 开发日志 — YYYY-MM-DD
  ## 完成事项
  - [x] 事项 1
  - [x] 事项 2
  ## 待办事项
  - [ ] 待办 1
  - [ ] 待办 2
  ## 备注
  （遇到的问题、决策记录等）
  ```

## 项目结构
```
├── CLAUDE.md              ← 本文件
├── docs/                  ← 项目标准文档
├── dev-logs/              ← 开发日志
├── main.js                ← Electron 主进程
├── preload.js             ← contextBridge 桥接
├── renderer/              ← 渲染进程 (HTML/CSS/JS)
├── db/                    ← 数据库模块
├── clipboard/             ← 剪贴板监听
├── assets/                ← 图标、图片存储
└── package.json
```

## 开发原则
- **小步推进**：每阶段只做一件事，做完验证再进入下一步
- **每步可验证**：完成后必须能通过验证
- **文档先行**：先更新/确认 docs 文档，再写代码
- **日志必写**：每次开发结束必须写入 dev-logs
- **代码清晰**：变量命名有意义、关键逻辑加注释

## 技术约束
- 平台：Windows 10/11
- 运行时：Electron 33.x + Node.js
- 数据库：better-sqlite3（同步 API，在主进程使用）
- 安全：contextIsolation: true, nodeIntegration: false
- 所有数据库和剪贴板操作在主进程完成，渲染进程通过 preload 暴露的 API 通信
