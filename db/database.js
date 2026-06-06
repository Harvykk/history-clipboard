// 历史剪贴板 - 数据库模块
// JSON 文件存储，内存操作 + 全量写回
// 无外部依赖，仅使用 Node.js 内置 fs/path

const fs = require('fs');
const path = require('path');

class Database {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.filePath = path.join(dataDir, 'clipboard-data.json');
    this.data = { items: [], settings: { retentionDays: 3 }, nextId: 1 };
  }

  // ========== 初始化 ==========

  /** 加载 JSON 数据文件，不存在则创建默认数据 */
  init() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        this.data = JSON.parse(raw);
        // 兼容旧版本数据格式
        if (!this.data.settings) {
          this.data.settings = { retentionDays: 3 };
        }
        if (typeof this.data.nextId !== 'number') {
          this.data.nextId = this.data.items.length > 0
            ? Math.max(...this.data.items.map(i => i.id)) + 1
            : 1;
        }
      } else {
        this._save();
      }
    } catch (err) {
      // 文件损坏时重建
      console.error('[Database] 加载数据失败，重建空数据库:', err.message);
      this.data = { items: [], settings: { retentionDays: 3 }, nextId: 1 };
      this._save();
    }

    // 启动时清理过期记录
    this.cleanExpired();
    return this;
  }

  // ========== 内部方法 ==========

  /** 全量写回 JSON 文件 */
  _save() {
    try {
      // 确保目录存在
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('[Database] 保存数据失败:', err.message);
    }
  }

  /** 生成过期时间 */
  _calcExpiresAt() {
    const d = new Date();
    d.setDate(d.getDate() + this.data.settings.retentionDays);
    return d.toISOString();
  }

  // ========== CRUD 操作 ==========

  /** 插入新记录，返回生成的 item */
  insert(type, content) {
    const item = {
      id: this.data.nextId++,
      type,
      content,
      pinned: false,
      createdAt: new Date().toISOString(),
      expiresAt: this._calcExpiresAt(),
    };
    this.data.items.unshift(item);
    this._save();
    return item;
  }

  /** 获取所有记录（已排序：置顶优先，时间降序），可选搜索过滤 */
  getAll(searchQuery) {
    let items = [...this.data.items];

    // 搜索过滤（大小写不敏感）
    if (searchQuery && searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      items = items.filter(item => {
        if (item.type === 'text') {
          return item.content.toLowerCase().includes(q);
        }
        // 图片按文件名搜索
        if (item.type === 'image') {
          return item.content.toLowerCase().includes(q);
        }
        return false;
      });
    }

    // 排序：置顶优先 → 时间降序
    items.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    return items;
  }

  /** 根据 ID 查找单条记录 */
  getById(id) {
    id = Number(id);
    return this.data.items.find(item => item.id === id) || null;
  }

  /** 切换置顶状态 */
  togglePin(id) {
    id = Number(id);  // IPC 可能传来字符串
    const item = this.data.items.find(i => i.id === id);
    if (item) {
      item.pinned = !item.pinned;
      this._save();
      console.log('[Database] togglePin #', id, '→', item.pinned);
      return item;
    }
    console.log('[Database] togglePin #', id, '→ 未找到');
    return null;
  }

  /** 删除记录（含图片文件清理） */
  deleteItem(id) {
    id = Number(id);  // IPC 可能传来字符串
    const item = this.getById(id);
    if (item && item.type === 'image') {
      // 删除关联的图片文件
      try {
        const imgPath = path.join(this.dataDir, item.content);
        if (fs.existsSync(imgPath)) {
          fs.unlinkSync(imgPath);
        }
      } catch (err) {
        console.error('[Database] 删除图片文件失败:', err.message);
      }
    }
    const before = this.data.items.length;
    this.data.items = this.data.items.filter(i => i.id !== id);
    const removed = before - this.data.items.length;
    if (removed > 0) {
      this._save();
      console.log('[Database] deleteItem #', id, '→ 已删除 (剩余', this.data.items.length, '条)');
      return true;
    }
    console.log('[Database] deleteItem #', id, '→ 未找到 (当前共', this.data.items.length, '条)');
    return false;
  }

  /** 清理过期记录（置顶项不清除） */
  cleanExpired() {
    const now = new Date();
    const before = this.data.items.length;
    this.data.items = this.data.items.filter(item => {
      if (item.pinned) return true;  // 置顶项永不清理
      return new Date(item.expiresAt) > now;
    });
    const removed = before - this.data.items.length;
    if (removed > 0) {
      this._save();
      console.log(`[Database] 清理了 ${removed} 条过期记录`);
    }
    return removed;
  }

  // ========== 设置 ==========

  /** 获取留存天数 */
  getRetentionDays() {
    return this.data.settings.retentionDays;
  }

  /** 设置留存天数（1/3/5），修改后重新计算所有未置顶项的过期时间 */
  setRetentionDays(days) {
    const validDays = [1, 3, 5];
    if (!validDays.includes(days)) {
      throw new Error(`留存天数必须为 ${validDays.join('/')}，收到: ${days}`);
    }
    this.data.settings.retentionDays = days;

    // 重新计算所有非置顶项的过期时间
    const now = new Date();
    this.data.items.forEach(item => {
      if (!item.pinned) {
        const d = new Date(item.createdAt);
        d.setDate(d.getDate() + days);
        // 如果新的过期时间已过，设为从现在起 days 天
        if (d <= now) {
          const newExpiry = new Date();
          newExpiry.setDate(newExpiry.getDate() + days);
          item.expiresAt = newExpiry.toISOString();
        } else {
          item.expiresAt = d.toISOString();
        }
      }
    });

    this._save();
    // 立即清理：基于新天数，移除已过期项
    this.cleanExpired();
    return days;
  }

  /** 获取统计信息 */
  getStats() {
    const total = this.data.items.length;
    const pinned = this.data.items.filter(i => i.pinned).length;
    const text = this.data.items.filter(i => i.type === 'text').length;
    const image = this.data.items.filter(i => i.type === 'image').length;
    return { total, pinned, text, image };
  }
}

module.exports = Database;
