/**
 * 小花狮桌面宠物 - Electron 主进程
 * 华东师范大学吉祥物"花狮"主题 · 原创实现
 *
 * - 透明无边框置顶窗口（桌面宠物）
 * - 托盘菜单 / 窗口拖动 / 位置记忆
 */
const { app, BrowserWindow, Tray, Menu, ipcMain, screen, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

const WIN_W = 330;
const WIN_H = 400;
const POS_FILE = 'huashi-pet-pos.json';

let win = null;
let tray = null;
let quitting = false;

// —— 单实例：避免开两个小花狮 ——
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) { win.show(); win.focus(); }
  });
}

function posFile() {
  return path.join(app.getPath('userData'), POS_FILE);
}

function loadPos() {
  try {
    const data = JSON.parse(fs.readFileSync(posFile(), 'utf8'));
    return [data.x, data.y];
  } catch { return [null, null]; }
}

function savePos() {
  if (!win) return;
  try {
    const [x, y] = win.getPosition();
    fs.writeFileSync(posFile(), JSON.stringify({ x, y }));
  } catch {}
}

// —— 诊断日志（限频写入 run.log） ——
let diagLog = null;
function diag(msg) {
  try {
    if (!diagLog) diagLog = 1;
    fs.appendFileSync(path.join(app.getPath('userData'), 'diag.log'), '[diag] ' + new Date().toISOString().slice(11, 23) + ' ' + msg + '\n');
  } catch {}
}

function createWindow() {
  diag('[createWindow] enter');
  const { workArea } = screen.getPrimaryDisplay();
  let [x, y] = loadPos();
  if (x == null || y == null) {
    // 默认放屏幕右下角
    x = workArea.x + workArea.width - WIN_W - 30;
    y = workArea.y + workArea.height - WIN_H - 40;
  }
  x = Math.max(workArea.x, Math.min(x, workArea.x + workArea.width - WIN_W));
  y = Math.max(workArea.y, Math.min(y, workArea.y + workArea.height - WIN_H));

  win = new BrowserWindow({
    width: WIN_W, height: WIN_H, x, y,
    frame: false,            // 无边框
    transparent: true,       // 透明背景
    alwaysOnTop: true,       // 始终置顶
    resizable: false,
    skipTaskbar: true,       // 不进任务栏
    hasShadow: false,
    show: false,
    title: '小花狮桌面宠物',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false // 常驻动画不被节流
    }
  });

  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  if (process.env.HUA_SNAP) {
    win.loadFile(path.join(__dirname, 'src', 'index.html'), { hash: 'plain' });
  } else {
    win.loadFile(path.join(__dirname, 'src', 'index.html'));
  }
  win.once('ready-to-show', () => win.show());

  // —— 探针：心跳/点击/位置/console ——
  let aliveCount = 0;
  ipcMain.on('pet-alive', () => {
    aliveCount++;
    lastAliveSeen = Date.now();
    heartbeat.alive = aliveCount;
    if (aliveCount % 2 === 0) {
      writeHeartbeat();
      try { if (tray) tray.setToolTip('小花狮 · 心跳#' + aliveCount); } catch {}
    }
  });
  ipcMain.on('pet-click', (_e, suppressed) => {
    heartbeat.clicks++;
    heartbeat.lastClick = Date.now();
    heartbeat.lastClickSuppressed = !!suppressed;
    writeHeartbeat();
    try { diag('[click] alive#' + aliveCount + ' sup=' + !!suppressed); } catch {}
  });
  let lastPosLog = 0;
  win.on('move', () => {
    const now = Date.now();
    if (now - lastPosLog > 5000) { lastPosLog = now; try { const [x, y] = win.getPosition(); diag('[move] -> ' + x + ',' + y); } catch {} }
  });
  win.webContents.on('console-message', (_e, lv, msg) => {
    if (String(msg).length < 300) diag('[render] ' + msg);
  });
  win.on('move', savePos);

  win.webContents.once('did-finish-load', () => diag('[boot] page loaded'));

  // —— 稳定性护栏：渲染崩溃/无响应自动恢复 ——
  win.webContents.on('render-process-gone', (_e, details) => {
    diag('[guard] renderer gone ' + JSON.stringify(details));
    setTimeout(() => { if (win && !win.isDestroyed()) win.reload(); }, 800);
  });
  win.webContents.on('unresponsive', () => {
    diag('[guard] renderer unresponsive -> reload');
    setTimeout(() => { if (win && !win.isDestroyed()) win.reload(); }, 2500);
  });

  // 点关闭 → 隐藏到托盘，不退出
  win.on('close', (e) => {
    if (!quitting) { e.preventDefault(); win.hide(); }
  });

  // 开发自检：HUA_SNAP=1 时截图保存（用于调形象）
  if (process.env.HUA_SNAP) {
    const logSnap = (m) => {
      try { fs.appendFileSync(path.join(__dirname, '..', 'snap.log'), m + '\n'); } catch {}
    };
    win.webContents.on('did-fail-load', (_e, code, desc) => logSnap('[snap] did-fail-load ' + code + ' ' + desc));
    win.webContents.on('console-message', (_e, level, msg) => logSnap('[renderer] ' + msg));
    win.webContents.once('did-finish-load', () => {
      logSnap('[snap] did-finish-load, waiting 4s');
      setTimeout(async () => {
        try {
          const img = await win.webContents.capturePage();
          fs.writeFileSync(path.join(__dirname, '..', 'snap.png'), img.toPNG());
          logSnap('[snap] saved ' + img.getSize().width + 'x' + img.getSize().height);
        } catch (e) { logSnap('[snap] fail ' + e.message); }
        app.quit();
      }, 4000);
    });
  }
}

// —— 心跳状态（多通道探针） ——
let lastAliveSeen = 0; // 渲染心跳最近时间（watchdog 用，模块作用域）
const heartbeat = { alive: 0, clicks: 0, win: 'unknown', ts: 0 };
function writeHeartbeat() {
  try {
    heartbeat.win = win && !win.isDestroyed()
      ? win.getSize()[0] + 'x' + win.getSize()[1] + '@' + win.getPosition().join(',')
      : 'no-window';
    heartbeat.ts = Date.now();
    fs.writeFileSync(path.join(app.getPath('userData'), 'heartbeat.json'), JSON.stringify(heartbeat, null, 2));
  } catch {}
}

// —— IPC：渲染进程拖动窗口 ——
ipcMain.on('pet-drag-by', (_e, dx, dy) => {
  if (!win) return;
  const [x, y] = win.getPosition();
  win.setPosition(Math.round(x + dx), Math.round(y + dy));
});

ipcMain.on('pet-hide', () => { if (win) win.hide(); });
ipcMain.on('pet-show', () => { if (win) { win.show(); win.setAlwaysOnTop(true, 'screen-saver'); } });
ipcMain.on('pet-quit', () => { quitting = true; app.quit(); });
ipcMain.on('pet-reset-pos', () => {
  if (!win) return;
  const { workArea } = screen.getPrimaryDisplay();
  const x = workArea.x + workArea.width - WIN_W - 30;
  const y = workArea.y + workArea.height - WIN_H - 40;
  win.setPosition(x, y);
});
ipcMain.on('pet-ping', (e) => { e.reply('pet-pong', true); });

// ===== 设置系统 =====
const SETTINGS_FILE = 'huashi-settings.json';
const BASE_W = 330, BASE_H = 400;
const SCALES = { 0.75: 0.75, 1: 1, 1.25: 1.25, 1.5: 1.5 };

const defaultSettings = () => ({
  opacity: 1,
  scale: 1,
  topmost: true,
  autostart: false,
  hourly: true,
  events: true,
  bars: true,
  chatHistory: true
});

function settingsPath() {
  return path.join(app.getPath('userData'), SETTINGS_FILE);
}

function loadSettings() {
  try {
    const s = Object.assign(defaultSettings(), JSON.parse(fs.readFileSync(settingsPath(), 'utf8')));
    return s;
  } catch { return defaultSettings(); }
}

function saveSettings(s) {
  try {
    fs.writeFileSync(settingsPath(), JSON.stringify(s, null, 2));
    return { ok: true };
  } catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
}

function applyWindowSettings(s) {
  if (!win || win.isDestroyed()) return;
  if (typeof s.opacity === 'number') win.setOpacity(Math.max(0.25, Math.min(1, s.opacity)));
  if (s.topmost !== undefined) win.setAlwaysOnTop(!!s.topmost, 'screen-saver');
  if (s.scale) {
    const sc = SCALES[s.scale] || 1;
    const [x, y] = win.getPosition();
    win.setSize(Math.round(BASE_W * sc), Math.round(BASE_H * sc));
    win.setPosition(x, y);
  }
  if (s.autostart !== undefined) {
    try { app.setLoginItemSettings({ openAtLogin: !!s.autostart }); } catch {}
  }
}

ipcMain.handle('settings-load', () => loadSettings());
ipcMain.handle('settings-save', (_e, s) => {
  const merged = Object.assign(defaultSettings(), s);
  const r = saveSettings(merged);
  if (r.ok) applyWindowSettings(merged);
  return r;
});
ipcMain.handle('settings-apply-opacity', (_e, v) => {
  if (win && !win.isDestroyed()) win.setOpacity(Math.max(0.25, Math.min(1, Number(v) || 1)));
  return { ok: true };
});
ipcMain.handle('settings-apply-scale', (_e, sc) => {
  if (!win || win.isDestroyed()) return { ok: true };
  const k = SCALES[sc] ? sc : 1;
  const x = win.getPosition()[0], y = win.getPosition()[1];
  win.setSize(Math.round(BASE_W * k), Math.round(BASE_H * k));
  win.setPosition(x, y);
  return { ok: true, scale: k };
});
ipcMain.handle('settings-apply-topmost', (_e, flag) => {
  if (win && !win.isDestroyed()) win.setAlwaysOnTop(!!flag, 'screen-saver');
  return { ok: true };
});
ipcMain.handle('settings-apply-autostart', (_e, flag) => {
  try { app.setLoginItemSettings({ openAtLogin: !!flag }); return { ok: true }; }
  catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
});

// 启动时应用设置
app.whenReady().then(() => {
  setTimeout(() => { applyWindowSettings(loadSettings()); }, 300);
});

// ===== 聊天：调用 OpenAI 兼容大模型 API =====
const CHAT_CONFIG_FILE = 'huashi-chat-config.json';

function chatConfigPath() {
  return path.join(app.getPath('userData'), CHAT_CONFIG_FILE);
}

function loadChatConfig() {
  try {
    return JSON.parse(fs.readFileSync(chatConfigPath(), 'utf8'));
  } catch {
    return { baseURL: 'https://api.deepseek.com/v1', apiKey: '', model: 'deepseek-chat' };
  }
}

ipcMain.handle('chat-load-config', () => loadChatConfig());

ipcMain.handle('chat-save-config', (_e, cfg) => {
  try {
    const clean = {
      baseURL: String((cfg && cfg.baseURL) || '').trim().replace(/\/+$/, ''),
      apiKey: String((cfg && cfg.apiKey) || '').trim(),
      model: String((cfg && cfg.model) || '').trim(),
      search: (cfg && cfg.search) !== false
    };
    fs.writeFileSync(chatConfigPath(), JSON.stringify(clean, null, 2));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
});

// 测试连接：用一个极小请求验证 baseURL/key/model 可用
ipcMain.handle('chat-test', async (_e, cfg) => {
  const c = cfg || loadChatConfig();
  const base = String(c.baseURL || '').trim().replace(/\/+$/, '');
  if (!base || !c.apiKey || !c.model) return { ok: false, error: '配置不完整，请填写接口地址 / Key / 模型名' };
  try {
    const resp = await fetch(base + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + String(c.apiKey).trim() },
      body: JSON.stringify({ model: c.model, messages: [{ role: 'user', content: '你好' }], max_tokens: 5 }),
      signal: AbortSignal.timeout(20000)
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      const msg = (data && data.error && data.error.message) || resp.statusText;
      return { ok: false, error: 'HTTP ' + resp.status + '：' + msg };
    }
    const reply = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    return { ok: !!reply, error: reply ? undefined : '接口返回格式异常（没有 choices）' };
  } catch (e) {
    return { ok: false, error: '无法连接：' + String((e && e.message) || e) };
  }
});

// —— 联网搜索增强 ——
async function webSearch(query) {
  try {
    const url = 'https://www.bing.com/search?q=' + encodeURIComponent(query) + '&setlang=zh-CN&count=6';
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36' },
      signal: AbortSignal.timeout(15000)
    });
    const html = await resp.text();
    const items = [];
    const re = /<li class="b_algo"[\s\S]*?<h2[^>]*><a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a><\/h2>[\s\S]*?(?:<p[^>]*>([\s\S]*?)<\/p>)?/g;
    let m;
    while ((m = re.exec(html)) && items.length < 5) {
      const title = (m[2] || '').replace(/<[^>]+>/g, '').trim();
      const snippet = (m[3] || '').replace(/<[^>]+>/g, '').trim();
      if (title) items.push(title + (snippet ? ' —— ' + snippet : ''));
    }
    return items;
  } catch { return []; }
}
function shouldSearch(text) {
  return /最新|今天|现在|天气|新闻|热搜|热点|近期|最近|当前|什么情况|报道|发布|上市|比赛|比分|票房|开学|放假|考试时间|几点|几号|日期|搜索|查一下|介绍一下|怎么回事|发生了什么|什么时候|哪一年|多久|多少|是否|是不是|有没有|为啥|为什么/i.test(text);
}
function refineQuery(text) {
  return String(text)
    .replace(/[，。！？、；：""''（）【】\s]+/g, ' ')
    .replace(/(吗|呢|啊|吧|的|了|呀|嘛|哦|哈|嗯|亲|你好|请问)/g, '')
    .trim()
    .slice(0, 60);
}

// 发送聊天
ipcMain.handle('chat-send', async (_e, payload) => {
  const cfg = loadChatConfig();
  const base = String(cfg.baseURL || '').trim().replace(/\/+$/, '');
  if (!base || !cfg.apiKey || !cfg.model) return { ok: false, error: 'chat_not_configured' };
  const messages = payload && Array.isArray(payload.messages) ? payload.messages : null;
  if (!messages) return { ok: false, error: 'bad_payload' };
  // 联网搜索增强：检测实时性问题（或手动强制）→ 搜索 → 把摘要注入上下文
  let usedSearch = false;
  let searchCount = 0;
  const forceSearch = payload && payload.forceSearch === true;
  const lastUser = [...messages].reverse().find(m => m.role === 'user');
  if (cfg.search !== false && lastUser && (forceSearch || shouldSearch(String(lastUser.content || '')))) {
    try {
      const results = await webSearch(refineQuery(String(lastUser.content)));
      searchCount = results.length;
      if (results.length) {
        const now = new Date().toLocaleString('zh-CN', { hour12: false });
        messages.splice(1, 0, {
          role: 'system',
          content: '以下是针对用户问题联网搜索到的最新资料（检索时间 ' + now + '）：\n' +
            results.map((r, i) => (i + 1) + '. ' + r).join('\n') +
            '\n\n请优先依据这些资料回答；若资料与问题无关则忽略并说明。'
        });
        usedSearch = true;
      }
    } catch {}
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120000);
  try {
    const resp = await fetch(base + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + cfg.apiKey },
      body: JSON.stringify({
        model: cfg.model,
        messages,
        temperature: 0.9,
        max_tokens: 400,
        stream: false
      }),
      signal: controller.signal
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      const msg = (data && data.error && data.error.message) || resp.statusText;
      return { ok: false, error: 'HTTP ' + resp.status + '：' + msg };
    }
    const reply = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (!reply) return { ok: false, error: '接口没有返回内容' };
    return { ok: true, reply: String(reply).trim(), searched: usedSearch, searchCount };
  } catch (e) {
    return { ok: false, error: e.name === 'AbortError' ? '请求超时（120s）' : String((e && e.message) || e) };
  } finally {
    clearTimeout(timer);
  }
});

function sendToPet(action) {
  if (win && !win.isDestroyed()) win.webContents.send('tray-action', action);
}

// —— 托盘 ——
function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, 'assets', 'tray.png'));
  tray = new Tray(icon);
  tray.setToolTip('小花狮 · 华东师大桌面宠物');

  const menu = Menu.buildFromTemplate([
    { label: '🙋 显示 / 隐藏小花狮', click: () => { win && win.isVisible() ? win.hide() : win.show(); } },
    { type: 'separator' },
    { label: '🍡 喂食', click: () => sendToPet('feed') },
    { label: '📚 学习充电', click: () => sendToPet('study') },
    { label: '🎾 陪它玩耍', click: () => sendToPet('play') },
    { label: '💼 去打工', click: () => sendToPet('work') },
    { type: 'separator' },
    { label: '🏅 成就墙', click: () => sendToPet('achv') },
    { label: '📖 玩法说明', click: () => sendToPet('help') },
    { label: '📊 状态面板', click: () => sendToPet('panel') },
    { label: '🔄 重置位置（窗口丢了就点它）', click: () => { win && win.webContents.send('tray-action', 'reset-pos'); }, },
    { label: '🎯 找不到它？点这里', click: () => { if (win) { win.show(); const wa = screen.getPrimaryDisplay().workArea; win.setPosition(wa.x + wa.width - WIN_W - 30, wa.y + wa.height - WIN_H - 40); } } },
    { type: 'separator' },
    { label: '🚪 退出', click: () => { quitting = true; app.quit(); } }
  ]);
  tray.setContextMenu(menu);
  tray.on('click', () => { if (win) win.isVisible() ? win.hide() : win.show(); });
}

app.whenReady().then(() => {
  diag('[app] whenReady');
  setInterval(writeHeartbeat, 10000);
  // —— 自愈哨兵：渲染掉线重载 / 窗口出屏复位 ——
  let watchdogReloads = 0;
  let lastWatchdogReload = 0;
  setInterval(() => {
    if (!win || win.isDestroyed()) return;
    // 渲染进程心跳检查（90 秒无心跳 → 重载并显示）
    if (Date.now() - lastAliveSeen > 90000) {
      const now = Date.now();
      diag('[watchdog] renderer heartbeat lost -> reload+show');
      try { win.webContents.reload(); } catch {}
      win.show();
      lastAliveSeen = now;
      if (now - lastWatchdogReload < 300000) {
        watchdogReloads++;
        if (watchdogReloads >= 3) {
          diag('[watchdog] repeated reloads, stop trying (renderer broken)');
          watchdogReloads = 999;
        }
      } else {
        watchdogReloads = 0;
      }
      lastWatchdogReload = now;
      return;
    }
    // 窗口可见性自愈：bounds 与所在屏幕无交集 → 拉回右下角并显示
    try {
      const b = win.getBounds();
      const disp = screen.getDisplayMatching(b);
      const inScreen = (b.x + b.width > disp.workArea.x) && (b.x < disp.workArea.x + disp.workArea.width) &&
                       (b.y + b.height > disp.workArea.y) && (b.y < disp.workArea.y + disp.workArea.height);
      if (!inScreen) {
        diag('[watchdog] window off-screen -> reset to bottom-right');
        const wa = screen.getPrimaryDisplay().workArea;
        win.setPosition(wa.x + wa.width - WIN_W - 30, wa.y + wa.height - WIN_H - 40);
        win.show();
        try { fs.unlinkSync(path.join(app.getPath('userData'), 'huashi-pet-pos.json')); } catch {}
      }
    } catch {}
  }, 30000);
  createWindow();
  createTray();
});

app.on('window-all-closed', (e) => {
  // 桌面宠物常驻托盘，不退出
});
