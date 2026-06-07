# 历史剪贴板 📋

> Windows 桌面历史剪贴板管理工具 — 自动记录复制内容，卡片式展示，搜索/置顶/删除，支持文字和图片。

[![Electron](https://img.shields.io/badge/Electron-28-blue)](https://www.electronjs.org/)
[![Platform](https://img.shields.io/badge/Windows-10%2F11-brightgreen)](#)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

## 功能

- 📋 **自动记录** — 后台监听系统剪贴板，复制任何文字或图片自动保存
- 🔍 **搜索过滤** — 支持关键字实时搜索历史记录
- 📌 **置顶** — 重要内容置顶，始终显示在列表最顶部
- 🗑 **删除管理** — 删除不需要的记录，自动清理关联图片
- ⏱ **自动过期** — 可设 1/3/5 天留存期限，到期自动清理
- 🔽 **系统托盘** — 关窗隐藏到托盘，后台持续运行
- ⌨ **全局快捷键** — `Ctrl+Shift+V` 随时随地呼出窗口
- 🖼 **文字+图片** — 支持文本和图片两种剪贴板内容

## 安装运行

### 开发模式

```bash
# 克隆仓库
git clone https://github.com/Harvykk/history-clipboard.git
cd history-clipboard

# 安装依赖
npm install

# 启动应用
npm start
```

### 发布版

运行 `dist/历史剪贴板/历史剪贴板.exe` 即可启动。

> 首次使用建议将整个 `dist/历史剪贴板/` 文件夹复制到固定位置（如 `C:\Program Files\历史剪贴板\`），然后运行 `install.ps1` 创建快捷方式。

## 技术栈

| 技术 | 说明 |
|------|------|
| Electron 28 | 桌面应用框架 |
| JavaScript | 主进程 + 预加载 + 渲染进程 |
| JSON 文件 | 本地数据存储 |
| better-sqlite3 | ~~SQLite~~ → JSON（去掉原生编译依赖） |

## 项目结构

```
history-clipboard/
├── main.js              # Electron 主进程
├── preload.js           # 安全桥接 (contextBridge)
├── start.js             # 启动脚本
├── renderer/            # 渲染进程 UI
│   ├── index.html
│   ├── style.css
│   └── app.js
├── db/database.js       # JSON 数据存储模块
├── clipboard/watcher.js # 剪贴板监听模块
├── assets/              # 图标资源
├── docs/                # 项目文档
└── dev-logs/            # 开发日志
```

## 开发进度

- [x] 阶段 0：项目骨架搭建
- [x] 阶段 1：数据库模块（CRUD + 过期清理）
- [x] 阶段 2：剪贴板监听（文本/图片检测）
- [x] 阶段 3：主进程功能（托盘/快捷键/自启）
- [x] 阶段 4：Preload 桥接（IPC API）
- [x] 阶段 5：渲染进程 UI（搜索/置顶/删除）
- [x] 阶段 6：打包

## License

MIT
