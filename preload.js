// 历史剪贴板 - Preload 桥接
// 通过 contextBridge 安全地向渲染进程暴露有限 API
// 所有系统操作通过 IPC 委托给主进程

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('clipboardAPI', {
  // ========== 数据查询 ==========

  /** 获取历史记录列表（可选搜索） */
  getHistory: (searchQuery) => {
    return ipcRenderer.invoke('db:getHistory', searchQuery);
  },

  /** 获取统计信息 */
  getStats: () => {
    return ipcRenderer.invoke('db:getStats');
  },

  // ========== 数据操作 ==========

  /** 切换置顶状态 */
  togglePin: (id) => {
    return ipcRenderer.invoke('db:togglePin', id);
  },

  /** 删除记录 */
  deleteItem: (id) => {
    return ipcRenderer.invoke('db:deleteItem', id);
  },

  /** 将记录内容复制回系统剪贴板 */
  copyToClipboard: (id) => {
    return ipcRenderer.invoke('clipboard:copy', id);
  },

  // ========== 设置 ==========

  /** 获取留存天数 */
  getRetentionDays: () => {
    return ipcRenderer.invoke('settings:getRetentionDays');
  },

  /** 设置留存天数（1/3/5） */
  setRetentionDays: (days) => {
    return ipcRenderer.invoke('settings:setRetentionDays', days);
  },

  // ========== 事件监听 ==========

  /** 监听剪贴板更新（主进程 → 渲染进程推送） */
  onClipboardUpdate: (callback) => {
    const handler = (_event, item) => callback(item);
    ipcRenderer.on('clipboard:new-item', handler);
    // 返回取消订阅函数
    return () => {
      ipcRenderer.removeListener('clipboard:new-item', handler);
    };
  },
});
