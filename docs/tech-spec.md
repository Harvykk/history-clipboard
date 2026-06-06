# 技术规范 — 历史剪贴板

## 运行环境

| 项目 | 要求 |
|------|------|
| 操作系统 | Windows 10 (21H2+) / Windows 11 |
| 架构 | x64 |
| Node.js | 20.x LTS（Electron 33 内置） |
| 包管理器 | npm |

## 技术依赖

### 生产依赖
无外部生产依赖。使用 Node.js 内置 `fs` 模块读写 JSON 文件实现数据持久化。

### 开发依赖
| 包名 | 版本 | 用途 |
|------|------|------|
| electron | ^33.x | 桌面应用框架 |
| electron-builder | ^25.x | 打包为 Windows .exe |

## 数据存储设计

使用 JSON 文件存储，文件位于 Electron `userData` 目录下。

### 文件：clipboard-data.json
```json
{
  "items": [
    {
      "id": 1,
      "type": "text",
      "content": "复制的文本内容",
      "pinned": false,
      "createdAt": "2026-06-06T14:30:00.000Z",
      "expiresAt": "2026-06-09T14:30:00.000Z"
    },
    {
      "id": 2,
      "type": "image",
      "content": "assets\\images\\1717684200000.png",
      "pinned": true,
      "createdAt": "2026-06-06T14:32:00.000Z",
      "expiresAt": "2026-06-09T14:32:00.000Z"
    }
  ],
  "settings": {
    "retentionDays": 3
  },
  "nextId": 3
}
```

### 字段说明
| 字段 | 类型 | 说明 |
|------|------|------|
| id | number | 自增唯一 ID |
| type | "text" \| "image" | 内容类型 |
| content | string | 文本内容或图片文件路径 |
| pinned | boolean | 是否置顶 |
| createdAt | string (ISO 8601) | 复制时间 |
| expiresAt | string (ISO 8601) | 过期时间 |

### 读写策略
- 启动时一次性加载整个 JSON 到内存
- 每次增/删/改操作后全量写回文件（数据量 < 1000 条，性能足够）
- 图片文件存储在 `assets/images/` 目录

## API 设计（Preload 桥接暴露）

```js
// 渲染进程可调用的 API
window.clipboardAPI = {
  // 获取历史列表（含置顶排序、过期过滤）
  getHistory(searchQuery?: string): Promise<ClipboardItem[]>,
  
  // 置顶/取消置顶
  togglePin(id: number): Promise<void>,
  
  // 删除记录
  deleteItem(id: number): Promise<void>,
  
  // 复制回剪贴板
  copyToClipboard(id: number): Promise<void>,
  
  // 获取/设置留存天数
  getRetentionDays(): Promise<number>,
  setRetentionDays(days: number): Promise<void>,
  
  // 监听剪贴板更新（主进程 → 渲染进程推送）
  onClipboardUpdate(callback: (item: ClipboardItem) => void): void,
};
```

## 剪贴板轮询策略
- 间隔：500ms
- 数据源：`electron.clipboard.readText()` / `readImage()`
- 图片处理：`toPNG()` → `fs.writeFileSync()` → 路径存库
- 去重：hash 文本内容，与上次对比

## 安全策略
- `contextIsolation: true`
- `nodeIntegration: false`
- 所有系统操作通过 preload 暴露的有限 API
- 不使用 `remote` 模块
