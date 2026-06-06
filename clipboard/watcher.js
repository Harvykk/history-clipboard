// 历史剪贴板 - 剪贴板监听模块
// 定时轮询系统剪贴板，检测文本/图片变化，写入数据库
// 依赖 Electron clipboard / nativeImage 模块

const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

class ClipboardWatcher {
  /**
   * @param {object}   db          - Database 实例
   * @param {string}   imagesDir   - 图片存储目录
   * @param {object}   electron    - Electron 的 clipboard / nativeImage 模块
   * @param {number}   interval    - 轮询间隔（毫秒），默认 500ms
   */
  constructor(db, imagesDir, electron, interval = 500) {
    this.db = db;
    this.imagesDir = imagesDir;
    this.clipboard = electron.clipboard;
    this.nativeImage = electron.nativeImage;
    this.interval = interval;

    this._timer = null;
    this._lastTextHash = null;
    this._lastImageHash = null;
    this._newItemCallback = null;

    // 确保图片目录存在
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
    }
  }

  // ========== 生命周期 ==========

  /** 启动监听 */
  start() {
    if (this._timer) return;
    console.log('[Watcher] 剪贴板监听已启动（间隔', this.interval, 'ms）');

    // 记录初始状态，避免启动时重复插入
    this._captureCurrentState();

    this._timer = setInterval(() => this._poll(), this.interval);
  }

  /** 停止监听 */
  stop() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
      console.log('[Watcher] 剪贴板监听已停止');
    }
  }

  /** 注册新条目回调（用于 IPC 推送） */
  onNewItem(callback) {
    this._newItemCallback = callback;
  }

  /** 跳过下一次轮询（本应用写入剪贴板时调用，避免自触发重复记录） */
  skipNext() {
    this._skipNext = true;
  }

  // ========== 内部方法 ==========

  /** 捕获当前剪贴板状态（不插入数据库） */
  _captureCurrentState() {
    try {
      const text = this.clipboard.readText();
      if (text) {
        this._lastTextHash = this._hash(text);
      }

      const img = this.clipboard.readImage();
      if (!img.isEmpty()) {
        const png = img.toPNG();
        this._lastImageHash = this._hash(png);
      }
    } catch (err) {
      // 剪贴板可能被其他程序锁定，忽略
    }
  }

  /** 轮询一次 */
  _poll() {
    // 本应用写入剪贴板后跳过本次轮询，并重新记录基准状态
    if (this._skipNext) {
      this._skipNext = false;
      this._captureCurrentState();
      return;
    }
    try {
      this._checkText();
      this._checkImage();
    } catch (err) {
      // 剪贴板忙或格式不支持时静默跳过
    }
  }

  /** 检查文本剪贴板 */
  _checkText() {
    const text = this.clipboard.readText();
    if (!text || text.length === 0) return;

    const hash = this._hash(text);
    if (hash === this._lastTextHash) return; // 无变化

    this._lastTextHash = hash;

    // 去重检查：最近一条文本记录是否内容相同
    const recent = this.db.getAll();
    const lastText = recent.find(item => item.type === 'text');
    if (lastText && lastText.content === text) return;

    // 插入数据库
    const item = this.db.insert('text', text);
    console.log('[Watcher] 新文本:', text.substring(0, 50) + (text.length > 50 ? '...' : ''));

    if (this._newItemCallback) {
      this._newItemCallback(item);
    }
  }

  /** 检查图片剪贴板 */
  _checkImage() {
    const img = this.clipboard.readImage();
    if (img.isEmpty()) return;

    const png = img.toPNG();
    if (!png || png.length === 0) return;

    const hash = this._hash(png);
    if (hash === this._lastImageHash) return; // 无变化

    this._lastImageHash = hash;

    // 去重检查
    const recent = this.db.getAll();
    const lastImage = recent.find(item => item.type === 'image');
    if (lastImage) {
      const lastPath = path.join(this.imagesDir, '..', lastImage.content);
      try {
        if (fs.existsSync(lastPath)) {
          const lastBuf = fs.readFileSync(lastPath);
          if (this._hash(lastBuf) === hash) return;
        }
      } catch (e) { /* 文件不存在则继续插入 */ }
    }

    // 保存图片文件
    const filename = Date.now() + '.png';
    const filePath = path.join(this.imagesDir, filename);
    fs.writeFileSync(filePath, png);

    // 存储相对路径
    const relativePath = 'assets/images/' + filename;
    const item = this.db.insert('image', relativePath);
    console.log('[Watcher] 新图片:', relativePath);

    if (this._newItemCallback) {
      this._newItemCallback(item);
    }
  }

  /** 计算内容的 MD5 哈希（用于去重） */
  _hash(data) {
    return crypto.createHash('md5').update(data).digest('hex');
  }
}

module.exports = ClipboardWatcher;
