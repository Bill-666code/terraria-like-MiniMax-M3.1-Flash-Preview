/* ==========================================================================
   ui.js —— 物品栏 / 合成 / 熔炉 / 箱子 / 提示
   ========================================================================== */
(function (T) {
'use strict';
const W = T.W, TID = T.TID, IID = T.IID, E = T.E;
const UI = {};
T.UI = UI;

const $ = (id) => document.getElementById(id);
let panel, invGrid, hotbarRow, craftCol, invTitle, tip, toastEl, bannerEl, chestWrap;
let cursor = null;                 // 鼠标上拿着的物品
let mode = 'inv';
let chestData = null;
let invSlots = [], hotSlots = [], chestSlots = [];
const urlCache = {};

function iconUrl(id) {
  if (urlCache[id]) return urlCache[id];
  const c = T.Tex.item[id];
  if (!c) return '';
  const u = c.toDataURL();
  urlCache[id] = u;
  return u;
}
UI.iconUrl = iconUrl;

/* ------------------------------------------------------------------
   初始化
------------------------------------------------------------------ */
UI.init = function () {
  panel = $('invPanel'); invGrid = $('invGrid'); hotbarRow = $('hotbarRow');
  craftCol = $('craftCol'); invTitle = $('invTitle'); tip = $('tip');
  toastEl = $('toast'); bannerEl = $('banner');
  chestWrap = document.createElement('div');
  chestWrap.className = 'hidden';

  for (let i = 0; i < 40; i++) invSlots.push(makeSlot(invGrid, i, 'inv'));
  hotbarRow.className = 'grid';
  hotbarRow.style.gridTemplateColumns = 'repeat(10,44px)';
  invGrid.className = 'grid';
  invGrid.style.gridTemplateColumns = 'repeat(10,44px)';
  for (let i = 0; i < 10; i++) hotSlots.push(makeSlot(hotbarRow, i, 'inv'));
  const invCol = document.getElementById('invCol');
  const labInv = document.createElement('div');
  labInv.className = 'sect'; labInv.textContent = '背包';
  invCol.insertBefore(labInv, invGrid);
  const labHot = document.createElement('div');
  labHot.className = 'sect'; labHot.textContent = '快捷栏（1~0 切换）';
  invCol.insertBefore(labHot, hotbarRow);

  $('btnRespawn').onclick = () => { $('deadScreen').classList.add('hidden'); E.respawn(); };
  document.addEventListener('contextmenu', (e) => { if (UI.open || e.target.closest('#invPanel')) e.preventDefault(); });
  document.addEventListener('mousemove', (e) => {
    T.input.mx = e.clientX; T.input.my = e.clientY;
  });
  document.addEventListener('mousedown', (e) => {
    if (e.target.closest('#invPanel') || e.target.closest('#screen') || e.target.closest('#deadScreen')) return;
    if (e.button === 2) T.input.clicked[2] = true;
  });
  panel.addEventListener('mouseleave', () => tip.classList.add('hidden'));
};

/* ------------------------------------------------------------------
   格子
------------------------------------------------------------------ */
function makeSlot(parent, idx, kind) {
  const d = document.createElement('div');
  d.className = 'slot';
  const img = document.createElement('img');
  const num = document.createElement('span');
  num.className = 'n';
  d.appendChild(img); d.appendChild(num);
  img.style.display = 'none';
  parent.appendChild(d);
  d.addEventListener('mousedown', (ev) => {
    ev.preventDefault(); ev.stopPropagation();
    slotClick(kind, idx, ev.button, ev.shiftKey);
  });
  d.addEventListener('mouseenter', () => showTip(kind, idx, d));
  return { el: d, img: img, n: num };
}
function paintSlot(s, stack, hot) {
  if (stack) {
    s.img.style.display = '';
    s.img.src = iconUrl(stack.id);
    s.n.textContent = stack.n > 1 ? stack.n : '';
  } else {
    s.img.style.display = 'none';
    s.n.textContent = '';
  }
  s.el.classList.toggle('fav', !!hot);
}

function targetList(kind) {
  if (kind === 'chest') return chestData.items;
  return E.P.inv.slots;
}
function targetIndex(kind, idx) { return idx; }

function slotClick(kind, idx, button, shift) {
  const list = targetList(kind);
  if (kind === 'chest' && !chestData) return;
  const p = E.P;
  const isInv = kind === 'inv';

  /* 快速移动 */
  if (shift) {
    const s = list[idx];
    if (!s) return;
    if (kind === 'chest') quickMove(s, p.inv.slots, 0, 39);
    else if (mode === 'chest') quickMove(s, chestData.items, 0, 19);
    else quickMove(s, p.inv.slots, 10, 39);
    UI.refresh();
    return;
  }
  /* 拆分 */
  if (button === 2) {
    if (cursor) {
      const list2 = list;
      if (!list2[idx]) { list2[idx] = { id: cursor.id, n: 1 }; cursor.n--; if (cursor.n <= 0) cursor = null; }
      else if (list2[idx].id === cursor.id && list2[idx].n < T.item(cursor.id).stack) { list2[idx].n++; cursor.n--; if (cursor.n <= 0) cursor = null; }
    } else {
      const s = list[idx];
      if (!s) return;
      const half = Math.ceil(s.n / 2);
      cursor = { id: s.id, n: half };
      s.n -= half;
      if (s.n <= 0) list[idx] = null;
    }
    T.snd.play('pickup', .3);
    UI.refresh();
    return;
  }
  const cur = list[idx];
  if (!cursor) {
    if (cur) { cursor = cur; list[idx] = null; }
  } else if (!cur) {
    list[idx] = cursor; cursor = null;
  } else if (cur.id === cursor.id) {
    const room = T.item(cur.id).stack - cur.n;
    const give = Math.min(room, cursor.n);
    cur.n += give; cursor.n -= give;
    if (cursor.n <= 0) cursor = null;
  } else {
    list[idx] = cursor; cursor = cur;
  }
  UI.refresh();
}
/* 把一个堆叠并入 dest 的 [from,to] 区间 */
function quickMove(s, dest, from, to) {
  const max = T.item(s.id).stack;
  for (let i = from; i <= to; i++) {
    const d = dest[i];
    if (d && d.id === s.id && d.n < max) {
      const give = Math.min(max - d.n, s.n);
      d.n += give; s.n -= give;
      if (s.n <= 0) return;
    }
  }
  for (let i = from; i <= to; i++) {
    if (!dest[i]) { dest[i] = s; return; }
  }
}
UI.dropCursor = function () {
  if (cursor && E.P) {
    E.spawnDrop(E.P.x + 6, E.P.y, cursor.id, cursor.n);
    cursor = null;
  }
};

/* ------------------------------------------------------------------
   提示
------------------------------------------------------------------ */
function showTip(kind, idx, el) {
  const list = targetList(kind);
  if (kind === 'chest' && !chestData) return;
  const s = list[idx];
  if (!s) { tip.classList.add('hidden'); return; }
  const d = T.item(s.id);
  let html = '<b>' + d.name + '</b>';
  if (d.type === 'tool') html += '<span class="st">' + (d.kind === 'pick' ? '镐' : '斧') + ' · 采集等级 ' + d.tier + ' · 伤害 ' + d.dmg + '</span>';
  if (d.type === 'weapon') html += '<span class="st">近战武器 · 伤害 ' + d.dmg + ' · 击退 ' + d.knock + '</span>';
  if (d.type === 'food') html += '<span class="st">食用 · 恢复 ' + d.heal + ' 生命</span>';
  if (d.type === 'block') html += '<span class="st">可放置方块</span>';
  if (d.type === 'junk') html += '<span class="d">' + (d.desc || '') + '</span>';
  if (d.desc && d.type !== 'junk' && d.type !== 'food') html += '<span class="d">' + d.desc + '</span>';
  html += '<span class="d">左键拿起 · 右键拆分 · Shift+左键快速移动</span>';
  tip.innerHTML = html;
  tip.classList.remove('hidden');
  if (el) {
    const b = el.getBoundingClientRect();
    tip.style.left = Math.min(window.innerWidth - 272, b.left + b.width + 8) + 'px';
    tip.style.top = Math.max(8, b.top - 10) + 'px';
  }
}

/* ------------------------------------------------------------------
   打开 / 关闭
------------------------------------------------------------------ */
UI.toggle = function (force) {
  const open = force === undefined ? !UI.open : force;
  UI.open = open;
  panel.classList.toggle('hidden', !open);
  if (open) {
    mode = 'inv'; chestData = null;
    chestWrap.classList.add('hidden');
    UI.refresh();
    T.snd.play('open', .5);
  } else {
    chestData = null;
    UI.dropCursor();
    tip.classList.add('hidden');
  }
};

UI.openChest = function (key, x, y) {
  let data = W.chests.get(key);
  if (!data) {
    data = { items: [] };
    W.chests.set(key, data);
    fillChestLoot(data, y);
  }
  chestData = data;
  mode = 'chest';
  UI.open = true;
  panel.classList.remove('hidden');
  chestWrap.classList.remove('hidden');
  T.snd.play('chest');
  UI.refresh();
};

function fillChestLoot(data, depthY) {
  const deep = depthY > 200;
  const pick = (id, n) => { if (id && T.rnd() < (deep ? .8 : .6)) data.items.push({ id: id, n: n || 1 + (T.rnd() * 3 | 0) }); };
  pick(IID.WOOD, 4 + (T.rnd() * 12 | 0));
  pick(IID.GEL, 2 + (T.rnd() * 4 | 0));
  pick(IID.TORCH, 6 + (T.rnd() * 12 | 0));
  pick(IID.COPPER_ORE, 5 + (T.rnd() * 10 | 0));
  pick(IID.IRON_ORE, 3 + (T.rnd() * 8 | 0));
  pick(IID.COPPER_BAR, 1 + (T.rnd() * 3 | 0));
  if (deep) { pick(IID.IRON_BAR, 1 + (T.rnd() * 3 | 0)); pick(IID.GOLD_ORE, 1 + (T.rnd() * 4 | 0)); pick(IID.AMETHYST, 1 + (T.rnd() * 3 | 0)); }
  if (T.rnd() < .35) pick(IID.IRON_PICK, 1);
  else if (T.rnd() < .25) pick(IID.COPPER_SWORD, 1);
  pick(IID.MUSHROOM, 2 + (T.rnd() * 4 | 0));
  if (T.rnd() < .12) pick(IID.GOLD_BAR, 1);
}

/* ------------------------------------------------------------------
   刷新
------------------------------------------------------------------ */
UI.refresh = function () {
  if (!UI.open) return;
  const p = E.P;
  invTitle.textContent = mode === 'chest' ? '箱子' : '物品栏';
  for (let i = 0; i < 40; i++) paintSlot(invSlots[i], p.inv.slots[i], i < 10);
  for (let i = 0; i < 10; i++) paintSlot(hotSlots[i], p.inv.slots[i], true);
  if (mode === 'chest' && chestData) {
    chestWrap.classList.remove('hidden');
    if (!chestWrap.isConnected) {
      const col = document.getElementById('invCol');
      col.insertBefore(chestWrap, col.firstChild);
      for (let i = 0; i < 20; i++) chestSlots.push(makeSlot(chestGrid(), i, 'chest'));
      const lab = document.createElement('div');
      lab.className = 'sect'; lab.textContent = '箱子';
      col.insertBefore(lab, chestWrap);
    }
    for (let i = 0; i < 20; i++) paintSlot(chestSlots[i], chestData.items[i], false);
  } else {
    chestWrap.classList.add('hidden');
  }
  renderCraft();
};
let _chestGrid = null;
function chestGrid() {
  if (!_chestGrid) {
    _chestGrid = document.createElement('div');
    _chestGrid.className = 'grid';
    _chestGrid.style.gridTemplateColumns = 'repeat(10,44px)';
    chestWrap.appendChild(_chestGrid);
  }
  return _chestGrid;
}

function stationOK(st) {
  const p = E.P;
  if (st === 'hand') return true;
  if (st === 'bench') return W.hasBench(p.x + p.w / 2, p.y + p.h / 2, 5);
  if (st === 'furnace') return W.hasFurnace(p.x + p.w / 2, p.y + p.h / 2, 5);
  return true;
}

function canCraft(r) {
  const p = E.P;
  for (const id in r.need) {
    if (p.inv.count(+id) < r.need[id]) return false;
  }
  if (r.fuel && p.inv.count(IID.WOOD) < 1 && p.inv.count(IID.TORCH) < 1) return false;
  if (!stationOK(r.station)) return false;
  return true;
}

function renderCraft() {
  const p = E.P;
  const hasB = W.hasBench(p.x + 6, p.y + 14, 5);
  const hasF = W.hasFurnace(p.x + 6, p.y + 14, 5);
  let html = '';
  html += '<div class="sect">合成</div>';
  html += '<div style="font-size:11.5px;color:#9b95ad;margin-bottom:6px">工作台：<b style="color:' +
    (hasB ? '#8fe08a' : '#e07a7a') + '">' + (hasB ? '就绪' : '未就绪') + '</b>　熔炉：<b style="color:' +
    (hasF ? '#8fe08a' : '#e07a7a') + '">' + (hasF ? '就绪' : '未就绪') + '</b></div>';
  let shown = 0;
  for (let i = 0; i < T.recipes.length; i++) {
    const r = T.recipes[i];
    const near = stationOK(r.station);
    const ok = canCraft(r);
    if (!near && r.station !== 'hand') continue;
    shown++;
    const def = T.item(r.out.id);
    let need = '';
    for (const id in r.need) {
      const have = p.inv.count(+id);
      const good = have >= r.need[id];
      need += '<span style="color:' + (good ? '#cfc6a5' : '#e07a7a') + '">' + T.item(+id).name + ' ' +
        have + '/' + r.need[id] + '</span>　';
    }
    if (r.fuel) need += '<span style="color:#9b95ad">（消耗 1 木头/火把）</span>';
    html += '<div class="recipe' + (ok ? '' : ' off') + '" data-r="' + i + '">' +
      '<img src="' + iconUrl(r.out.id) + '">' +
      '<div class="nm"><b style="color:#f0d9a0">' + def.name + (r.out.n > 1 ? ' ×' + r.out.n : '') + '</b><br>' + need +
      (r.tip ? '<small>' + r.tip + '</small>' : '') + '</div>' +
      '<div class="' + (ok ? 'ok' : 'no') + '">' + (ok ? '制作' : (near ? '材料不足' : '缺工作台')) + '</div></div>';
  }
  craftCol.innerHTML = html;
  craftCol.querySelectorAll('.recipe').forEach((el) => {
    el.addEventListener('click', () => doCraft(+el.dataset.r));
  });
}
UI.renderCraft = renderCraft;

function doCraft(i) {
  const r = T.recipes[i];
  if (!canCraft(r)) return;
  for (const id in r.need) E.P.inv.remove(+id, r.need[id]);
  if (r.fuel) {
    if (E.P.inv.count(IID.WOOD) > 0) E.P.inv.remove(IID.WOOD, 1);
    else E.P.inv.remove(IID.TORCH, 1);
  }
  const left = E.P.inv.add(r.out.id, r.out.n);
  if (left > 0) E.spawnDrop(E.P.x + 6, E.P.y, r.out.id, left);
  T.snd.play('craft');
  if (r.station === 'furnace') { T.snd.play('smelt', .5); E.burst(E.P.x + 6, E.P.y + 8, 8, { col: ['#ff9b2f', '#ffd964'], sp: 1.4, life: .5, type: 'dust' }); }
  UI.refresh();
  UI.toast('制作了 ' + T.item(r.out.id).name + (r.out.n > 1 ? ' ×' + r.out.n : ''));
}

UI.craft = doCraft;

/* ------------------------------------------------------------------
   提示条 / 横幅
------------------------------------------------------------------ */
let toastT = 0;
UI.toast = function (msg) {
  toastEl.textContent = msg;
  toastEl.style.opacity = 1;
  toastT = 1.6;
};
let bannerT = 0;
UI.banner = function (msg, dur) {
  bannerEl.innerHTML = msg;
  bannerEl.style.opacity = 1;
  bannerT = dur || 3.2;
};
UI.update = function (dt) {
  if (toastT > 0) { toastT -= dt; if (toastT <= 0) toastEl.style.opacity = 0; }
  if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) bannerEl.style.opacity = 0; }
};
UI.onDeath = function () {
  $('deadScreen').classList.remove('hidden');
  $('deadMsg').textContent = '你在第 ' + T.G.day + ' 天的 ' + T.fmtTime(T.G.time) + ' 倒下了';
  if (UI.open) UI.toggle(false);
};

})(window.T);
