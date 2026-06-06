// 历史剪贴板 — 渲染进程逻辑

const API = window.clipboardAPI;

// ===== DOM 引用 =====
const cardList = document.getElementById('cardList');
const searchInput = document.getElementById('searchInput');
const clearSearchBtn = document.getElementById('clearSearch');
const retentionSelect = document.getElementById('retentionSelect');
const statsText = document.getElementById('statsText');

// ===== 状态 =====
let currentItems = [];
let searchQuery = '';

// ===== 初始化 =====
async function init() {
  if (!API) {
    document.body.innerHTML = '<div style="padding:40px;text-align:center;color:#E05555;"><h2>⚠️ 错误</h2><p>无法连接到主进程，请重启应用。</p></div>';
    return;
  }

  await loadHistory();

  API.onClipboardUpdate(() => {
    // 从后端重新加载，保证置顶排序正确
    loadHistory();
  });

  try {
    const days = await API.getRetentionDays();
    retentionSelect.value = String(days);
  } catch (e) {
    console.error('加载设置失败:', e);
  }

  searchInput.addEventListener('input', onSearchInput);
  clearSearchBtn.addEventListener('click', clearSearch);
  retentionSelect.addEventListener('change', onRetentionChange);
}

// ===== 数据加载 =====
async function loadHistory() {
  try {
    currentItems = await API.getHistory(searchQuery || undefined);
    render();
    console.log('[UI] 历史记录已加载，共', currentItems.length, '条');
  } catch (err) {
    console.error('[UI] 加载历史记录失败:', err);
    showToast('加载数据失败，请重启应用');
  }
}

// ===== 渲染 =====
function render() {
  if (currentItems.length === 0) {
    cardList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">${searchQuery ? '🔍' : '📋'}</div>
        <p class="empty-title">${searchQuery ? '无匹配记录' : '暂无剪贴记录'}</p>
        <p class="empty-hint">${searchQuery ? '换个关键词试试' : '复制文字或图片后会自动出现在这里'}</p>
      </div>`;
  } else {
    cardList.innerHTML = currentItems.map(item => createCardHTML(item)).join('');
  }
  updateStats();
}

function createCardHTML(item) {
  const time = formatTime(item.createdAt);
  const isPinned = item.pinned ? 'pinned' : '';

  let contentHTML = '';
  if (item.type === 'image') {
    contentHTML = `<img class="card-image" src="${escapeHTML(item.content)}" alt="图片" loading="lazy">`;
  } else {
    contentHTML = `<div class="card-text">${escapeHTML(item.content)}</div>`;
  }

  return `
    <div class="card ${isPinned}" data-id="${item.id}" data-type="${item.type}">
      <div class="card-body">
        <div class="card-content">${contentHTML}</div>
      </div>
      <div class="card-footer">
        <span class="card-time">${time}</span>
        <div class="card-actions">
          <button class="card-btn pin-btn ${item.pinned ? 'active' : ''}" data-action="pin" title="${item.pinned ? '取消置顶' : '置顶'}">
            <span class="pin-icon">📌</span>
          </button>
          <button class="card-btn delete-btn" data-action="delete" title="删除">🗑</button>
        </div>
      </div>
    </div>`;
}

// ===== 事件处理（委托） =====
cardList.addEventListener('click', async (e) => {
  // 查找被点击的按钮
  const actionBtn = e.target.closest('[data-action]');
  const card = e.target.closest('.card');

  if (!card) return;

  if (actionBtn) {
    e.preventDefault();
    e.stopPropagation();
    const action = actionBtn.dataset.action;
    const id = Number(card.dataset.id);

    console.log('[UI] 按钮点击:', action, 'id:', id);

    if (action === 'pin') {
      // 按钮点击反馈
      actionBtn.style.transform = 'scale(1.3)';
      setTimeout(() => { actionBtn.style.transform = ''; }, 150);
      await togglePin(id);
    } else if (action === 'delete') {
      await deleteItem(id, card);
    }
  } else {
    // 卡片空白区域点击 → 复制
    const id = Number(card.dataset.id);
    await copyItem(id, card);
  }
});

// ===== 操作 =====
async function togglePin(id) {
  try {
    const result = await API.togglePin(id);
    console.log('[UI] togglePin 结果:', result);
    await loadHistory();
  } catch (err) {
    console.error('[UI] 置顶操作失败:', err);
    showToast('置顶操作失败');
  }
}

async function deleteItem(id, cardElement) {
  try {
    cardElement.classList.add('removing');
    await new Promise(r => setTimeout(r, 180)); // 等待动画
    const result = await API.deleteItem(id);
    console.log('[UI] deleteItem 结果:', result);
    await loadHistory();
  } catch (err) {
    console.error('[UI] 删除失败:', err);
    cardElement.classList.remove('removing');
    showToast('删除失败');
  }
}

async function copyItem(id, cardElement) {
  try {
    const success = await API.copyToClipboard(id);
    if (success) {
      cardElement.classList.add('copied');
      setTimeout(() => cardElement.classList.remove('copied'), 300);
      console.log('[UI] 已复制到剪贴板, id:', id);
    }
  } catch (err) {
    console.error('[UI] 复制失败:', err);
  }
}

// ===== 搜索 =====
let searchTimer = null;
function onSearchInput() {
  clearTimeout(searchTimer);
  const val = searchInput.value.trim();
  clearSearchBtn.classList.toggle('visible', val.length > 0);

  searchTimer = setTimeout(async () => {
    searchQuery = val;
    await loadHistory();
  }, 200);
}

function clearSearch() {
  searchInput.value = '';
  searchQuery = '';
  clearSearchBtn.classList.remove('visible');
  loadHistory();
}

// ===== 设置 =====
async function onRetentionChange() {
  const days = Number(retentionSelect.value);
  try {
    await API.setRetentionDays(days);
    await loadHistory();
    console.log('[UI] 留存天数已更新:', days);
    showToast('留存天数已设为 ' + days + ' 天');
  } catch (err) {
    console.error('[UI] 设置保存失败:', err);
  }
}

// ===== 工具：Toast 通知 =====
function showToast(msg) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.style.cssText = `
      position: fixed; bottom: 40px; left: 50%; transform: translateX(-50%);
      background: #1A1A1A; color: #FFF; padding: 6px 16px; border-radius: 16px;
      font-size: 12px; z-index: 9999; opacity: 0; transition: opacity 0.2s;
      pointer-events: none; white-space: nowrap;
    `;
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = '1';
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toast.style.opacity = '0'; }, 1500);
}

// ===== 工具函数 =====
function formatTime(isoString) {
  const d = new Date(isoString);
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

  if (d.toDateString() === now.toDateString()) return `今天 ${time}`;

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return `昨天 ${time}`;

  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${time}`;
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ===== 更新统计 =====
function updateStats() {
  const total = currentItems.length;
  const pinned = currentItems.filter(i => i.pinned).length;
  let text = `共 ${total} 条记录`;
  if (pinned > 0) text += `（${pinned} 条置顶）`;
  if (searchQuery) text += ` — 搜索: "${searchQuery}"`;
  statsText.textContent = text;
}

// ===== 启动 =====
init();
