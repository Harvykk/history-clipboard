// 历史剪贴板 - Electron 主进程
const { app, BrowserWindow, Tray, Menu, globalShortcut, clipboard, nativeImage, ipcMain } = require('electron');
const path = require('path');
const Database = require('./db/database');
const ClipboardWatcher = require('./clipboard/watcher');

// ========== 初始化 ==========

// 数据库
const db = new Database(app.getPath('userData'));
db.init();
console.log('[Main] 数据库已初始化，当前', db.getStats().total, '条记录');

// 剪贴板监听
const imagesDir = path.join(app.getPath('userData'), 'assets', 'images');
const watcher = new ClipboardWatcher(db, imagesDir, { clipboard, nativeImage }, 500);

watcher.onNewItem((item) => {
  // 通过 IPC 推送给渲染进程（图片路径需转为绝对路径）
  if (mainWindow && !mainWindow.isDestroyed()) {
    const payload = { ...item };
    if (payload.type === 'image') {
      payload.content = path.join(app.getPath('userData'), payload.content);
    }
    mainWindow.webContents.send('clipboard:new-item', payload);
  }
});

// ========== IPC 处理器 ==========

// 数据库查询
ipcMain.handle('db:getHistory', (_event, searchQuery) => {
  const items = db.getAll(searchQuery);
  // 图片路径转换为绝对路径供渲染进程加载
  return items.map(item => {
    if (item.type === 'image') {
      return {
        ...item,
        content: path.join(app.getPath('userData'), item.content),
      };
    }
    return item;
  });
});

ipcMain.handle('db:getStats', () => {
  return db.getStats();
});

ipcMain.handle('db:togglePin', (_event, id) => {
  return db.togglePin(id);
});

ipcMain.handle('db:deleteItem', (_event, id) => {
  return db.deleteItem(id);
});

// 复制回剪贴板
ipcMain.handle('clipboard:copy', (_event, id) => {
  const item = db.getById(id);
  if (!item) return false;

  // 跳过本次轮询，避免本应用写入剪贴板时产生重复记录
  watcher.skipNext();

  if (item.type === 'text') {
    clipboard.writeText(item.content);
    console.log('[Main] 已复制文本到剪贴板:', item.content.substring(0, 30));
    return true;
  }

  if (item.type === 'image') {
    // 图片路径相对于项目根目录
    const imgPath = path.join(app.getPath('userData'), item.content);
    try {
      const img = nativeImage.createFromPath(imgPath);
      clipboard.writeImage(img);
      console.log('[Main] 已复制图片到剪贴板:', item.content);
      return true;
    } catch (err) {
      console.error('[Main] 图片复制失败:', err.message);
      return false;
    }
  }

  return false;
});

// 设置
ipcMain.handle('settings:getRetentionDays', () => {
  return db.getRetentionDays();
});

ipcMain.handle('settings:setRetentionDays', (_event, days) => {
  return db.setRetentionDays(days);
});

// ========== 窗口管理 ==========

let mainWindow = null;
let isQuitting = false;  // 区分「关闭窗口」和「退出应用」

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 420,
    height: 650,
    minWidth: 320,
    minHeight: 400,
    title: '历史剪贴板',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    console.log('[Main] 窗口已显示');
  });

  // 关闭窗口 → 隐藏到托盘（而非退出）
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      console.log('[Main] 窗口已隐藏到托盘');
    }
  });
}

function showWindow() {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
}

// ========== 系统托盘 ==========

let tray = null;

function createTray() {
  // 生成一个简单的 16x16 纯色图标（浅蓝色 #4A9EE8）
  const icon = nativeImage.createEmpty();
  const size = 16;
  const buffer = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const offset = i * 4;
    buffer[offset] = 74;     // R
    buffer[offset + 1] = 158; // G
    buffer[offset + 2] = 232; // B
    buffer[offset + 3] = 255; // A
  }
  const trayIcon = nativeImage.createFromBuffer(buffer, { width: size, height: size });

  tray = new Tray(trayIcon);
  tray.setToolTip('历史剪贴板');

  // 右键菜单
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示窗口',
      click: () => showWindow(),
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(contextMenu);

  // 双击托盘图标 → 显示窗口
  tray.on('double-click', () => {
    showWindow();
  });

  console.log('[Main] 系统托盘已创建');
}

// ========== 全局快捷键 ==========

function registerShortcuts() {
  // Ctrl+Shift+V 呼出窗口
  const registered = globalShortcut.register('CommandOrControl+Shift+V', () => {
    console.log('[Main] 快捷键 Ctrl+Shift+V 触发');
    showWindow();
  });

  if (!registered) {
    console.error('[Main] 快捷键注册失败（可能被其他程序占用）');
  } else {
    console.log('[Main] 全局快捷键 Ctrl+Shift+V 已注册');
  }
}

// ========== 开机自启（已禁用） ==========

function disableAutoLaunch() {
  app.setLoginItemSettings({
    openAtLogin: false,
  });
  console.log('[Main] 开机自启已关闭');
}

// ========== 应用生命周期 ==========

app.whenReady().then(() => {
  createWindow();
  createTray();
  registerShortcuts();
  disableAutoLaunch();
  watcher.start();
  console.log('[Main] 历史剪贴板已启动！');
});

// 防止多实例
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    // 用户尝试启动第二个实例 → 激活已有窗口
    showWindow();
  });
}

app.on('window-all-closed', () => {
  // 在托盘模式下不退出（除非正在退出）
  if (!isQuitting) {
    return; // 阻止退出
  }
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('will-quit', () => {
  watcher.stop();
  globalShortcut.unregisterAll();
});

app.on('activate', () => {
  // macOS dock 点击 → 显示窗口
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  } else {
    showWindow();
  }
});
