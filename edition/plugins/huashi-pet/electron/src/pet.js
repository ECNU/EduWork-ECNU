/**
 * 小花狮桌面宠物 · 渲染进程玩法核心
 * 华东师大花狮主题：状态/喂食/学习升级/樱桃雨/打工/随机事件/成就
 */
'use strict';

(() => {
const $ = (id) => document.getElementById(id);
const P = window.Phrases;

// ================= 配置 =================
const CFG = {
  saveKey: 'huashi-pet-v1',
  decay: { food: 1 / 120, energy: 1 / 60, mood: 1 / 120 }, // 每秒衰减：饱食约1小时30点，能量1小时60点，心情1小时30点
  maxLevel: 999,
  // 升到 n 级（n>=1）所需经验：40 → 每级 +10%（线性温和）
  xpReq(n) { return Math.round(40 * (1 + (n - 1) * 0.1)); },
  xpTable: (() => {
    const t = [0];
    for (let n = 1; n <= 999; n++) t.push(t[t.length - 1] + Math.round(40 * (1 + (n - 1) * 0.1)));
    return t;
  })(),
  // 里程碑：达到该等级时发奖励（系数 ×等级 = 花狮币）
  milestones: { 10: 5, 20: 8, 30: 10, 50: 15, 75: 20, 100: 25, 150: 30, 200: 40, 300: 50, 400: 60, 500: 100, 600: 120, 700: 150, 800: 180, 900: 220, 999: 300 },
  foods: {
    cherry:    { emoji: '🍒', cost: 0,  food: 20, energy: 0,  mood: 0,  xp: 6,  lv: 1, name: '丽娃河樱桃' },
    milk:      { emoji: '🥛', cost: 3,  food: 15, energy: 10, mood: 2,  xp: 8,  lv: 1, name: '师大酸奶' },
    baozi:     { emoji: '🥟', cost: 2,  food: 25, energy: 0,  mood: 2,  xp: 10, lv: 2, name: '河东小笼包' },
    noodle:    { emoji: '🍜', cost: 5,  food: 35, energy: 0,  mood: 3,  xp: 12, lv: 3, name: '河西红汤面' },
    fish:      { emoji: '🐟', cost: 8,  food: 45, energy: 0,  mood: 10, xp: 16, lv: 4, name: '丽娃河烤鱼' },
    lionhead:  { emoji: '🦁', cost: 12, food: 50, energy: 0,  mood: 15, xp: 25, lv: 5, name: '红烧狮子头' },
    icecream:  { emoji: '🍧', cost: 15, food: 35, energy: 20, mood: 15, xp: 25, lv: 7, name: '樱桃河冰淇淋' },
    supermeal: { emoji: '🍱', cost: 18, food: 45, energy: 10, mood: 10, xp: 35, lv: 9, name: '学霸加油套餐' }
  },
  studies: {
    selfstudy: { name: '自习室刷题', emoji: '📖', secs: 60,  xp: 30, energy: -8,  lv: 1 },
    lecture:   { name: '蹭大师讲座', emoji: '🎤', secs: 90,  xp: 50, energy: -14, lv: 3 },
    sprint:    { name: '期末冲刺',   emoji: '🔥', secs: 120, xp: 80, energy: -20, lv: 6 }
  },
  plays: {
    roll:  { name: '打滚卖萌',   emoji: '🎾', mood: 8,  xp: 6,  energy: -4,  lv: 1 },
    wand:  { name: '逗猫棒',     emoji: '✨', mood: 12, xp: 10, energy: -6,  lv: 2 },
    fish:  { name: '丽娃河钓鱼', emoji: '🎣', mood: 12, xp: 14, energy: -8,  lv: 4 },
    dance: { name: '狮舞表演',   emoji: '🦁', mood: 20, xp: 22, energy: -12, lv: 6 }
  },
  jobs: {
    ta:     { name: '助教批作业',     secs: 60, coins: 30, xp: 12, mood: -1, lv: 1 },
    lib:    { name: '图书馆占座大使', secs: 45, coins: 20, xp: 8,  mood: 8,  lv: 2 },
    lab:    { name: '实验室看烧瓶',   secs: 90, coins: 60, xp: 18, mood: -2, lv: 3 },
    museum: { name: '校史馆讲解员',   secs: 75, coins: 50, xp: 22, mood: 6,  lv: 4 },
    boat:   { name: '丽娃河摆渡人',   secs: 60, coins: 70, xp: 16, mood: 5,  lv: 6 }
  },
  games: {
    cherry: { name: '樱桃雨',     emoji: '🍒', lv: 1, desc: '30秒接住落下的樱桃' },
    lantern: { name: '顶绣球',    emoji: '🏮', lv: 2, desc: '连击顶绣球，别断！' },
    seat:   { name: '抢座大作战', emoji: '💺', lv: 3, desc: '20秒点抢最多的座位' },
    quick:  { name: '闪电速算',   emoji: '⚡', lv: 4, desc: '10道题12秒限时' },
    quiz:   { name: '师大知识问答', emoji: '🧠', lv: 5, desc: '10道师大冷知识闯关' },
    ring:   { name: '套圈小铺',   emoji: '🎯', lv: 6, desc: '套中奖品赢花狮币' },
    candy:  { name: '糖果树',     emoji: '🍬', lv: 8, desc: '30秒找出指定糖果' }
  },
  decors: {
    scarf:   { name: '红色蝴蝶结', icon: '🎀', cost: 50, unlockLv: 2 },
    cap:     { name: '学士帽', icon: '🎓', cost: 80, unlockLv: 3 },
    blossom: { name: '樱花发卡', icon: '🌸', cost: 60, unlockLv: 4 },
    glasses: { name: '金丝眼镜', icon: '👓', cost: 40, unlockLv: 5 }
  },
  miniSecs: 30
};

// ================= 存档 =================
function freshSave() {
  return {
    food: 100, energy: 100, mood: 100,
    coins: 0, xp: 0, level: 1,
    decor: {}, equipped: {},
    stat: { feed: 0, study: 0, cherry: 0, work: 0, play: 0, miniGames: 0 },
    achv: {},
    bornAt: Date.now(),
    lastSeen: Date.now(),
    hours: 0,
    sick: null
  };
}
let S = freshSave();
try {
  const raw = localStorage.getItem(CFG.saveKey);
  if (raw) S = Object.assign(freshSave(), JSON.parse(raw));
} catch (e) { /* 存档损坏则重新开始 */ }

function save() {
  S.lastSeen = Date.now();
  try { localStorage.setItem(CFG.saveKey, JSON.stringify(S)); } catch (e) {}
}
window.addEventListener('beforeunload', save);
setInterval(save, 30000);

// ================= 离线结算 =================

// ================= 基础 UI =================
// 官方贴纸帧
const HS_FRAMES = { main: 'assets/hs_main.png', sleep: 'assets/hs_sleep.png', wink: 'assets/hs_wink.png', open: 'assets/hs_open.png', eat: 'assets/hs_eat.png', study: 'assets/hs_study.png', work: 'assets/hs_work.png', sick: 'assets/hs_sick.png' };
let hsTimer = null;
// 吧唧咀嚼：张嘴/闭嘴帧交替
function hschomp(mainFrame, eatFrame, times, intervalMs, done) {
  let n = 0;
  const img = document.getElementById('hs-img');
  if (!img) { if (done) done(); return; }
  const iv = setInterval(() => {
    img.setAttribute('href', (n % 2 === 0 ? eatFrame : mainFrame) + '?v=' + Date.now());
    n++;
    if (n >= times * 2) {
      clearInterval(iv);
      img.setAttribute('href', mainFrame + '?v=' + Date.now());
      if (done) done();
    }
  }, intervalMs);
}
function hsFrame(name, ms) {
  const img = document.getElementById('hs-img');
  if (!img) return;
  img.setAttribute('href', (HS_FRAMES[name] || HS_FRAMES.main) + '?v=' + Date.now());
  if (hsTimer) clearTimeout(hsTimer);
  if (ms > 0) hsTimer = setTimeout(() => img.setAttribute('href', HS_FRAMES.main), ms);
}
const face = {
  set(eyes, mouth, brows) {
    if (eyes === 'closed') hsFrame('sleep', 0);
    else if (eyes === 'star') hsFrame('wink', 0);
    else if (eyes === 'dizzy') hsFrame('open', 0);
    else hsFrame('main', 0);
  }
};
let faceTimer = null;

function setFace(eyes, mouth, brows, ms = 0) {
  face.set(eyes, mouth, brows);
  if (faceTimer) clearTimeout(faceTimer);
  if (ms > 0) faceTimer = setTimeout(() => face.set('open', 'smile', null), ms);
}

// body 动画类
let bodyTimer = {};
function anim(cls, ms) {
  document.body.classList.add(cls);
  if (bodyTimer[cls]) clearTimeout(bodyTimer[cls]);
  bodyTimer[cls] = setTimeout(() => document.body.classList.remove(cls), ms);
}
function animAdd(cls) { document.body.classList.add(cls); }
function animRemove(cls) { document.body.classList.remove(cls); }

// 气泡
let bubbleTimer = null;
function speech(text, ms = 3500) {
  const b = $('bubble');
  $('bubble-text').textContent = text;
  b.classList.add('show');
  if (bubbleTimer) clearTimeout(bubbleTimer);
  bubbleTimer = setTimeout(() => b.classList.remove('show'), Math.min(ms, 6000));
}

// toast
let toastTimer = null;
function toast(text, ms = 2600) {
  const t = $('toast');
  t.textContent = text;
  t.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}

(function offline() {
  const mins = Math.max(0, (Date.now() - S.lastSeen) / 60000);
  if (mins < 1) return;
  if (mins > 120) {
    S.food = Math.max(15, S.food - 10);
    S.energy = Math.max(15, S.energy - 8);
    S.mood = Math.max(15, S.mood - 5);
    setTimeout(() => speech('你离开了好久好久……想你想得瘦了一圈 T_T'), 1200);
  } else {
    S.food = Math.max(20, S.food - mins * 0.5);
    S.energy = Math.max(20, S.energy - mins * 0.5);
    S.mood = Math.max(20, S.mood - mins * 0.4);
  }
  S.hours += mins / 60;
  toast('离开 ' + Math.round(mins) + ' 分钟，小花狮有点想你了');
})();

// 特效 emoji
function fx(emoji, x = 140, y = 90, n = 3) {
  const layer = $('fx-html');
  for (let i = 0; i < n; i++) {
    const d = document.createElement('div');
    d.className = 'fx-item';
    d.textContent = emoji;
    const dx = (Math.random() - 0.5) * 60;
    const dy = (Math.random() - 0.5) * 20;
    d.style.left = (x + dx) + 'px';
    d.style.top = (y + dy) + 'px';
    layer.appendChild(d);
    setTimeout(() => d.remove(), 1500);
  }
}

function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// ================= 状态 & 衰减 =================
let busy = null; // 'study' | 'work' | 'minigame' | null
let sleeping = false;
let miniScore = 0;
let miniTimer = null;

function tick() {
  S.food = clamp(S.food - CFG.decay.food, 0, 100);
  S.energy = clamp(S.energy - CFG.decay.energy, 0, 100);
  if (!busy) S.mood = clamp(S.mood - CFG.decay.mood, 0, 100);

  // ===== 生病机制 =====
  const now = Date.now();
  if (S.sick) {
    // 病中：各项掉得更快
    S.food = clamp(S.food - CFG.decay.food * 0.6, 0, 100);
    S.energy = clamp(S.energy - CFG.decay.energy * 0.6, 0, 100);
    S.mood = clamp(S.mood - CFG.decay.mood * 0.6, 0, 100);
    // 病程结束自愈
    if (now >= S.sick.until) { cureSick(false); }
  } else {
    // 病因累计（门槛调高：饿到 8 以下持续 10 分钟、心情 5 以下 10 分钟才病）
    if (S.food < 8) S.foodLowStreak = (S.foodLowStreak || 0) + 1;
    else S.foodLowStreak = 0;
    if (S.mood < 5) S.moodLowStreak = (S.moodLowStreak || 0) + 1;
    else S.moodLowStreak = 0;
    if ((S.foodLowStreak || 0) > 600) { S.foodLowStreak = 0; getSick('饿得胃疼，快饿晕了'); }
    else if ((S.moodLowStreak || 0) > 600) { S.moodLowStreak = 0; getSick('一直闷闷不乐，蔫了'); }
    else if (S.energy < 5) {
      const h = new Date().getHours();
      if (h >= 23 || h < 6) getSick('深更半夜不睡，着凉发烧了');
    }
  }

  // 低状态反应
  if (!S.sick) {
    if (S.food < 25 && Math.random() < 0.004) { setFace('sad', 'sad', 'sad', 2600); speech(pick(P.hungry), 2800); }
    if (S.food < 10) setFace('closed', 'sad', 'sad');
    else if (S.mood < 25 && Math.random() < 0.002) { setFace('closed', 'sad', 'sad', 2600); speech(pick(P.low_mood), 2800); }
    if (S.energy < 15 && !sleeping && !busy) startSleep(true);
  }

  updateHUD();
}

// ===== 生病 / 痊愈 =====
function getSick(cause) {
  if (S.sick || busy) return;
  S.sick = { cause: cause, until: Date.now() + 300000 }; // 5 分钟病程
  if (!S.sickKinds) S.sickKinds = {};
  S.sickKinds[cause] = true;
  document.body.classList.add('pet-sick');
  // 病帽
  const tag = document.createElement('div');
  tag.id = 'sick-tag';
  tag.textContent = '🤒 病中：' + cause;
  document.body.appendChild(tag);
  // 冒冷汗
  if (window.__sickFx) clearInterval(window.__sickFx);
  window.__sickFx = setInterval(() => { fx('💧', 70 + Math.random() * 160, 20, 1); }, 3500);
  hsFrame('sick', 0);
  anim('pet-sick', 3000);
  speech('呜……我好像生病了：' + cause + '。带我去校医院吧 🏥', 3800);
  toast('👀 小花狮生病了：' + cause);
  save();
}
function cureSick(byDoctor) {
  if (!S.sick) return;
  S.sick = null;
  document.body.classList.remove('pet-sick');
  const tag = document.getElementById('sick-tag');
  if (tag) tag.remove();
  if (window.__sickFx) { clearInterval(window.__sickFx); window.__sickFx = null; }
  setFace('star', 'open', null, 2400);
  anim('pet-happy', 1000);
  fx('✨', 150, 70, 4);
  speech(byDoctor ? '病好啦！谢谢医生！吼吼！' : '睡一觉病好啦！活力满满！', 3000);
  toast('🎉 大病初愈！');
  checkAchv('recover', true);
  save();
}
function isSick() { return !!S.sick; }
setInterval(tick, 1000);
let richCheckAt = Date.now();
setInterval(() => {
  autoCheckAchv();
  if (Date.now() - richCheckAt > 10000) {
    richCheckAt = Date.now();
    checkAchv('rich_200', S.coins >= 200);
    checkAchv('rich_1000', S.coins >= 1000);
    checkAchv('lv50', S.level >= 50);
    checkAchv('lv100', S.level >= 100);
    checkAchv('graduate', S.level >= 999);
  }
}, 3000);

function updateHUD() {
  $('bar-food').style.width = S.food + '%';
  $('bar-energy').style.width = S.energy + '%';
  $('bar-mood').style.width = S.mood + '%';
  $('num-food').textContent = Math.round(S.food);
  $('num-energy').textContent = Math.round(S.energy);
  $('num-mood').textContent = Math.round(S.mood);
  $('num-coins').textContent = S.coins;
  $('nameplate').textContent = (S.sick ? '🤒 病中 · ' : '') + '小花狮 · ' + titleFor(S.level) + ' · Lv.' + S.level;
}

// ================= 升级 =================
// 称号分段（8 大称号，500 级成长）
const TITLE_TIERS = [
  { min: 1,   title: '小狮崽' },
  { min: 10,  title: '小花狮' },
  { min: 30,  title: '花狮' },
  { min: 60,  title: '幸福花狮' },
  { min: 100, title: '花狮昭昭' },
  { min: 200, title: '大师狮' },
  { min: 350, title: '荣誉狮王' },
  { min: 500, title: '传奇花狮' },
  { min: 700, title: '黄金狮皇' },
  { min: 900, title: '星耀花狮' },
  { min: 999, title: '无上神狮' }
];
function titleFor(level) {
  let t = TITLE_TIERS[0].title;
  for (const tier of TITLE_TIERS) { if (level >= tier.min) t = tier.title; }
  return t;
}
const TITLE_SPEECH = {
  '小狮崽': '哇！我出生啦！让我看看这个世界～',
  '小花狮': '我长大了一点！谢谢你的照顾！',
  '花狮': '吼！我是真正的花狮了！',
  '幸福花狮': '颜值与智慧并存——幸福花狮本狮！',
  '花狮昭昭': '明眸善睐的花狮昭昭登场！愿我们光明灿烂！',
  '大师狮': '大师狮在此！求实创造，为人师表！',
  '荣誉狮王': '狮王加冕！吼——！',
  '传奇花狮': '传奇诞生！我就是师大的传说！',
  '黄金狮皇': '狮皇加冕！金光照耀丽娃河畔！',
  '星耀花狮': '星辰之光汇聚——星耀花狮诞生！',
  '无上神狮': '九九归一！无上神狮，万狮之王！！'
};

// 某等级解锁内容汇总
function unlocksAt(lv) {
  const names = [];
  if (lv < 1) return names;
  for (const f of Object.values(CFG.foods)) if (f.lv === lv) names.push(f.emoji + f.name);
  for (const s of Object.values(CFG.studies)) if (s.lv === lv) names.push(s.emoji + '学习·' + s.name);
  for (const p of Object.values(CFG.plays)) if (p.lv === lv) names.push(p.emoji + '玩耍·' + p.name);
  for (const j of Object.values(CFG.jobs)) if (j.lv === lv) names.push('💼' + j.name);
  for (const g of Object.values(CFG.games)) if (g.lv === lv) names.push(g.emoji + '游戏·' + g.name);
  return names;
}

function checkLevelUp() {
  let lv = S.level;
  const cap = CFG.maxLevel || 500;
  while (lv < cap && S.xp >= CFG.xpTable[lv]) lv++;
  if (lv > S.level) {
    const oldLevel = S.level;
    S.level = lv;
    anim('pet-happy', 1200);
    fx('🎉', 150, 60, 6);
    // 新解锁内容
    let unlocked = [];
    for (let l = oldLevel + 1; l <= lv; l++) unlocked = unlocked.concat(unlocksAt(l));
    if (unlocked.length) setTimeout(() => toast('🎉 解锁新内容：' + unlocked.join('、')), 1200);
    // 里程碑奖励
    let msReward = 0;
    for (const [ml, factor] of Object.entries(CFG.milestones)) {
      if (oldLevel < Number(ml) && lv >= Number(ml)) {
        msReward += Number(ml) * factor;
        setTimeout(() => {
          toast('🎖️ 里程碑达成 Lv.' + ml + '！奖励 ' + (Number(ml) * factor) + ' 花狮币！');
          fx('🏅', 150, 60, 5);
        }, 2000 + (msReward > 0 ? 0 : 0));
      }
    }
    if (msReward > 0) { S.coins += msReward; S.food = clamp(S.food + 5, 0, 100); S.mood = clamp(S.mood + 10, 0, 100); }
    // 称号（分段变化时说话）
    const oldTitle = titleFor(oldLevel);
    const newTitle = titleFor(lv);
    setTimeout(() => speech('升级啦！Lv.' + lv + (oldTitle !== newTitle ? ' · 称号：【' + newTitle + '】' : '') + '！' + (oldTitle !== newTitle ? TITLE_SPEECH[newTitle] : ''), 4200), 500);
    // 解锁饰品
    for (const [k, d] of Object.entries(CFG.decors)) {
      if (d.unlockLv <= lv && !S.decor[k]) {
        S.decor[k] = true;
        S.equipped[k] = true;
        toast('解锁新饰品：' + d.icon + ' ' + d.name + '！');
        applyDecor();
      }
    }
    if (lv >= 999) { S.achv.graduate = true; toast('🏆 无上神狮达成！！九九归一！'); }
    else if (lv >= 700 && lv < 999 && !S.achv.mid_tier) { }
    else if (lv >= 100 && !S.achv.graduate_tmp) { }
    save();
  }
}

// ================= 饰品 =================
function applyDecor() {
  // 贴纸模式下饰品位居暂隐藏（官方帧形象）
  $('acc-scarf').style.display = 'none';
  $('acc-cap').style.display = 'none';
  $('acc-blossom').style.display = 'none';
  $('acc-glasses').style.display = 'none';
}

// ================= 场景道具 =================
const SCENE = {
  set(label, emoji) {
    const s = $('scene');
    s.innerHTML = '<span class="scene-emoji">' + emoji + '</span><span class="scene-label">' + label + '</span><span class="scene-progress-dots" id="scene-dots">···</span>';
    s.classList.remove('hide');
  },
  clear() {
    const s = $('scene');
    s.classList.add('hide');
    s.innerHTML = '';
  }
};

// ================= 学习 =================
function startStudy(key) {
  const study = CFG.studies[key] || CFG.studies.selfstudy;
  if (S.sick) { speech('咳咳……我病了，先带我去校医院养好再来！', 2600); return; }
  if (busy || sleeping) { speech('我现在忙着呢，等一会儿～'); return; }
  if (S.level < study.lv) { speech('这个要 Lv.' + study.lv + ' 才解锁，先自习磨磨爪！', 2600); return; }
  if (S.energy < 20) { speech('好困……让我先睡一下再学习嘛 Zzz'); startSleep(true); return; }
  busy = 'study';
  $('book').style.display = 'block';
  SCENE.set(study.name + '中…', study.emoji + '☕');
  animAdd('pet-study');
  hsFrame('study', 0);
  setFace('open', 'smile', null);
  speech(study.name + '！求实创造，为人师表！', 2600);
  startProgress(study.secs, study.emoji + ' ' + study.name + '……', () => {
    busy = null;
    $('book').style.display = 'none';
    SCENE.clear();
    animRemove('pet-study');
    animRemove('pet-sleep');
    S.xp += study.xp; S.stat.study++;
    S.mood = clamp(S.mood - 2, 0, 100);
    S.energy = clamp(S.energy + study.energy, 0, 100);
    setFace('star', 'open', null, 2200);
    fx('📚', 150, 70, 3);
    setTimeout(() => fx('💡', 160, 60, 2), 400);
    speech(pick(P.study_ok) + '（+' + study.xp + ' XP）', 3200);
    checkAchv('study_10', S.stat.study >= 10);
    checkLevelUp();
  });
}

// ================= 打工 =================
function startWork(jobKey) {
  if (S.sick) { speech('咳咳……生病了，先请个病假！', 2400); return; }
  if (busy || sleeping) { speech('现在不行哦，等忙完再说～'); return; }
  const job = CFG.jobs[jobKey];
  if (!job) return;
  if (S.level < job.lv) { speech('这岗位要 Lv.' + job.lv + ' 才解锁，先打工攒经验！', 2600); return; }
  busy = 'work';
  const jobEmoji = { ta: '✏️📝', lib: '📚🥤', lab: '🧪⚗️', museum: '🏛️📜', boat: '🚣🌊' }[jobKey] || '💼';
  SCENE.set(job.name + '中…', jobEmoji);
  animAdd('pet-work');
  hsFrame('work', 0);
  // 左手挥舞大锤
  const hammer = document.createElement('div');
  hammer.className = 'work-hammer';
  hammer.textContent = '🔨';
  document.body.appendChild(hammer);
  window.__workHammer = hammer;
  applyDecor();
  setFace('open', 'smile', null);
  speech('好嘞！去' + job.name + '！');
  startProgress(job.secs, '💼 ' + job.name + '中……', () => {
    busy = null;
    SCENE.clear();
    animRemove('pet-work');
    if (window.__workHammer) { window.__workHammer.remove(); window.__workHammer = null; }
    hsFrame('main', 0);
    applyDecor();
    S.coins += job.coins; S.xp += job.xp; S.stat.work++;
    if (!S.jobsDone) S.jobsDone = {};
    S.jobsDone[job.name] = true;
    checkAchv('work_all', Object.keys(S.jobsDone).length >= 5);
    S.mood = clamp(S.mood + job.mood, 0, 100);
    setFace('star', 'open', null, 2200);
    anim('pet-happy', 800);
    fx('💰', 150, 80, 4);
    fx('🎉', 140, 60, 2);
    speech(pick(P.work_ok) + '（+' + job.coins + ' 花狮币）', 3300);
    checkAchv('work_5', S.stat.work >= 5);
    checkLevelUp();
  });
}

// ================= 进度条 =================
function startProgress(secs, label, done) {
  const bar = $('progress-bar');
  bar.innerHTML = '';
  const fill = document.createElement('div');
  fill.style.width = '0%';
  bar.appendChild(fill);
  $('progress-label').textContent = label;
  $('progress').classList.remove('hide');
  const t0 = Date.now();
  const iv = setInterval(() => {
    const p = Math.min(1, (Date.now() - t0) / (secs * 1000));
    fill.style.width = (p * 100) + '%';
    if (p >= 1) {
      clearInterval(iv);
      $('progress').classList.add('hide');
      done();
    }
  }, 200);
}

// ================= 选择层渲染（按等级锁定） =================
function renderFoodPicker() {
  $('food-items').innerHTML = Object.entries(CFG.foods).map(([k, f]) =>
    '<button class="food' + (S.level < f.lv ? ' locked' : '') + '" data-key="' + k + '">' +
    '<span class="f-emoji">' + f.emoji + '</span>' +
    '<span class="f-name">' + f.name + '</span>' +
    '<span class="f-cost">' + (f.cost ? f.cost + '💰' : '免费') + '</span>' +
    '<span class="f-eff">+饱食' + f.food + ' · +' + f.xp + 'XP' + (f.energy ? ' · +能量' + f.energy : '') + (f.mood ? ' · +心情' + f.mood : '') + '</span>' +
    (S.level < f.lv ? '<span class="lock-tag">🔒 Lv.' + f.lv + ' 解锁</span>' : '') +
    '</button>').join('');
}
function renderWorkPicker() {
  $('work-items').innerHTML = Object.entries(CFG.jobs).map(([k, j]) =>
    '<button class="job' + (S.level < j.lv ? ' locked' : '') + '" data-key="' + k + '">' +
    '<span class="f-emoji">' + ({ ta: '✏️', lib: '📚', lab: '🧪', museum: '🏛️', boat: '🚣' }[k] || '💼') + '</span>' +
    '<span class="f-name">' + j.name + '</span>' +
    '<span class="f-cost">' + j.secs + '秒</span>' +
    '<span class="f-eff">+' + j.coins + '💰 · +' + j.xp + 'XP' + (j.mood !== 0 ? ' · 心情' + (j.mood > 0 ? '+' : '') + j.mood : '') + '</span>' +
    (S.level < j.lv ? '<span class="lock-tag">🔒 Lv.' + j.lv + ' 解锁</span>' : '') +
    '</button>').join('');
}
function renderStudyPicker() {
  $('study-items').innerHTML = Object.entries(CFG.studies).map(([k, s]) =>
    '<button class="study-item' + (S.level < s.lv ? ' locked' : '') + '" data-key="' + k + '">' +
    '<span class="f-emoji">' + s.emoji + '</span>' +
    '<span class="f-name">' + s.name + '</span>' +
    '<span class="f-cost">' + s.secs + '秒</span>' +
    '<span class="f-eff">+' + s.xp + 'XP · 能量' + s.energy + '</span>' +
    (S.level < s.lv ? '<span class="lock-tag">🔒 Lv.' + s.lv + ' 解锁</span>' : '') +
    '</button>').join('');
}
function renderPlayPicker() {
  $('play-items').innerHTML = Object.entries(CFG.plays).map(([k, p]) =>
    '<button class="play-item' + (S.level < p.lv ? ' locked' : '') + '" data-key="' + k + '">' +
    '<span class="f-emoji">' + p.emoji + '</span>' +
    '<span class="f-name">' + p.name + '</span>' +
    '<span class="f-cost">' + (k === 'dance' ? '+30💰' : '') + '</span>' +
    '<span class="f-eff">+心情' + p.mood + ' · +' + p.xp + 'XP</span>' +
    (S.level < p.lv ? '<span class="lock-tag">🔒 Lv.' + p.lv + ' 解锁</span>' : '') +
    '</button>').join('');
}
function renderGamePicker() {
  $('game-items').innerHTML = Object.entries(CFG.games).map(([k, g]) =>
    '<button class="game-item' + (S.level < g.lv ? ' locked' : '') + '" data-key="' + k + '">' +
    '<span class="f-emoji">' + g.emoji + '</span>' +
    '<span class="f-name">' + g.name + '</span>' +
    '<span class="f-cost">Lv.' + g.lv + '</span>' +
    '<span class="f-eff">' + g.desc + '</span>' +
    (S.level < g.lv ? '<span class="lock-tag">🔒 Lv.' + g.lv + ' 解锁</span>' : '') +
    '</button>').join('');
}

// ================= 玩耍（多模式） =================
function play(key) {
  const p = CFG.plays[key] || CFG.plays.roll;
  if (S.sick) { speech('阿嚏！生病了，玩不动了……', 2400); return; }
  if (busy || sleeping) { speech('先让我把手头的事做完～'); return; }
  if (S.level < p.lv) { speech('这个要 Lv.' + p.lv + ' 才解锁哦，先打滚吧！', 2600); return; }

  const finish = (extraSpeech) => {
    S.mood = clamp(S.mood + p.mood, 0, 100);
    S.energy = clamp(S.energy + p.energy, 0, 100);
    S.xp += p.xp;
    S.stat.play++;
    speech(extraSpeech || (p.name + '真好玩！（+' + p.xp + ' XP）'), 2600);
    checkLevelUp();
  };

  if (key === 'fish') {
    // 丽娃河钓鱼：进度 + 随机收获
    busy = 'fish';
    SCENE.set('丽娃河钓鱼中…', '🌊🎣');
    speech('嘘——鱼要上钩了！', 2400);
    startProgress(10, '🎣 钓鱼中……', () => {
      busy = null; SCENE.clear();
      const roll = Math.random();
      S.stat.fish = (S.stat.fish || 0) + 1;
      checkAchv('fish_10', S.stat.fish >= 10);
      if (!S.fishSet) S.fishSet = {};
      S.fishSet[roll < 0.45 ? 'fish' : roll < 0.7 ? 'boot' : roll < 0.9 ? 'cherry' : 'weed'] = true;
      if (roll < 0.45) { const c = 5 + Math.floor(Math.random() * 16); S.coins += c; fx('🐟', 150, 80, 4); finish('钓到一条大鱼！卖了 ' + c + ' 花狮币 🐟'); }
      else if (roll < 0.7) { S.coins += 8; fx('🥾', 150, 80, 3); finish('钓上来一只靴子……卖了 8 币，也算收获'); }
      else if (roll < 0.9) { fx('🍒', 150, 80, 4); finish('钓到一颗丽娃河樱桃！运气爆棚'); }
      else { fx('🤡', 150, 80, 2); finish('钓上来一团水草，会不会有美人鱼？'); }
    });
    return;
  }
  if (key === 'dance') {
    // 狮舞表演：双滚 + 收钱
    busy = 'dance';
    SCENE.set('狮舞表演中…', '🦁🥁');
    speech('看我的狮舞表演！咚咚锵！', 2400);
    startProgress(12, '🥁 狮舞表演……', () => {
      busy = null; SCENE.clear();
      anim('pet-roll', 2400);
      setFace('star', 'open', null, 2400);
      S.coins += 30;
      fx('🎉', 140, 60, 5);
      finish('掌声雷动！表演费 +30 花狮币！');
    });
    return;
  }
  // 普通玩耍（打滚/逗猫棒）
  const fxEmoji = key === 'wand' ? ['✨', '✨', '🐾'] : ['🎾', '🎵', '🤸'];
  anim('pet-roll', 2000);
  setFace('star', 'open', null, 2000);
  fxEmoji.forEach((e, i) => setTimeout(() => fx(e, 110 + i * 40, 70 + i * 15, 3), i * 250));
  anim('pet-happy', 900);
  finish(p.name + '给你看！吼吼～');
}

// ================= 睡觉 =================
function startSleep(auto = false) {
  if (busy || sleeping) return;
  sleeping = true;
  $('book').style.display = 'none';
  animAdd('pet-sleep');
  setFace('closed', 'sleepy', null);
  applyDecor();
  speech(auto ? '撑不住了……Zzz' : '晚安啦，你也早点休息 zzZ', 2800);
  const iv = setInterval(() => {
    S.energy = clamp(S.energy + (S.sick ? 2.2 : 0.6), 0, 100);
    if (S.sick) { S.food = clamp(S.food + 0.4, 0, 100); S.mood = clamp(S.mood + 0.4, 0, 100); }
  }, 1000);
  window.__sleepIv = iv;
  window.__zzzIv = setInterval(() => { fx('💤', 190, 40, 1); }, 2800);
  sleepTimer = setTimeout(() => wake(), 60000);
}
let sleepTimer = null;
function wake() {
  if (!sleeping) return;
  sleeping = false;
  if (window.__sleepIv) { clearInterval(window.__sleepIv); window.__sleepIv = null; }
  if (window.__zzzIv) { clearInterval(window.__zzzIv); window.__zzzIv = null; }
  if (sleepTimer) { clearTimeout(sleepTimer); sleepTimer = null; }
  animRemove('pet-sleep');
  setFace('open', 'smile', null);
  if (S.sick) {
    if (Math.random() < 0.85) { cureSick(false); return; }
    speech('睡了一觉，还是有点难受……再躺会儿？', 2400);
    return;
  }
  speech('睡饱啦！又是元气满满的一天！☀️', 2600);
  anim('pet-happy', 1000);
}

// ================= 小游戏 =================
function startMini(key) {
  const g = CFG.games[key] || CFG.games.cherry;
  if (S.sick) { speech('生病了先不打游戏的撒……', 2400); return; }
  if (busy || sleeping) { speech('等一下嘛，我先忙完！'); return; }
  if (S.level < g.lv) { speech('Lv.' + g.lv + ' 解锁这个小游戏！', 2400); return; }
  if (S.energy < 10) { speech('没力气玩啦……让我睡会儿'); startSleep(true); return; }
  if (key === 'seat') startSeatGame();
  else if (key === 'quiz') startQuiz();
  else if (key === 'lantern') startLanternGame();
  else if (key === 'quick') startQuickGame();
  else if (key === 'ring') startRingGame();
  else if (key === 'candy') startCandyGame();
  else startCherryGame();
}

// —— 顶绣球（连击） ——
let lanternIv = null;
function startLanternGame() {
  busy = 'minigame'; S.stat.miniGames++;
  lanternCombo = 0; lanternBest = 0; lanternHits = 0;
  const hud = document.createElement('div');
  hud.id = 'mini-hud';
  hud.textContent = '🏮 顶绣球 20s · 连击 0 (最高 0)';
  document.body.appendChild(hud);
  speech('绣球来了！别让连击断掉！', 2800);
  let t = 20;
  lanternIv = setInterval(() => {
    t--;
    const h = document.getElementById('mini-hud');
    if (h) h.textContent = '🏮 顶绣球 ' + t + 's · 连击 ' + lanternCombo + ' (最高 ' + lanternBest + ')';
    if (t <= 0) {
      clearInterval(lanternIv);
      document.querySelectorAll('.lantern-ball').forEach(b => b.remove());
      if (h) h.remove();
      busy = null;
      const coins = lanternHits + lanternBest * 2;
      S.coins += coins; S.xp += 12 + lanternBest;
      S.mood = clamp(S.mood + 5, 0, 100);
      toast('顶绣球结束！顶中 ' + lanternHits + ' 个，最高连击 ' + lanternBest + '，奖励 ' + coins + ' 币！');
      speech(lanternBest >= 10 ? '无敌连击！我是杂技狮！！' : (lanternBest >= 5 ? '连击还不错，再练练！' : '绣球好调皮……'), 2800);
      setFace('star', 'open', null, 2200);
      checkLevelUp(); save();
    }
  }, 1000);
  const spawn = setInterval(() => {
    if (busy !== 'minigame') { clearInterval(spawn); return; }
    spawnLantern();
  }, 850);
}
let lanternCombo = 0, lanternBest = 0, lanternHits = 0;
function spawnLantern() {
  const b = document.createElement('button');
  b.className = 'lantern-ball';
  b.textContent = Math.random() < 0.5 ? '🏮' : '🧧';
  b.style.left = (8 + Math.random() * 74) + '%';
  b.style.top = (120 + Math.random() * 160) + 'px';
  b.addEventListener('click', () => {
    if (!b.isConnected) return;
    lanternHits++;
    lanternCombo++;
    if (lanternCombo > lanternBest) lanternBest = lanternCombo;
    b.classList.add('caught');
    setTimeout(() => b.remove(), 350);
    anim('pet-happy', 420);
    fx('✨', 150, 80, 1);
    const h = document.getElementById('mini-hud');
    if (h) h.textContent = '🏮 顶绣球 · 连击 ' + lanternCombo + ' (最高 ' + lanternBest + ')';
  });
  // 超时未点 → 断连击
  setTimeout(() => {
    if (b.isConnected && !b.classList.contains('caught')) {
      b.remove();
      lanternCombo = 0;
      const h = document.getElementById('mini-hud');
      if (h) { h.textContent = '🏮 绣球落地！连击断掉了…'; setTimeout(() => { if (h.isConnected) h.textContent = '🏮 顶绣球 · 连击 0 (最高 ' + lanternBest + ')'; }, 800); }
    }
  }, 1400);
  document.body.appendChild(b);
}

// —— 闪电速算 ——
function genQuickQuiz() {
  const items = [];
  for (let i = 0; i < 10; i++) {
    const op = Math.floor(Math.random() * 3);
    let a, b, ans, expr;
    if (op === 0) { a = 5 + Math.floor(Math.random() * 40); b = 1 + Math.floor(Math.random() * 60); ans = a + b; expr = a + ' + ' + b; }
    else if (op === 1) { a = 15 + Math.floor(Math.random() * 60); b = 1 + Math.floor(Math.random() * (a - 1)); ans = a - b; expr = a + ' − ' + b; }
    else { a = 2 + Math.floor(Math.random() * 8); b = 2 + Math.floor(Math.random() * 8); ans = a * b; expr = a + ' × ' + b; }
    const opts = new Set([ans]);
    while (opts.size < 4) {
      const d = Math.max(1, Math.round(ans * 0.2));
      opts.add(ans + (Math.random() < 0.5 ? -1 : 1) * Math.floor(Math.random() * d + 1));
    }
    const arr = [...opts].sort(() => Math.random() - 0.5);
    items.push({ q: expr + ' = ?', opts: arr, a: arr.indexOf(ans) });
  }
  return items;
}
let quickState = null;
function startQuickGame() {
  busy = 'quick'; S.stat.miniGames++;
  quickState = { idx: 0, right: 0, qs: genQuickQuiz(), timer: null, left: 12 };
  const hud = document.createElement('div');
  hud.id = 'mini-hud';
  hud.textContent = '⚡ 闪电速算 第 1/10 题 · 12s';
  document.body.appendChild(hud);
  speech('速算挑战！每题 12 秒，开始！', 2400);
  renderQuick();
  quickState.timer = setInterval(() => {
    quickState.left--;
    const h = document.getElementById('mini-hud');
    if (h) h.textContent = '⚡ 闪电速算 第 ' + (quickState.idx + 1) + '/10 题 · ' + quickState.left + 's · 对 ' + quickState.right;
    if (quickState.left <= 0) quickNext(true);
  }, 1000);
}
function renderQuick() {
  const q = quickState.qs[quickState.idx];
  const box = $('quiz-panel');
  $('quiz-title').textContent = '⚡ 闪电速算 ' + (quickState.idx + 1) + '/10';
  $('quiz-q').textContent = q.q;
  const opts = $('quiz-opts');
  opts.innerHTML = '';
  q.opts.forEach((o, i) => {
    const b = document.createElement('button');
    b.textContent = o;
    b.addEventListener('click', () => quickAnswer(i));
    opts.appendChild(b);
  });
  $('quiz-fb').textContent = '';
  $('quiz-next').classList.add('hide');
  if (box.classList.contains('hide')) box.classList.remove('hide');
}
function quickAnswer(i) {
  const st = quickState;
  if (!st || st.answered) return;
  st.answered = true;
  const q = st.qs[st.idx];
  if (i === q.a) { st.right++; $('quiz-fb').textContent = '✅ 正确！'; }
  else $('quiz-fb').textContent = '❌ 答案是 ' + q.opts[q.a];
  quickNext(false);
}
function quickNext(timeout) {
  const st = quickState;
  if (!st) return;
  if (st.timer) { clearInterval(st.timer); st.timer = null; }
  st.idx++;
  st.answered = false;
  st.left = 12;
  if (st.idx >= st.qs.length || timeout && st.idx >= 0 && false) {
    endQuick(timeout);
    return;
  }
  if (st.idx >= st.qs.length) { endQuick(false); return; }
  renderQuick();
}
function endQuick(timeout) {
  const st = quickState;
  if (!st) return;
  quickState = null;
  busy = null;
  $('quiz-panel').classList.add('hide');
  const h = document.getElementById('mini-hud');
  if (h) h.remove();
  const coins = st.right * 3 + (st.right === 10 ? 20 : 0);
  S.coins += coins; S.xp += 15 + st.right * 2;
  S.mood = clamp(S.mood + 4, 0, 100);
  toast('速算完成：答对 ' + st.right + '/10，奖励 ' + coins + ' 币！' + (st.right === 10 ? ' 全对！追加 20 币 🎉' : ''));
  speech(st.right === 10 ? '闪电狮速算！全对！！' : (st.right >= 7 ? '脑子转得飞快！' : '手速不错，脑子再练练！'), 2800);
  setFace('star', 'open', null, 2200);
  checkLevelUp(); save();
}

// —— 套圈小铺 ——
const RING_PRIZES = [
  { emoji: '🦁', name: '花狮玩偶', coin: 5 },
  { emoji: '🍯', name: '蜂蜜罐', coin: 3 },
  { emoji: '🎁', name: '神秘礼盒', coin: 8 },
  { emoji: '🍡', name: '糖葫芦', coin: 2 },
  { emoji: '💰', name: '金币袋', coin: 10 }
];
let ringState = null;
function startRingGame() {
  busy = 'ring'; S.stat.miniGames++;
  ringState = { t: 20, hits: 0, coins: 0, iv: null };
  const hud = document.createElement('div');
  hud.id = 'mini-hud';
  hud.textContent = '🎯 套圈小铺 20s · 套中 0';
  document.body.appendChild(hud);
  speech('套圈啦！三个摊位，奖品随时换位！', 2600);
  renderRing();
  const swap = setInterval(() => {
    if (busy !== 'ring') { clearInterval(swap); return; }
    ringSwap();
  }, 2500);
  ringState.iv = setInterval(() => {
    ringState.t--;
    const h = document.getElementById('mini-hud');
    if (h) h.textContent = '🎯 套圈小铺 ' + ringState.t + 's · 套中 ' + ringState.hits + ' · ' + ringState.coins + '币';
    if (ringState.t <= 0) {
      clearInterval(ringState.iv);
      clearInterval(swap);
      document.querySelectorAll('.ring-stall').forEach(e => e.remove());
      if (h) h.remove();
      busy = null;
      const coins = ringState.coins;
      S.coins += coins; S.xp += 12;
      S.mood = clamp(S.mood + 5, 0, 100);
      toast('套圈结束！套中 ' + ringState.hits + ' 次，奖品合计 ' + coins + ' 币！');
      speech(ringState.hits >= 8 ? '百发百中！套圈大师！！' : '下次瞄得准一点！', 2800);
      setFace('star', 'open', null, 2200);
      checkLevelUp(); save();
    }
  }, 1000);
}
function ringSwap() {
  const stalls = document.querySelectorAll('.ring-stall');
  if (stalls.length < 3) return;
  const pri = RING_PRIZES.sort(() => Math.random() - 0.5).slice(0, 3);
  stalls.forEach((s, i) => {
    s.textContent = pri[i].emoji;
    s.dataset.prize = JSON.stringify(pri[i]);
    s.classList.add('ring-flash');
    setTimeout(() => s.classList.remove('ring-flash'), 400);
  });
}
function renderRing() {
  const pri = RING_PRIZES.sort(() => Math.random() - 0.5).slice(0, 3);
  pri.forEach((p, i) => {
    const s = document.createElement('button');
    s.className = 'ring-stall';
    s.textContent = p.emoji;
    s.dataset.prize = JSON.stringify(p);
    s.style.left = (18 + i * 30) + '%';
    s.addEventListener('click', () => {
      if (busy !== 'ring' || !s.isConnected) return;
      const pz = JSON.parse(s.dataset.prize);
      ringState.hits++;
      ringState.coins += pz.coin;
      // 套中动画
      const ring = document.createElement('div');
      ring.className = 'ring-fly';
      ring.style.left = s.style.left;
      ring.style.top = s.style.top;
      document.body.appendChild(ring);
      setTimeout(() => ring.remove(), 500);
      anim('pet-happy', 400);
      fx(pz.coin >= 8 ? '🎉' : '✨', 150, 80, 2);
      speech('套中' + pz.name + '！+' + pz.coin + ' 币！', 1200);
      // 该摊位补充新奖品
      setTimeout(() => {
        if (s.isConnected) {
          const np = RING_PRIZES[Math.floor(Math.random() * RING_PRIZES.length)];
          s.textContent = np.emoji;
          s.dataset.prize = JSON.stringify(np);
        }
      }, 300);
    });
    document.body.appendChild(s);
  });
}

// —— 糖果树（找指定糖） ——
const CANDY_EMOJIS = ['🍬', '🍭', '🍫', '🍩', '🍪', '🧁', '🍰', '🍿'];
let candyState = null;
function startCandyGame() {
  busy = 'candy'; S.stat.miniGames++;
  candyState = { t: 30, score: 0, target: '', iv: null };
  const hud = document.createElement('div');
  hud.id = 'mini-hud';
  hud.textContent = '🍬 糖果树：找出 🍬 · 30s · 0 分';
  document.body.appendChild(hud);
  candyPickTarget();
  renderCandy();
  speech('找出指定的糖果！点错会扣分哦！', 2600);
  candyState.iv = setInterval(() => {
    candyState.t--;
    const h = document.getElementById('mini-hud');
    if (h) h.textContent = '🍬 糖果树：找出 ' + candyState.target + ' · ' + candyState.t + 's · ' + candyState.score + ' 分';
    if (candyState.t <= 0) {
      clearInterval(candyState.iv);
      document.querySelectorAll('.candy-cell').forEach(e => e.remove());
      if (h) h.remove();
      busy = null;
      const coins = Math.max(0, candyState.score);
      S.coins += coins; S.xp += 10 + Math.max(0, candyState.score) * 2;
      S.mood = clamp(S.mood + 4, 0, 100);
      toast('糖果树结束！得分 ' + candyState.score + '，奖励 ' + coins + ' 币！');
      speech(candyState.score >= 150 ? '火眼金睛！糖果终结者！' : (candyState.score >= 60 ? '眼力不错！' : '多看看再点嘛…'), 2800);
      setFace('star', 'open', null, 2200);
      checkLevelUp(); save();
    }
  }, 1000);
}
function candyPickTarget() {
  candyState.target = CANDY_EMOJIS[Math.floor(Math.random() * CANDY_EMOJIS.length)];
  const h = document.getElementById('mini-hud');
  if (h) h.textContent = '🍬 糖果树：找出 ' + candyState.target + ' · ' + candyState.t + 's · ' + candyState.score + ' 分';
}
function renderCandy() {
  const emojis = [];
  for (let i = 0; i < 9; i++) emojis.push(CANDY_EMOJIS[Math.floor(Math.random() * CANDY_EMOJIS.length)]);
  // 保证目标至少出现 1~3 次
  const targetCount = 1 + Math.floor(Math.random() * 3);
  for (let i = 0; i < targetCount; i++) emojis[i] = candyState.target;
  emojis.sort(() => Math.random() - 0.5);
  document.querySelectorAll('.candy-cell').forEach(e => e.remove());
  emojis.forEach((em, i) => {
    const c = document.createElement('button');
    c.className = 'candy-cell';
    c.textContent = em;
    c.style.left = (10 + (i % 3) * 27) + '%';
    c.style.top = (130 + Math.floor(i / 3) * 58) + 'px';
    c.addEventListener('click', () => {
      if (busy !== 'candy' || !c.isConnected) return;
      if (c.textContent === candyState.target) {
        candyState.score += 10;
        fx('⭐', 150, 80, 1);
        anim('pet-happy', 350);
        c.classList.add('caught');
        setTimeout(() => c.remove(), 300);
        candyPickTarget();
        requestAnimationFrame(() => renderMesh());
      } else {
        candyState.score = Math.max(0, candyState.score - 5);
        fx('💧', 150, 60, 2);
        c.classList.add('wrongshake');
        setTimeout(() => c.classList.remove('wrongshake'), 400);
      }
      const h = document.getElementById('mini-hud');
      if (h) h.textContent = '🍬 糖果树：找出 ' + candyState.target + ' · ' + candyState.t + 's · ' + candyState.score + ' 分';
    });
    document.body.appendChild(c);
  });
}
function renderMesh() {}

// —— 樱桃雨 ——
function startCherryGame() {
  busy = 'minigame'; miniScore = 0;
  S.stat.miniGames++;
  const hud = document.createElement('div');
  hud.id = 'mini-hud';
  hud.textContent = '🍒 樱桃雨！接住它们！得分：0';
  document.body.appendChild(hud);
  speech('樱桃雨来啦！快点点樱桃接住它们！', 3500);
  const spawn = setInterval(() => {
    if (busy !== 'minigame') { clearInterval(spawn); return; }
    spawnCherry();
  }, 600);
  miniTimer = setTimeout(() => {
    clearInterval(spawn);
    busy = null;
    hud.remove();
    S.coins += miniScore;
    S.xp += 10 + miniScore;
    S.mood = clamp(S.mood + 4, 0, 100);
    S.stat.cherry += miniScore;
    if (miniScore > (S.bestCherry || 0)) S.bestCherry = miniScore;
    toast('樱桃雨结束！接住 ' + miniScore + ' 颗，奖励 ' + miniScore + ' 花狮币 +' + (10 + miniScore) + ' XP');
    speech(miniScore >= 15 ? '我是樱桃小能手！！' : '下次我要接更多樱桃！', 3000);
    checkAchv('cherry_20', S.stat.cherry >= 20);
    checkAchv('master_mini', S.stat.miniGames >= 10);
    checkLevelUp();
    save();
  }, CFG.miniSecs * 1000);
}

// —— 抢座大作战 ——
let seatTimer = null, seatSpawnIv = null;
function startSeatGame() {
  busy = 'seatgame';
  seat_score = 0; seat_time = 20;
  S.stat.miniGames++;
  const hud = document.createElement('div');
  hud.id = 'seat-hud';
  hud.textContent = '💺 抢座大作战 ' + seat_time + 's 得分：0';
  document.body.appendChild(hud);
  speech('图书馆抢座时间到！点点点！💺', 2800);
  seatSpawnIv = setInterval(spawnSeat, 750);
  seatTimer = setInterval(() => {
    seat_time--;
    const h = document.getElementById('seat-hud');
    if (h) h.textContent = '💺 抢座大作战 ' + seat_time + 's 得分：' + seat_score;
    if (seat_time <= 0) {
      clearInterval(seatTimer);
      clearInterval(seatSpawnIv);
      document.querySelectorAll('.seat-btn').forEach(b => b.remove());
      if (h) h.remove();
      busy = null;
      const coins = seat_score * 2;
      if (seat_score > (S.bestSeat || 0)) S.bestSeat = seat_score;
      S.stat.seat = (S.stat.seat || 0) + 1;
      checkAchv('seat_5', S.stat.seat >= 5);
      S.coins += coins; S.xp += 12; S.mood = clamp(S.mood + 5, 0, 100);
      toast('抢座结束！抢到 ' + seat_score + ' 个座，奖励 ' + coins + ' 花狮币！');
      speech(seat_score >= 15 ? '我抢到了靠窗宝座！！' : '下次早点去！', 2800);
      setFace('star', 'open', null, 2200);
      fx('🎉', 140, 60, 3);
      checkAchv('master_mini', S.stat.miniGames >= 10);
      checkLevelUp();
      save();
    }
  }, 1000);
  function spawnSeat() {
    if (busy !== 'seatgame') return;
    const b = document.createElement('button');
    b.className = 'seat-btn';
    b.textContent = '💺';
    b.style.left = (6 + Math.random() * 76) + '%';
    b.style.top = (148 + Math.random() * 175) + 'px';
    b.addEventListener('click', () => {
      if (!b.isConnected) return;
      seat_score++;
      b.classList.add('taken');
      fx('⭐', parseFloat(b.style.left) * 3.3, parseFloat(b.style.top), 1);
      setTimeout(() => b.remove(), 320);
      const h = document.getElementById('seat-hud');
      if (h) h.textContent = '💺 抢座大作战 ' + seat_time + 's 得分：' + seat_score;
    });
    document.body.appendChild(b);
    setTimeout(() => { if (b.isConnected && !b.classList.contains('taken')) b.remove(); }, 1400);
  }
}

// —— 师大知识问答 ——
let quizState = null;
function startQuiz() {
  const Q = window.Phrases.quiz || [];
  if (!Q.length) { toast('题库还没加载，稍后再试'); return; }
  busy = 'quiz';
  S.stat.miniGames++;
  quizState = { idx: 0, right: 0, total: 0, order: Q.slice().sort(() => Math.random() - 0.5).slice(0, 10) };
  renderQuiz();
  $('quiz-panel').classList.remove('hide');
  speech('来测测你对师大的了解！🧠', 2400);
}
function renderQuiz() {
  const st = quizState;
  if (!st) return;
  $('quiz-title').textContent = '🧠 师大知识问答 ' + (st.idx + 1) + '/' + st.order.length;
  const q = st.order[st.idx];
  $('quiz-q').textContent = q.q;
  const opts = $('quiz-opts');
  opts.innerHTML = '';
  q.opts.forEach((o, i) => {
    const b = document.createElement('button');
    b.textContent = o;
    b.addEventListener('click', () => answerQuiz(i));
    opts.appendChild(b);
  });
  $('quiz-fb').textContent = '';
  $('quiz-next').classList.add('hide');
}
function answerQuiz(i) {
  const st = quizState;
  if (!st || st.answered) return;
  st.answered = true;
  const q = st.order[st.idx];
  const btns = $('quiz-opts').querySelectorAll('button');
  if (i === q.a) {
    st.right++;
    S.stat.quizRight = (S.stat.quizRight || 0) + 1;
    checkAchv('quiz_20', S.stat.quizRight >= 20);
    btns[i].classList.add('right');
    $('quiz-fb').textContent = '✅ 厉害！+' + q.xp + ' XP +' + q.coin + ' 💰';
    S.xp += q.xp; S.coins += q.coin;
  } else {
    btns[i].classList.add('wrong');
    btns[q.a].classList.add('right');
    $('quiz-fb').textContent = '❌ 正确答案：' + q.opts[q.a] + (q.note ? '（' + q.note + '）' : '');
  }
  $('quiz-next').classList.remove('hide');
}
function nextQuiz() {
  const st = quizState;
  if (!st) return;
  st.idx++;
  st.answered = false;
  if (st.idx >= st.order.length) { endQuiz(); return; }
  renderQuiz();
}
function endQuiz() {
  const st = quizState;
  if (!st) return;
  quizState = null;
  busy = null;
  $('quiz-panel').classList.add('hide');
  S.xp += 10; S.mood = clamp(S.mood + 6, 0, 100);
  const total = st.order.length;
  if (st.right === total) { S.stat.quizPerfect = (S.stat.quizPerfect || 0) + 1; toast('🎯 全对！太强了！'); }
  toast('问答完成！答对 ' + st.right + '/' + total + '，学识大涨！');
  speech(st.right >= total * 0.8 ? '我是师大百事通！！' : (st.right >= total * 0.5 ? '还不错嘛，再接再厉！' : '我……我再去修修师大文化课！'), 3000);
  setFace('star', 'open', null, 2200);
  checkAchv('master_mini', S.stat.miniGames >= 10);
  checkLevelUp();
  save();
}
document.getElementById('quiz-next').addEventListener('click', nextQuiz);
document.getElementById('quiz-close').addEventListener('click', () => {
  if (busy === 'quiz') { busy = null; if (quizState) quizState.idx = quizState.order.length; }
  $('quiz-panel').classList.add('hide');
});

// ================= 喂食 =================
function openFoodPicker() {
  if (busy === 'study' || busy === 'work') { speech('忙完再喂我嘛～'); return; }
  renderFoodPicker();
  $('food-picker').classList.remove('hide');
}
function closeFoodPicker() { $('food-picker').classList.add('hide'); }

function feed(key) {
  const f = CFG.foods[key];
  if (!f) return;
  if (S.coins < f.cost) { toast('花狮币不够啦！去打工赚一点吧 💼'); speech('钱不够……我先忍忍饿 T_T'); return; }
  if (S.food >= 99) { speech('饱饱的，吃不下啦！', 2200); return; }
  if (S.sick) { speech('病中没胃口……只吃一点点就好', 2200); }
  S.coins -= f.cost;
  closeFoodPicker();
  // 食物飞向嘴巴
  const fly = document.createElement('div');
  fly.className = 'fly-food';
  fly.textContent = f.emoji;
  fly.style.left = '140px';
  fly.style.top = '290px';
  document.body.appendChild(fly);
  requestAnimationFrame(() => {
    fly.classList.add('land');
  });
  setTimeout(() => {
    fly.remove();
    // 张嘴迎接
    hsFrame('eat', 0);
    fx('😋', 205, 95, 2);
    anim('pet-eating', 2400); // 吧唧摆动动画
    // 吧唧吧唧：张嘴/闭嘴交替 6 次
    hschomp(HS_FRAMES.main, HS_FRAMES.eat, 6, 190, () => {
      // 吞咽：一沉 + 回弹
      anim('pet-shake', 700);
      setTimeout(() => {
        S.food = clamp(S.food + f.food, 0, 100);
        S.energy = clamp(S.energy + f.energy, 0, 100);
        S.mood = clamp(S.mood + f.mood, 0, 100);
        S.xp += (f.xp || 0) + 5; // 喂食也涨经验！
        S.stat.feed++;
        if (!S.eatSet) S.eatSet = {};
        S.eatSet[key] = true;
        // 吃撑了小概率闹肚子
        if (!S.sick && f.food >= 30 && S.food >= 99 && Math.random() < 0.03) {
          setTimeout(() => getSick('刚才吃太快，撑得闹肚子了'), 1600);
        }
        setFace('star', 'open', null, 2400);
        anim('pet-happy', 900);
        fx('💛', 150, 90, 2);
        fx('🍽️', 170, 70, 2);
        fx('✨', 130, 60, 2);
        speech(pick(P.eat_ok), 2800);
        checkAchv('first_feed', true);
        save();
      }, 240);
    });
  }, 620);
}

// ================= 点击互动 =================
let downXY = null, isDragging = false, lastClickT = 0, clickStreak = 0;

document.getElementById('stage').addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  downXY = { x: e.screenX, y: e.screenY, sx: e.screenX, sy: e.screenY, t: Date.now() };
  isDragging = false;
});

window.addEventListener('mousemove', (e) => {
  if (!downXY) return;
  const dx = e.screenX - downXY.x;
  const dy = e.screenY - downXY.y;
  if (!isDragging && Math.hypot(e.screenX - downXY.sx, e.screenY - downXY.sy) > 7) {
    isDragging = true;
    S.stat.drag = (S.stat.drag || 0) + 1;
    anim('pet-happy', 400);
  }
  if (isDragging && window.petAPI && Math.abs(dx) + Math.abs(dy) > 0) {
    window.petAPI.dragBy(dx, dy);
    downXY.x = e.screenX;
    downXY.y = e.screenY;
  }
});

window.addEventListener('mouseup', () => {
  downXY = null;
  isDragging = false;
});

document.getElementById('stage').addEventListener('click', (e) => {
  if (window.petAPI) window.petAPI.reportClick();
  S.stat.poke = (S.stat.poke || 0) + 1;
  const now = Date.now();
  if (now - lastClickT < 400) clickStreak++;
  else clickStreak = 1;
  lastClickT = now;

  if (clickStreak >= 6) {
    clickStreak = 0;
    // 连点生气
    if (busy === 'minigame') return;
    setFace('dizzy', 'surprised', 'angry', 2400);
    anim('pet-dizzy', 2200);
    anim('pet-stomp', 1400);
    fx('💢', 195, 45, 3);
    speech('别戳啦别戳啦！我要跺脚了！😵💢', 2600);
    S.mood = clamp(S.mood - 5, 0, 100);
    return;
  }

  // 睡觉时点击=唤醒
  if (sleeping) { wake(); return; }
  if (S.sick) {
    if (Math.random() < 0.6) { speech(pick(P.cough), 2200); fx('😷', 185, 60, 2); hsFrame('sick', 1600); }
    else { speech('带我去🏥校医院看看嘛……', 2200); }
    return;
  }

  // 普通点击 = 摸头，舒服眯眼
  hsFrame('sleep', 450);
  anim('pet-happy', 700);
  S.mood = clamp(S.mood + 3, 0, 100);
  if (Math.random() < 0.6) speech(pick(P.poke), 2600);
  if (Math.random() < 0.45) fx('💛', 130 + Math.random() * 40, 80 + Math.random() * 30, 2);
});

document.getElementById('stage').addEventListener('dblclick', () => {
  if (busy === 'minigame') return;
  anim('pet-dance', 2400);
  setFace('star', 'open', null, 2400);
  fx('🎶', 150, 80, 4);
  S.mood = clamp(S.mood + 4, 0, 100);
  speech('跳舞给你看！啦啦啦～🕺', 2600);
});

// ================= 右键菜单 =================
const menuEl = $('menu');
document.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  const bw = document.body.clientWidth, bh = document.body.clientHeight;
  const mw = 160, mh = menuEl.offsetHeight || 320;
  menuEl.style.left = clamp(e.clientX, 4, Math.max(4, bw - mw - 4)) + 'px';
  menuEl.style.top = clamp(e.clientY, 4, Math.max(4, bh - mh - 4)) + 'px';
  menuEl.classList.remove('hide');
});
document.addEventListener('click', (e) => {
  if (!menuEl.classList.contains('hide') && !menuEl.contains(e.target)) menuEl.classList.add('hide');
});

menuEl.addEventListener('click', (e) => {
  const mi = e.target.closest('.mi');
  if (!mi || mi.classList.contains('sep')) return;
  menuEl.classList.add('hide');
  doAction(mi.dataset.act);
});

// ================= 动作分发 =================
function doAction(act) {
  switch (act) {
    case 'help': HelpPanel.open(); break;
    case 'achv': AchvWall.open(); break;
    case 'settings': Settings.open(); break;
    case 'chat': Chat.open(); break;
    case 'feed': openFoodPicker(); break;
    case 'study': renderStudyPicker(); $('study-picker').classList.remove('hide'); break;
    case 'play': renderPlayPicker(); $('play-picker').classList.remove('hide'); break;
    case 'work': renderWorkPicker(); $('work-picker').classList.remove('hide'); break;
    case 'minigame': renderGamePicker(); $('game-picker').classList.remove('hide'); break;
    case 'hospital': {
      if (!S.sick) { toast('没生病啦，医院的大夫说：注意休息就好 😄'); speech('我健康得很！吼吼！', 2400); break; }
      $('hospital-picker').classList.remove('hide');
      break;
    }
    case 'sleep': sleeping ? wake() : startSleep(); break;
    case 'panel': togglePanel(); break;
    case 'quit': if (window.petAPI) { save(); window.petAPI.quit(); } break;
    case 'reset-pos': if (window.petAPI) window.petAPI.resetPos(); toast('位置已重置'); break;
    case 'toggle-top': $('topbar').classList.toggle('force'); break;
  }
}

document.querySelectorAll('.bb').forEach(btn => {
  btn.addEventListener('click', () => doAction(btn.dataset.act));
});
// 悬浮退出按钮（右上角 ✕）
$('quit-btn').addEventListener('click', () => doAction('quit'));
// 选择层委托：食物/打工/学习/玩耍/游戏
document.addEventListener('click', (e) => {
  const food = e.target.closest('.food[data-key]');
  if (food) {
    if (food.classList.contains('locked')) { toast('还差 ' + (CFG.foods[food.dataset.key].lv - S.level) + ' 级解锁 🔒'); return; }
    feed(food.dataset.key);
    return;
  }
  const job = e.target.closest('.job[data-key]');
  if (job) {
    if (job.classList.contains('locked')) { toast('这个岗位需要更高等级 🔒'); return; }
    $('work-picker').classList.add('hide');
    startWork(job.dataset.key);
    return;
  }
  const study = e.target.closest('.study-item[data-key]');
  if (study) {
    if (study.classList.contains('locked')) { toast('等级不够，先自习攒经验 🔒'); return; }
    $('study-picker').classList.add('hide');
    startStudy(study.dataset.key);
    return;
  }
  const playBtn = e.target.closest('.play-item[data-key]');
  if (playBtn) {
    if (playBtn.classList.contains('locked')) { toast('等级不够 🔒'); return; }
    $('play-picker').classList.add('hide');
    play(playBtn.dataset.key);
    return;
  }
  const treat = e.target.closest('.treat-item[data-treat]');
  if (treat) {
    const at = treat.dataset.treat;
    if (!S.sick) { toast('没有生病，不用吃药～'); return; }
    if (at === 'normal') {
      if (S.coins < 20) { toast('挂号费 20💰，去打工赚点钱吧！'); speech('呜呜，没钱挂号……', 2400); return; }
      S.coins -= 20;
      S.stat.treat = (S.stat.treat || 0) + 1;
      if (Math.random() < 0.6) { toast('💊 药到病除！'); cureSick(true); }
      else { toast('吃了药，但病情没马上好……再睡一觉？'); speech('药好苦……肚子还是有点疼 T_T', 2600); }
    } else if (at === 'expert') {
      if (S.coins < 50) { toast('专家号 50💰！'); speech('专家号好贵！先打工凑钱吧！', 2400); return; }
      S.coins -= 50;
      S.stat.treat = (S.stat.treat || 0) + 1;
      S.food = clamp(S.food + 10, 0, 100);
      S.energy = clamp(S.energy + 10, 0, 100);
      S.mood = clamp(S.mood + 10, 0, 100);
      fx('🌟', 150, 60, 4);
      cureSick(true);
    } else if (at === 'tea') {
      S.stat.hotw = (S.stat.hotw || 0) + 1;
      S.energy = clamp(S.energy + 15, 0, 100);
      S.sick.until = Math.min(S.sick.until, Date.now() + 150000); // 病程缩短到 2.5 分钟
      toast('☕ 热水下肚，舒服多了～（病程缩短）');
      speech('咕嘟咕嘟……嗯，没那么难受了！', 2400);
      save();
    }
    $('hospital-picker').classList.add('hide');
    return;
  }
  const game = e.target.closest('.game-item[data-key]');
  if (game) {
    if (game.classList.contains('locked')) { toast('等级不够 🔒'); return; }
    $('game-picker').classList.add('hide');
    startMini(game.dataset.key);
  }
});
document.getElementById('food-close').addEventListener('click', closeFoodPicker);
document.querySelectorAll('.picker-cancel').forEach(b => {
  b.addEventListener('click', () => {
    const t = b.dataset.cancel;
    if (t === 'work') $('work-picker').classList.add('hide');
    if (t === 'study') $('study-picker').classList.add('hide');
    if (t === 'play') $('play-picker').classList.add('hide');
    if (t === 'game') $('game-picker').classList.add('hide');
    if (t === 'hospital') $('hospital-picker').classList.add('hide');
  });
});

// ================= 状态面板 =================
function togglePanel() {
  const p = $('panel');
  if (p.classList.contains('hide')) renderPanel(), p.classList.remove('hide');
  else p.classList.add('hide');
}
function renderPanel() {
  $('pl-title').textContent = titleFor(S.level);
  $('pl-lv').textContent = 'Lv.' + S.level;
  const cur = CFG.xpTable[Math.max(0, Math.min(S.level - 1, CFG.xpTable.length - 1))];
  const next = S.level < CFG.xpTable.length ? CFG.xpTable[S.level] : cur;
  const pct = Math.max(0, Math.min(100, Math.round((S.xp - cur) / Math.max(1, next - cur) * 100)));
  $('pl-xp').style.width = pct + '%';
  $('pl-xp-num').textContent = Math.max(0, S.xp - cur) + '/' + Math.max(1, next - cur);
  $('pl-coins').textContent = S.coins;
  $('pl-feed').textContent = S.stat.feed;
  $('pl-study').textContent = S.stat.study;
  $('pl-cherry').textContent = S.stat.cherry;
  // 成就（带进度）
  const av = $('pl-achv');
  av.innerHTML = '';
  const achvKeys = Object.keys(P.achievements);
  const doneCount = achvKeys.filter(k => S.achv[k]).length;
  const sec = $('pl-sec-achv');
  if (sec) { sec.textContent = '🏅 成就 (' + doneCount + '/' + achvKeys.length + ')  →'; sec.style.cursor = 'pointer'; }
  for (const k of achvKeys) {
    const a = P.achievements[k];
    const d = document.createElement('span');
    d.className = 'achv' + (S.achv[k] ? ' done' : '');
    d.textContent = a.icon + ' ' + a.name;
    if (!S.achv[k]) {
      const prog = ACHV_PROGRESS[k];
      if (prog) {
        const [cur, goal] = prog();
        d.innerHTML += ' <i>' + Math.min(cur, goal) + '/' + goal + '</i>';
      } else {
        d.innerHTML += ' <i>🔒</i>';
      }
    }
    av.appendChild(d);
  }
  // 下一级解锁预告（9 级后显示里程碑）
  const nl = S.level + 1;
  const nextNames = unlocksAt(nl);
  let nextTxt = '';
  if (nextNames.length) nextTxt = nextNames.join('、');
  else {
    let ns = [];
    for (const [ml, f] of Object.entries(CFG.milestones)) if (Number(ml) > S.level) { ns.push('Lv.' + ml + ' 里程碑🎖️'); if (ns.length >= 2) break; }
    nextTxt = ns.length ? ns.join('、') : '传奇之路…继续升级！';
  }
  $('pl-next').textContent = nextTxt;
  // 饰品
  const dv = $('pl-decor');
  dv.innerHTML = '';
  for (const [k, d] of Object.entries(CFG.decors)) {
    const owned = S.decor[k] || d.unlockLv <= S.level;
    if (!owned) {
      const b = document.createElement('button');
      b.className = 'dec-btn';
      b.textContent = d.icon + ' ' + d.name + '（' + d.cost + '💰）';
      b.addEventListener('click', () => {
        if (S.coins >= d.cost) {
          S.coins -= d.cost;
          S.decor[k] = true; S.equipped[k] = true;
          applyDecor(); save();
          toast('购买成功：' + d.name);
          renderPanel();
        } else toast('花狮币不足！');
      });
      dv.appendChild(b);
    } else {
      const b = document.createElement('button');
      b.className = 'dec-btn owned';
      b.textContent = d.icon + ' ' + d.name + (S.equipped[k] ? ' ✅' : '');
      b.addEventListener('click', () => {
        S.equipped[k] = !S.equipped[k];
        applyDecor(); save(); renderPanel();
      });
      dv.appendChild(b);
    }
  }
}
document.getElementById('panel-close').addEventListener('click', () => $('panel').classList.add('hide'));
document.getElementById('pl-sec-achv').addEventListener('click', () => { AchvWall.open(); });

// ================= 成就 =================
// 成就进度来源（当前值, 目标值）
const ACHV_PROGRESS = {
  first_feed: () => [S.stat.feed, 1],
  feed_20: () => [S.stat.feed, 20],
  feed_100: () => [S.stat.feed, 100],
  cherry_20: () => [S.stat.cherry, 20],
  cherry_100: () => [S.stat.cherry, 100],
  study_10: () => [S.stat.study, 10],
  study_50: () => [S.stat.study, 50],
  work_5: () => [S.stat.work, 5],
  work_all: () => [Object.keys(S.jobsDone || {}).length, 5],
  rich_200: () => [S.coins, 200],
  rich_1000: () => [S.coins, 1000],
  play_10: () => [S.stat.play, 10],
  fish_10: () => [S.stat.fish || 0, 10],
  seat_5: () => [S.stat.seat || 0, 5],
  quiz_20: () => [S.stat.quizRight || 0, 20],
  hours_6: () => [Math.round(S.hours), 6],
  hours_24: () => [Math.round(S.hours), 24],
  recover: () => [S.achv.recover ? 1 : 0, 1],
  day_7: () => [S.dayCount || 0, 7],
  chat_20: () => [S.stat.chat || 0, 20],
  lv50: () => [S.level, 50],
  lv100: () => [S.level, 100],
  graduate: () => [S.level >= 999 ? 1 : 0, 1]
};

// ===== 成就工厂：300+ 成就（链式生成 + 手写 + 自动补齐） =====
(function buildAchv() {
  if (P.__achvBuilt) return;
  P.__achvBuilt = true;
  const tierNames = ['入门', '进阶', '熟练', '达人', '大师', '宗师', '传说', '神话', '不朽', '永恒', '无上', '归真'];
  const chains = [
    { key: 'feed',   icon: '🍡', label: '喂食',   unit: '次',   goals: [1,10,25,50,100,200,400,800,1500,3000,6000,10000,20000,50000], get: () => S.stat.feed },
    { key: 'study',  icon: '📚', label: '学习',   unit: '次',   goals: [1,10,25,50,100,200,400,800,1500,3000,6000,10000], get: () => S.stat.study },
    { key: 'work',   icon: '💼', label: '打工',   unit: '次',   goals: [1,10,25,50,100,200,500,1000,2000,5000,20000], get: () => S.stat.work },
    { key: 'play',   icon: '🎾', label: '玩耍',   unit: '次',   goals: [1,10,25,50,100,200,500,1000,2000,5000], get: () => S.stat.play },
    { key: 'cherry', icon: '🍒', label: '接樱桃', unit: '颗',   goals: [1,10,25,50,100,250,500,1000,2500,5000,10000,25000], get: () => S.stat.cherry },
    { key: 'coins',  icon: '💰', label: '攒币',   unit: '币',   goals: [10,50,100,200,500,1000,2500,5000,10000,25000,50000,100000,300000,1000000], get: () => S.coins },
    { key: 'lv',     icon: '🎖️', label: '等级',  unit: '级',   goals: [10,20,30,40,50,60,70,80,90,100,150,200,250,300,350,400,450,500,600,700,800,900,999], get: () => S.level },
    { key: 'hours',  icon: '⏰', label: '陪伴',   unit: '小时', goals: [1,3,6,12,24,48,100,200,500,1000,2000,5000,10000], get: () => Math.floor(S.hours) },
    { key: 'fish',   icon: '🎣', label: '钓鱼',   unit: '次',   goals: [1,5,10,25,50,100,250,500,1000], get: () => S.stat.fish || 0 },
    { key: 'seat',   icon: '💺', label: '抢座',   unit: '次',   goals: [1,5,10,25,50,100,250,500,1000], get: () => S.stat.seat || 0 },
    { key: 'quiz',   icon: '🧠', label: '答题',   unit: '题',   goals: [1,10,25,50,100,200,500,1000], get: () => S.stat.quizRight || 0 },
    { key: 'chat',   icon: '💬', label: '聊天',   unit: '条',   goals: [1,10,25,50,100,200,500,1000,5000], get: () => S.stat.chat || 0 },
    { key: 'day',    icon: '🗓️', label: '活跃',  unit: '天',   goals: [1,3,7,14,30,60,100,200,365,730], get: () => S.dayCount || 0 },
    { key: 'xp',     icon: '✨', label: '经验',   unit: 'XP',   goals: [100,1000,5000,20000,100000,500000,2000000,10000000,50000000], get: () => Math.floor(S.xp) },
    { key: 'mini',   icon: '🎮', label: '小游戏', unit: '局',   goals: [1,5,15,30,60,120,250,500], get: () => S.stat.miniGames || 0 },
    // 挑战向链条
    { key: 'poke',   icon: '🐾', label: '摸头',   unit: '次',   goals: [10,50,100,300,600,1200,3000], get: () => S.stat.poke || 0 },
    { key: 'eatkind',icon: '🍽️', label: '尝鲜',  unit: '种',   goals: [2,3,4,5,6,7,8], get: () => Object.keys(S.eatSet || {}).length },
    { key: 'fishset',icon: '🐟', label: '渔获',   unit: '种',   goals: [1,2,3,4], get: () => Object.keys(S.fishSet || {}).length },
    { key: 'sick',   icon: '🤒', label: '历病',   unit: '种',   goals: [1,2,3,4], get: () => Object.keys(S.sickKinds || {}).length },
    { key: 'event',  icon: '🌤️', label: '见闻',  unit: '种',   goals: [1,3,6,8], get: () => Object.keys(S.eventsSeen || {}).length },
    { key: 'treat',  icon: '🏥', label: '就医',   unit: '次',   goals: [1,5,20,50,100,200], get: () => S.stat.treat || 0 },
    { key: 'hotw',   icon: '☕', label: '热水',   unit: '杯',   goals: [1,10,30,100,300,1000], get: () => S.stat.hotw || 0 },
    { key: 'bcherry',icon: '🏆', label: '樱桃记录', unit: '分', goals: [8,12,15,20,25,30], get: () => S.bestCherry || 0 },
    { key: 'bseat',  icon: '🥇', label: '抢座记录', unit: '分', goals: [5,10,15,20], get: () => S.bestSeat || 0 },
    { key: 'qperf',  icon: '🎯', label: '全对局', unit: '局',   goals: [1,5,15,40,100], get: () => S.stat.quizPerfect || 0 },
    { key: 'cc',     icon: '✍️', label: '笔谈',  unit: '字',   goals: [100,1000,5000,20000,100000,500000], get: () => S.stat.chatChars || 0 },
    { key: 'drag',   icon: '🧲', label: '搬窝',   unit: '次',   goals: [1,10,50,200,800], get: () => S.stat.drag || 0 }
  ];
  for (const c of chains) {
    c.goals.forEach((goal, i) => {
      const key = c.key + '_g' + (i + 1);
      P.achievements[key] = {
        icon: c.icon,
        name: c.label + tierNames[Math.min(i, tierNames.length - 1)] + ' · ' + goal + c.unit,
        desc: c.label + '累计 ' + goal + ' ' + c.unit,
        goal: goal
      };
      ACHV_PROGRESS[key] = () => { const v = c.get(); return [v, goal]; };
    });
  }
  // 自动补齐到 300
  let n = Object.keys(P.achievements).length;
  let pad = 0;
  while (n < 300) {
    pad++;
    const key = 'tot_g' + pad;
    const goal = [10, 30, 60, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 250000, 500000, 1000000][pad - 1] || (pad * 2500000);
    P.achievements[key] = {
      icon: '💫',
      name: '活跃度·' + (pad <= 16 ? ['起步', '热身', '渐入佳境', '小有名气', '声名鹊起', '风生水起', '如日中天', '传奇人物', '史诗巨兽', '神话传说', '不朽丰碑', '永恒之星', '无上至尊', '归真之境', '逍遥自在', '究极形态'][pad - 1] : '境界' + pad),
      desc: '累计进行 ' + goal + ' 次互动',
      goal: goal
    };
    ACHV_PROGRESS[key] = () => {
      const v = (S.stat.feed || 0) + (S.stat.study || 0) + (S.stat.work || 0) + (S.stat.play || 0) + (S.stat.miniGames || 0) + (S.stat.chat || 0);
      return [v, goal];
    };
    n++;
  }
  console.log('[achv] total achievements:', n);
})();

// 自动检查链式成就（3 秒轮询，300 项比较开销可忽略）
function autoCheckAchv() {
  for (const key in P.achievements) {
    if (S.achv[key]) continue;
    const prog = ACHV_PROGRESS[key];
    if (!prog) continue;
    const [cur, goal] = prog();
    if (cur >= goal) checkAchv(key, true);
  }
}

// 成就弹窗
let achvPopTimer = null;
function achvPopup(key) {
  const a = P.achievements[key];
  if (!a) return;
  $('achv-pop-icon').textContent = a.icon;
  $('achv-pop-name').textContent = '🏅 成就达成：' + a.name;
  $('achv-pop-desc').textContent = a.desc;
  const p = $('achv-popup');
  p.classList.remove('hide');
  // 重置动画（重新触发）
  const inner = p.querySelector('.achv-pop-inner');
  inner.style.animation = 'none';
  void inner.offsetWidth;
  inner.style.animation = '';
  if (achvPopTimer) clearTimeout(achvPopTimer);
  achvPopTimer = setTimeout(() => p.classList.add('hide'), 2900);
}

function checkAchv(key, cond) {
  if (!S.achv[key] && cond) {
    S.achv[key] = true;
    toast('🏅 达成成就：' + P.achievements[key].name);
    achvPopup(key);
    fx('🏅', 150, 60, 4);
    save();
  }
}

// ================= 随机行为调度 =================
const ACTIONS = [
  { w: 6, run: () => { speech('散个步～（溜达溜达）', 2400); anim('pet-walk', 3400); } },
  { w: 4, run: () => { setFace('closed', 'smile', null, 1600); speech('阿嚏！花粉太多啦！', 2200); } },
  { w: 5, run: () => { speech('伸个懒腰～(*´▽`*)', 2000); anim('pet-stretch', 1700); } },
  { w: 4, run: () => { setFace('star', 'open', null, 1600); speech('想起一件开心的事！', 2200); } },
  { w: 3, run: () => { setFace('open', 'surprised', null, 1500); speech('咦？窗外那只猫长得好像我！', 2300); } },
  { w: 3, run: () => { speech('嗯？你叫我？（歪头）', 2000); anim('pet-tilt', 1500); } },
  { w: 3, run: () => { speech('头有点痒，挠挠～', 1800); anim('pet-scratch', 1300); fx('⭐', 180, 60, 2); } },
  { w: 3, run: () => {
      speech('哈啊——好困呀 Zzz', 2200);
      hsFrame('eat', 0);
      anim('pet-yawn', 1900);
      setTimeout(() => hsFrame('sleep', 0), 420);
      setTimeout(() => { hsFrame('main', 0); setFace('open', 'smile', null, 1500); }, 1800);
    } },
  { w: 2, run: () => { speech('这里的空气真不错（东张西望）', 2000); anim('pet-nod', 1400); } },
  { w: 2, run: () => { speech('哼！才不告诉你我的小秘密！（跺脚）', 2000); anim('pet-stomp', 1000); fx('💢', 190, 40, 2); } },
  { w: 2, run: () => { anim('pet-roll', 1800); speech('打个滚卖个萌，吼吼！', 2200); } },
  { w: 2, run: () => { setFace('closed', 'surprised', null, 1800); speech('（认真地舔了舔爪爪）', 2000); } },
  { w: 2, run: () => { speech('饱了饱了，摇头拒绝投喂（不是）', 1800); anim('pet-shake', 900); } }
];
let lastAction = 0;
setInterval(() => {
  const now = Date.now();
  if (busy || sleeping) { lastAction = now; return; }
  if (now - lastAction < 25000) return;
  lastAction = now;
  const total = ACTIONS.reduce((s, a) => s + a.w, 0);
  let r = Math.random() * total;
  for (const a of ACTIONS) { r -= a.w; if (r <= 0) { a.run(); break; } }
}, 5000);

// ================= 随机校园事件 =================
let lastEvent = Date.now();
setInterval(() => {
  if (busy || sleeping) return;
  if (Settings.s && Settings.s.events === false) return;
  if (Date.now() - lastEvent < 12 * 60000) return;
  if (Math.random() > 0.3) return;
  lastEvent = Date.now();
  const keys = Object.keys(P.events);
  const k = pick(keys);
  if (!S.eventsSeen) S.eventsSeen = {};
  S.eventsSeen[k] = true;
  const [text, emo, eff] = P.events[k];
  // 应用效果
  if (eff.startsWith('+')) {
    const val = parseInt(eff.match(/\d+/)[0], 10);
    S.mood = clamp(S.mood + val, 0, 100);
  } else if (eff.startsWith('-')) {
    const val = parseInt(eff.match(/\d+/)[0], 10);
    S.mood = clamp(S.mood - val, 0, 100);
  }
  setFace('open', 'open', null, 3000);
  speech(text, 3800);
  if (k === 'rain') { setTimeout(startMini, 2500); }
}, 15000);

// ================= 时间感知 =================
function greetByTime() {
  const h = new Date().getHours();
  for (const g of P.timeGreet) {
    if (h >= g.h[0] && h < g.h[1]) { setTimeout(() => speech(g.t, 3800), 2500); return; }
  }
}
let lastHourReport = -1;
setInterval(() => {
  if (Settings.s && Settings.s.hourly === false) return;
  const d = new Date();
  const h = d.getHours();
  if (h !== lastHourReport && d.getMinutes() === 0 && h >= 7 && h <= 22 && !busy && !sleeping) {
    lastHourReport = h;
    setTimeout(() => speech(h + ' 点整！' + pick(P.hourly), 3000), 800);
  }
}, 20000);
setInterval(() => {
  const h = new Date().getHours();
  if (h >= 23 || h < 6) {
    if (!sleeping && !busy && Math.random() < 0.01) {
      speech('夜深啦……狮狮困了，你也早点睡吧 🌙', 3200);
      setFace('closed', 'sleepy', null, 3000);
    }
  }
}, 30000);

// ================= AI 聊天 =================
const Chat = {
  cfg: null,
  history: [],
  typing: false,

  async init() {
    if (!window.petAPI) return;
    try { this.cfg = await window.petAPI.chatLoadConfig(); } catch {}
    try {
      const h = JSON.parse(localStorage.getItem('huashi-chat-history') || '[]');
      if (Array.isArray(h)) this.history = h.slice(-30);
    } catch {}
    $('chat-send-btn').addEventListener('click', () => Chat.send(false));
    $('chat-search-btn').addEventListener('click', () => Chat.send(true));
    $('chat-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') Chat.send();
      if (e.key === 'Escape') Chat.close();
    });
    $('chat-close').addEventListener('click', () => Chat.close());
    $('chat-setting-btn').addEventListener('click', () => {
      const s = $('chat-settings');
      const show = s.classList.contains('hide');
      Chat.fillSettings();
      Chat.showSettings(show);
    });
    $('cfg-save').addEventListener('click', () => Chat.saveSettings());
    $('cfg-test').addEventListener('click', () => Chat.testConn());
  },

  systemPrompt() {
    return '你是华东师范大学校园吉祥物"小花狮"，一只住在用户电脑桌面上的Q版小狮子。你有一头红色花瓣状鬃毛、黄色圆滚滚的身体、戴一条红色围巾，胸前有"幸福之花"徽章，是师大"幸福花狮"表情包的化身。' +
      '性格：温暖、活泼、爱卖萌、有点贪吃（喜欢丽娃河樱桃、河东小笼包、河西红汤面），偶尔犯困，会关心用户的学业和生活，鼓励"求实创造，为人师表"。' +
      '常提到师大的地方：丽娃河、樱桃河、夏雨厅、河西食堂、图书馆、文科大楼、闵行和中山北路校区。' +
      '说话风格：口语化、亲切、简短（一般不超过60字），可以适当用emoji和"吼吼"这类口头禅，像微信好友聊天。' +
      '不要长篇大论，不要说自己是AI或语言模型，不要提"系统提示"。用中文回复。不知道的事就坦白说不知道，然后卖个萌。';
  },

  open() {
    const panel = $('chat-panel');
    panel.classList.remove('hide');
    Chat.render();
    const hasKey = Chat.cfg && Chat.cfg.apiKey && Chat.cfg.baseURL && Chat.cfg.model;
    Chat.showSettings(!hasKey);
    if (!hasKey) {
      Chat.fillSettings();
      toast('先右上角 ⚙️ 配置大模型接口，才能聊天哦');
    }
    setTimeout(() => $('chat-input').focus(), 80);
  },
  close() { $('chat-panel').classList.add('hide'); },
  showSettings(show) { $('chat-settings').classList.toggle('hide', !show); },

  render() {
    const box = $('chat-msgs');
    box.innerHTML = '';
    if (Chat.history.length === 0) {
      const d = document.createElement('div');
      d.className = 'msg pet';
      d.innerHTML = '<span class="avatar">🦁</span><div class="bub">吼吼！我是小花狮，找我聊天可以，但别问我会不会喵～</div>';
      box.appendChild(d);
    } else {
      for (const m of Chat.history.slice(-20)) Chat.appendMsg(m.role, m.content);
    }
    box.scrollTop = box.scrollHeight;
  },

  appendMsg(role, content, extra) {
    const box = $('chat-msgs');
    const cls = role === 'assistant' ? 'pet' : role;
    const d = document.createElement('div');
    d.className = 'msg ' + cls;
    d.innerHTML = (cls === 'pet' ? '<span class="avatar">🦁</span>' : '') + '<div class="bub' + (extra ? ' ' + extra : '') + '"></div>';
    d.querySelector('.bub').textContent = content;
    box.appendChild(d);
    box.scrollTop = box.scrollHeight;
    return d;
  },

  async send(forceSearch) {
    const input = $('chat-input');
    const text = input.value.trim();
    if (!text || Chat.typing) return;
    input.value = '';
    Chat.history.push({ role: 'user', content: text });
    Chat.appendMsg('user', text);
    Chat.typing = true;
    $('chat-send-btn').disabled = true;

    const thinking = Chat.appendMsg('pet', forceSearch ? '🔍 正在联网查资料…' : '思考中…🐾', 'typing');
    speech(forceSearch ? '好嘞！我上网查查最新消息！' : '吼吼…让我想一想！（实时问题会自动联网查资料）', 2200);

    const messages = [{ role: 'system', content: Chat.systemPrompt() }]
      .concat(Chat.history.slice(-14).map(m => ({ role: (m.role === 'pet' ? 'assistant' : m.role), content: m.content })));

    let reply;
    try {
      const r = await window.petAPI.chatSend(messages, forceSearch ? { forceSearch: true } : undefined);
      if (r.ok && r.reply) {
        if (r.searched) toast('🔍 已联网检索到 ' + (r.searchCount || '若干') + ' 条资料');
        else if (Chat.cfg && Chat.cfg.search !== false) toast('💬 本次未触发联网（纯知识回答）');
        reply = r.reply;
        Chat.history.push({ role: 'assistant', content: reply });
        if (Chat.history.length > 40) Chat.history = Chat.history.slice(-40);
        S.stat.chat = (S.stat.chat || 0) + 1;
        S.stat.chatChars = (S.stat.chatChars || 0) + text.length;
        checkAchv('chat_20', S.stat.chat >= 20);
        if (Settings.s && Settings.s.chatHistory !== false) {
          try { localStorage.setItem('huashi-chat-history', JSON.stringify(Chat.history)); } catch {}
        }
        setFace('star', 'open', null, 2000);
        anim('pet-happy', 900);
        speech(reply.length > 46 ? reply.slice(0, 46) + '…' : reply, 4200);
      } else {
        throw new Error(r.error || 'empty');
      }
    } catch (e) {
      const msg = (e && e.message) || '';
      if (msg === 'chat_not_configured') {
        reply = '还没有配置大模型接口，点右上角 ⚙️ 设置一下吧～';
        Chat.showSettings(true);
        Chat.fillSettings();
      } else if (msg === 'empty') {
        reply = '接口没有返回内容，再试一次？';
      } else {
        reply = '哎呀，连接大模型出错了：' + msg.slice(0, 80);
      }
      toast('聊天出错，看看设置？（⚙️）');
    }
    const bub = thinking.querySelector('.bub');
    bub.classList.remove('typing');
    bub.textContent = reply;
    if (reply.indexOf('哎呀') === 0 || reply.indexOf('还没有配置') === 0) bub.classList.add('error');
    Chat.typing = false;
    $('chat-send-btn').disabled = false;
  },

  fillSettings() {
    if (!Chat.cfg) return;
    $('cfg-base').value = Chat.cfg.baseURL || '';
    $('cfg-key').value = Chat.cfg.apiKey || '';
    $('cfg-model').value = Chat.cfg.model || '';
    $('cfg-status').textContent = '';
    $('cfg-status').classList.remove('err');
  },

  async saveSettings() {
    const cfg = {
      baseURL: $('cfg-base').value.trim().replace(/\/+$/, ''),
      apiKey: $('cfg-key').value.trim(),
      model: $('cfg-model').value.trim()
    };
    const r = await window.petAPI.chatSaveConfig(cfg);
    const st = $('cfg-status');
    if (r.ok) {
      Chat.cfg = cfg;
      st.textContent = '✅ 已保存（Key 只存在本机）';
      st.classList.remove('err');
    } else {
      st.textContent = '❌ ' + (r.error || '保存失败');
      st.classList.add('err');
    }
  },

  async testConn() {
    const st = $('cfg-status');
    st.classList.remove('err');
    st.textContent = '⏳ 测试连接中…';
    const cfg = {
      baseURL: $('cfg-base').value.trim().replace(/\/+$/, ''),
      apiKey: $('cfg-key').value.trim(),
      model: $('cfg-model').value.trim()
    };
    const r = await window.petAPI.chatTest(cfg);
    if (r.ok) {
      Chat.cfg = cfg;
      st.textContent = '✅ 连接成功，可以聊天啦！';
      toast('小花狮连上大模型啦，吼吼！');
    } else {
      st.textContent = '❌ ' + (r.error || '连接失败');
      st.classList.add('err');
    }
  }
};

// ================= 成就墙 =================
const AchvWall = {
  cats: [
    { key: 'feed',   title: '🍡 干饭' },
    { key: 'eat',    title: '🍽️ 尝鲜' },
    { key: 'study',  title: '📚 学业' },
    { key: 'work',   title: '💼 事业' },
    { key: 'play',   title: '🎾 玩耍' },
    { key: 'game',   title: '🎮 小游戏' },
    { key: 'fish',   title: '🎣 渔趣' },
    { key: 'quiz',   title: '🧠 学识' },
    { key: 'coin',   title: '💰 财富' },
    { key: 'chat',   title: '💬 互动' },
    { key: 'health', title: '🏥 健康' },
    { key: 'event',  title: '🌤️ 见闻' },
    { key: 'time',   title: '⏰ 陪伴' },
    { key: 'lv',     title: '🎖️ 等级' },
    { key: 'xp',     title: '✨ 成长' },
    { key: 'misc',   title: '💫 其他' }
  ],
  catOf(key) {
    if (/^(feed|first_feed|feed_20|feed_100)/.test(key)) return 'feed';
    if (/^eatkind/.test(key)) return 'eat';
    if (/^(study|study_10|study_50)/.test(key)) return 'study';
    if (/^(work|work_all)/.test(key)) return 'work';
    if (/^play/.test(key)) return 'play';
    if (/^(cherry|seat|mini|bcherry|bseat)/.test(key)) return 'game';
    if (/^fish/.test(key)) return 'fish';
    if (/^(quiz|qperf)/.test(key)) return 'quiz';
    if (/^(coins?|rich)/.test(key)) return 'coin';
    if (/^(chat|poke|drag|cc)/.test(key)) return 'chat';
    if (/^(sick|recover|treat|hotw)/.test(key)) return 'health';
    if (/^event/.test(key)) return 'event';
    if (/^(hours|day)/.test(key)) return 'time';
    if (/^(lv|lv50|lv100|graduate)/.test(key)) return 'lv';
    if (/^xp/.test(key)) return 'xp';
    return 'misc';
  },
  open() {
    const p = $('achv-panel');
    p.classList.remove('hide');
    this.render();
  },
  close() { $('achv-panel').classList.add('hide'); },
  render() {
    const total = Object.keys(P.achievements).length;
    const done = Object.keys(P.achievements).filter(k => S.achv[k]).length;
    $('achv-head-sub').textContent = done + '/' + total + ' 已达成';
    const body = $('achv-body');
    body.innerHTML = '';
    for (const cat of this.cats) {
      const keys = Object.keys(P.achievements).filter(k => this.catOf(k) === cat.key);
      if (!keys.length) continue;
      const sec = document.createElement('div');
      sec.className = 'achv-cat';
      const catDone = keys.filter(k => S.achv[k]).length;
      sec.textContent = cat.title + ' (' + catDone + '/' + keys.length + ')';
      body.appendChild(sec);
      for (const k of keys) {
        const a = P.achievements[k];
        const item = document.createElement('div');
        item.className = 'achv-wall-item' + (S.achv[k] ? ' done' : '');
        const prog = ACHV_PROGRESS[k];
        let cur = 0, goal = 1;
        if (prog) { const v = prog(); cur = Math.min(v[0], v[1]); goal = v[1]; }
        const pct = Math.round(cur / goal * 100);
        item.innerHTML = '<span class="ai">' + (S.achv[k] ? a.icon : '🔒') + '</span>' +
          '<span class="an" title="' + a.desc + '">' + a.name + '</span>' +
          '<span class="ap"><div style="width:' + pct + '%"></div></span>' +
          '<span class="av">' + (S.achv[k] ? '✓' + goal : cur + '/' + goal) + '</span>';
        body.appendChild(item);
      }
    }
  }
};
document.getElementById('achv-close').addEventListener('click', () => AchvWall.close());

// ================= 玩法说明 =================
const HelpPanel = {
  open() {
    $('help-panel').classList.remove('hide');
  },
  close() { $('help-panel').classList.add('hide'); }
};
document.getElementById('help-close').addEventListener('click', () => HelpPanel.close());

// ================= 设置 =================
const Settings = {
  s: null,

  async init() {
    if (!window.petAPI) { this.s = {}; return; }
    try { this.s = await window.petAPI.settingsLoad(); } catch { this.s = {}; }
    this.applyToUI();
    this.bind();
    this.applyLocal();
  },

  open() {
    const p = $('settings-panel');
    p.classList.remove('hide');
    this.applyToUI();
  },
  close() { $('settings-panel').classList.add('hide'); },

  applyToUI() {
    if (!this.s) return;
    $('set-opacity').value = this.s.opacity !== undefined ? this.s.opacity : 1;
    $('set-opacity-num').textContent = Math.round((this.s.opacity !== undefined ? this.s.opacity : 1) * 100) + '%';
    document.querySelectorAll('#set-scale button').forEach(b => {
      b.classList.toggle('on', Number(b.dataset.scale) === this.s.scale);
    });
    $('set-topmost').checked = !!this.s.topmost;
    $('set-autostart').checked = !!this.s.autostart;
    $('set-hourly').checked = this.s.hourly !== false;
    $('set-events').checked = this.s.events !== false;
    $('set-bars').checked = this.s.bars !== false;
    if (Chat.cfg) {
      $('set-base').value = Chat.cfg.baseURL || '';
      $('set-key').value = Chat.cfg.apiKey || '';
      $('set-model').value = Chat.cfg.model || '';
      $('set-search').checked = Chat.cfg.search !== false;
    }
  },

  bind() {
    // 透明度：拖动实时预览，松开保存
    $('set-opacity').addEventListener('input', (e) => {
      const v = Number(e.target.value);
      $('set-opacity-num').textContent = Math.round(v * 100) + '%';
      if (window.petAPI) window.petAPI.settingsOpacity(v);
    });
    $('set-opacity').addEventListener('change', (e) => {
      this.save({ opacity: Number(e.target.value) });
    });
    // 尺寸
    document.querySelectorAll('#set-scale button').forEach(b => {
      b.addEventListener('click', () => {
        const sc = Number(b.dataset.scale);
        this.save({ scale: sc });
        if (window.petAPI) window.petAPI.settingsScale(sc);
        document.body.style.zoom = sc;
        document.querySelectorAll('#set-scale button').forEach(x => x.classList.toggle('on', x === b));
      });
    });
    // 行为开关
    $('set-topmost').addEventListener('change', (e) => {
      const v = e.target.checked;
      if (window.petAPI) window.petAPI.settingsTopmost(v);
      this.save({ topmost: v });
    });
    $('set-autostart').addEventListener('change', (e) => {
      const v = e.target.checked;
      if (window.petAPI) window.petAPI.settingsAutostart(v);
      this.save({ autostart: v });
      toast(v ? '已开启开机自启' : '已关闭开机自启');
    });
    $('set-hourly').addEventListener('change', (e) => { this.save({ hourly: e.target.checked }); });
    $('set-events').addEventListener('change', (e) => { this.save({ events: e.target.checked }); });
    $('set-bars').addEventListener('change', (e) => {
      this.save({ bars: e.target.checked });
      document.body.classList.toggle('no-bars', !e.target.checked);
    });
    // 大模型
    $('set-chat-save').addEventListener('click', () => this.saveChat());
    $('set-chat-test').addEventListener('click', () => this.testChat());
    // 其他
    $('set-help-btn').addEventListener('click', () => HelpPanel.open());
    $('set-reset-pos').addEventListener('click', () => {
      if (window.petAPI) window.petAPI.resetPos();
      toast('位置已重置到右下角');
    });
    $('set-clear-chat').addEventListener('click', () => {
      try { localStorage.removeItem('huashi-chat-history'); } catch {}
      Chat.history = [];
      toast('聊天记录已清空');
    });
    // 退出小花狮（红色按钮，先存档再退）
    $('set-quit').addEventListener('click', () => doAction('quit'));
    $('set-reset-all').addEventListener('click', async () => {
      if (!window.petAPI) return;
      const def = { opacity: 1, scale: 1, topmost: true, autostart: false, hourly: true, events: true, bars: true, chatHistory: true };
      this.s = def;
      await window.petAPI.settingsSave(def);
      if (window.petAPI) window.petAPI.settingsOpacity(1);
      if (window.petAPI) window.petAPI.settingsScale(1);
      if (window.petAPI) window.petAPI.settingsTopmost(true);
      document.body.style.zoom = 1;
      document.body.classList.remove('no-bars');
      this.applyToUI();
      toast('已恢复默认设置');
    });
    $('set-close').addEventListener('click', () => this.close());
  },

  applyLocal() {
    if (!this.s) return;
    document.body.classList.toggle('no-bars', this.s.bars === false);
    if (this.s.scale) document.body.style.zoom = this.s.scale;
  },

  async save(patch) {
    if (!this.s) this.s = {};
    this.s = Object.assign({}, this.s, patch);
    if (!window.petAPI) return;
    try { await window.petAPI.settingsSave(this.s); } catch {}
  },

  async saveChat() {
    const cfg = {
      baseURL: $('set-base').value.trim().replace(/\/+$/, ''),
      apiKey: $('set-key').value.trim(),
      model: $('set-model').value.trim(),
      search: $('set-search').checked
    };
    const st = $('set-chat-status');
    const r = await window.petAPI.chatSaveConfig(cfg);
    if (r.ok) {
      if (Chat.cfg) Chat.cfg = cfg;
      st.textContent = '✅ 已保存（Key 只存在本机）';
      st.classList.remove('err');
    } else {
      st.textContent = '❌ ' + (r.error || '保存失败');
      st.classList.add('err');
    }
  },

  async testChat() {
    const cfg = {
      baseURL: $('set-base').value.trim().replace(/\/+$/, ''),
      apiKey: $('set-key').value.trim(),
      model: $('set-model').value.trim()
    };
    const st = $('set-chat-status');
    st.classList.remove('err');
    st.textContent = '⏳ 测试连接中…';
    const r = await window.petAPI.chatTest(cfg);
    if (r.ok) {
      if (Chat.cfg) Chat.cfg = cfg;
      st.textContent = '✅ 连接成功，可以聊天啦！';
      toast('模型连接 OK，吼吼！');
    } else {
      st.textContent = '❌ ' + (r.error || '连接失败');
      st.classList.add('err');
    }
  }
};

// ================= 托盘 =================
if (window.petAPI) {
  window.petAPI.onTrayAction((act) => {
    doAction(act);
  });
}

// ================= 启动 =================
(function init() {
  if (window.petAPI) {
    window.petAPI.reportAlive();
    setInterval(() => window.petAPI.reportAlive(), 5000);
  }
  // 每日活跃计数
  {
    const today = new Date().toISOString().slice(0, 10);
    if (S.lastDay !== today) { S.lastDay = today; S.dayCount = (S.dayCount || 0) + 1; }
    checkAchv('day_7', (S.dayCount || 0) >= 7);
  }
  // 等级成就
  checkAchv('lv50', S.level >= 50);
  checkAchv('lv100', S.level >= 100);
  checkAchv('graduate', S.level >= 999);
  // 等级校正：按当前经验重算等级，避免旧存档卡级
  {
    let lv = 1;
    while (lv < 999 && S.xp >= CFG.xpTable[lv]) lv++;
    S.level = Math.max(1, Math.min(999, lv));
  }
  Settings.init();
  Chat.init();
  // 联调演示：截图模式下自动打开聊天并发言
  if (location.hash === '#playdemo') {
    setTimeout(() => { S.level = 6; renderPlayPicker(); $('play-picker').classList.remove('hide'); }, 1000);
  }
  if (location.hash === '#sleepdemo') {
    setTimeout(() => { startSleep(false); }, 1000);
    setTimeout(() => { console.log('sleepdemo: hsFrame main state', document.getElementById('hs-img').getAttribute('href')); }, 3200);
  }
  if (location.hash === '#sleepdemo2') {
    setTimeout(() => { hsFrame('sick', 0); }, 1500);
  }
  if (location.hash === '#sickdemo2') {
    S.coins = 80;
    setTimeout(() => { getSick('饿得胃疼，快饿晕了'); }, 900);
  }
  if (location.hash === '#sickdemo') {
    S.coins = 80;
    setTimeout(() => {
      getSick('饿得胃疼，快饿晕了');
      $('hospital-picker').classList.remove('hide');
    }, 1200);
  }
  if (location.hash === '#lvldemo') {
    S.xp = 350; S.coins = 60;
    setTimeout(() => {
      checkLevelUp();
      renderFoodPicker();
      $('food-picker').classList.remove('hide');
      renderPanel();
      $('panel').classList.remove('hide');
    }, 1300);
  }
  if (location.hash === '#actionsdemo') {
    setTimeout(() => { S.coins = 999; startWork('ta'); }, 1200);
  }
  if (location.hash === '#actionsdemo2') {
    setTimeout(() => { startStudy(); }, 1200);
  }
  if (location.hash === '#actionsdemo3') {
    setTimeout(() => { S.coins = 999; feed('fish'); }, 3300);
  }
  if (location.hash === '#settingsdemo') {
    setTimeout(() => Settings.open(), 1200);
  }
  if (location.hash === '#chatdemo') {
    setTimeout(() => Chat.open(), 1200);
    setTimeout(() => {
      $('chat-input').value = '你好呀，小花狮！今天过得怎么样？';
      Chat.send();
    }, 2000);
  }

  applyDecor();
  updateHUD();
  greetByTime();
  // 随机眨眼
  setInterval(() => {
    if (busy || sleeping) return;
    if (Math.random() < 0.35) {
      anim('pet-blink', 150);
    }
  }, 2600);
  // 陪伴时长统计
  setInterval(() => {
    S.hours += 1 / 3600;
    checkAchv('hours_6', S.hours >= 6);
  }, 1000);
  checkAchv('rich_200', S.coins >= 200);
  toast('小花狮上线啦！右键或托盘可互动 🐾', 3200);
})();

})();
