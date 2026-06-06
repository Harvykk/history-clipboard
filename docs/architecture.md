# 架构设计 — 历史剪贴板

## 整体架构

```
┌─────────────────────────────────────────────────────┐
│                    Main Process                      │
│  (main.js)                                           │
│                                                      │
│  ┌──────────────┐  ┌────────────┐  ┌─────────────┐  │
│  │  Clipboard   │  │  Database  │  │    Tray      │  │
│  │  Watcher     │──│  (SQLite)  │  │  Manager     │  │
│  │  (500ms 轮询) │  │            │  │              │  │
│  └──────┬───────┘  └─────┬──────┘  └──────┬──────┘  │
│         │                │                │          │
│         └────────────────┼────────────────┘          │
│                          │                           │
│                   ┌──────┴──────┐                    │
│                   │  IPC Bridge │                    │
│                   │ (ipcMain)   │                    │
│                   └──────┬──────┘                    │
└──────────────────────────┼───────────────────────────┘
                           │ contextBridge
┌──────────────────────────┼───────────────────────────┐
│              Renderer Process (preload.js)            │
│                          │                            │
│                   ┌──────┴──────┐                    │
│                   │  Preload    │                    │
│                   │  API        │                    │
│                   └──────┬──────┘                    │
│                          │                           │
│              ┌───────────┼───────────┐               │
│              │           │           │               │
│         ┌────┴────┐ ┌───┴───┐ ┌────┴────┐          │
│         │  HTML   │ │  CSS  │ │   JS    │          │
│         │ (结构)  │ │(样式) │ │ (逻辑)  │          │
│         └─────────┘ └───────┘ └─────────┘          │
└─────────────────────────────────────────────────────┘
```

## 模块职责

### 主进程 (main.js)
- 应用生命周期管理（启动、退出）
- 创建/管理 BrowserWindow
- 启动各子系统（剪贴板监听、托盘）
- 注册 IPC 处理器

### 剪贴板监听 (clipboard/watcher.js)
- 定时轮询系统剪贴板
- 检测内容变化（文本 hash 对比）
- 读取文本/图片数据
- 图片写入本地文件
- 新数据写入数据库
- 通过 IPC 推送更新通知给渲染进程

### 数据库 (db/database.js)
- 初始化：从 JSON 文件加载数据到内存
- CRUD 操作：插入记录、查询列表、置顶切换、删除
- 过期清理：删除 expiresAt < now 的非置顶记录
- 搜索：内存中 filter 文本内容
- 设置读写：留存天数
- 每次写操作后自动保存到 JSON 文件

### 系统托盘 (main.js 内)
- 创建托盘图标
- 右键菜单
- 双击事件
- 窗口关闭拦截

### Preload 桥接 (preload.js)
- contextBridge.exposeInMainWorld 暴露 API
- 所有通信通过 ipcRenderer.invoke

### 渲染进程 (renderer/*)
- HTML：页面结构
- CSS：样式、动画
- JS：调用 preload API、渲染列表、处理用户交互

## 数据流

```
用户 Ctrl+C 复制
       │
       ▼
[系统剪贴板]
       │ 500ms 轮询
       ▼
[Clipboard Watcher] ──检测变化──→ [Database] ──写入──→ clipboard_items 表
       │                                      │
       │ IPC push                             │ IPC invoke
       ▼                                      ▼
[Renderer] ◄── 新记录通知 ────────────── [Renderer] 查询列表
       │
       ▼
[UI 更新：新卡片出现在列表顶部]
```

## 文件依赖关系

```
main.js
  ├── clipboard/watcher.js  (无外部依赖)
  ├── db/database.js        (依赖 better-sqlite3)
  ├── preload.js            (无外部依赖)
  └── electron 内置模块
      ├── clipboard
      ├── Tray
      ├── globalShortcut
      └── BrowserWindow

renderer/app.js
  └── window.clipboardAPI  (由 preload.js 暴露)
```
