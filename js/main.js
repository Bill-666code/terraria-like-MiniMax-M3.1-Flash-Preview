/* ==========================================================================
   main.js —— 启动 / 主循环 / 输入 / 挖放 / 昼夜 / 存档
   ========================================================================== */
(function (T) {
'use strict';
const W = T.W, E = T.E, TID = T.TID, IID = T.IID, R = T.R, UI = T.UI, TS = 16;

const DAY_LEN = 720;          // 一整天 = 12 分钟
const G = {
  time: 0.08, day: 1, night: false, bloodMoon: false,
  spawnT: 2, camX: 0, camY: 0, mining: null, aimAngle: 0,
  showMap: true, paused: false, started: false, nextBlood: 0,
  hints: {}
};
T.G = G;

let cv, ctx, last = 0, acc = 0, saveT = 0, uiRefreshT = 0, fpsAcc = 0, fpsN = 0;

/* ------------------------------------------------------------------
   启动
------------------------------------------------------------------ */
function boot() {
  T.Tex.build();
  cv = document.getElementById('game');
  ctx = cv.getContext('2d');
  R.init();
  UI.init();
  bindInput();

  const save = loadSave();
  if (save) document.getElementById('btnLoad').classList.remove('hidden');
  else document.getElementById('btnNew').textContent = '开始新世界';

  const q = new URLSearchParams(location.search);
  const seedQ = q.get('seed');
  newWorld(seedQ ? (+seedQ | 0) : Math.floor(Math.random() * 1e9), false);
  if (q.get('t')) G.time = +q.get('t');

  document.getElementById('btnNew').onclick = () => {
    const s = Math.floor(Math.random() * 1e9);
    clearSave();
    newWorld(s, true);
  };
  document.getElementById('btnLoad').onclick = () => {
    const s = loadSave();
    if (s) { W.deserialize(s.world); restorePlayer(s.player); G.time = s.p.time; G.day = s.p.day; G.bloodMoon = false; }
    start();
  };
  if (q.get('auto') === '1') {
    document.getElementById('screen').classList.add('hidden');
    G.started = true;
    if (q.get('give')) {
      const ids = q.get('give').split(',');
      for (const it of ids) { const [id, n] = it.split('*'); E.P.inv.add(+id, +(n || 1)); }
    }
    if (q.get('inv')) UI.toggle(true);
  }
  qDebug = q.get('debug') === '1';
  G.only = q.get('only') || '';
  if (q.get('act')) runActions(q.get('act').split(','));
  if (q.get('perf')) {                 /* 渲染耗时（毫秒/帧） */
    const n = +q.get('perf');
    for (let i = 0; i < 10; i++) R.draw(1 / 60);
    const t0 = performance.now();
    for (let i = 0; i < n; i++) { R.updateCam(1 / 60); R.draw(1 / 60); }
    G.perf = (performance.now() - t0) / n;
  }
  if (q.get('warm')) {                    /* 调试：快进 N 秒 */
    const n = +q.get('warm');
    for (let i = 0; i < n * 60; i++) {
      update(1 / 60);
      if (i % 30 === 0) { W.processLight(); W.updateLiquid(3000); }
    }
    W.processLight(); W.updateLiquid(6000);
  }

  requestAnimationFrame(loop);
}

function newWorld(s, go) {
  W.setSeed(s);
  E.mobs.length = 0; E.drops.length = 0; E.parts.length = 0;
  G.time = 0.075; G.day = 1; G.bloodMoon = false; G.hints = {};
  G.nextBlood = 3 + Math.random() * 6;
  W.ensure(0); W.ensure(-1); W.ensure(1);
  const spot = findSpawn();
  const p = E.createPlayer(spot.x, spot.y);
  p.spawn = { x: spot.x, y: spot.y };
  R.cam.x = p.x - R.vw() / 2;
  R.cam.y = p.y - R.vh() / 2;
  streamChunks(true);
  if (go) start();
}

/* 调试：脚本化操作 act=mine:2,place:torch,openinv */
function aimAt(wx, wy) {
  T.input.mx = (wx - R.cam.x) * R.S();
  T.input.my = (wy - R.cam.y) * R.S();
}
function runActions(list) {
  const p = E.P;
  for (let i = 0; i < 150; i++) { update(1 / 60); }      /* 先让玩家落地 */
  R.cam.x = p.x - R.vw() / 2; R.cam.y = p.y - R.vh() / 2;
  for (const raw of list) {
    const a = raw.split(':');
    const kind = a[0], arg = a[1] ? +a[1] : 0;
    if (kind === 'move') {                     /* 走 N 秒 */
      T.input.keys.KeyD = true;
      for (let i = 0; i < arg * 60; i++) { R.cam.x = p.x - R.vw() / 2; R.cam.y = p.y - R.vh() / 2; update(1 / 60); }
      T.input.keys.KeyD = false;
    } else if (kind === 'mine') {              /* 挖 N 秒：a2=横向格数 a3=相对脚底像素 */
      const dx = a[2] ? +a[2] : 1, dy = a[3] !== undefined ? +a[3] : 8;
      T.input.down[0] = true;
      for (let i = 0; i < arg * 60; i++) {
        R.cam.x = p.x - R.vw() / 2; R.cam.y = p.y - R.vh() / 2;
        aimAt(p.x + p.w / 2 + dx * 16, p.y + p.h + dy);
        update(1 / 60);
      }
      T.input.down[0] = false;
      update(1 / 60);
    } else if (kind === 'pick') {              /* 捡起附近掉落物 */
      for (let i = 0; i < arg * 60; i++) { E.updateDrops(1 / 60); R.cam.x = p.x - R.vw() / 2; }
    } else if (kind === 'slot') {              /* 切换快捷栏 */
      p.inv.sel = arg - 1;
    } else if (kind === 'place') {             /* 右键放置 N 次 */
      const dx = a[2] ? +a[2] : 1, dy = a[3] !== undefined ? +a[3] : -8;
      for (let i = 0; i < arg; i++) {
        R.cam.x = p.x - R.vw() / 2; R.cam.y = p.y - R.vh() / 2;
        aimAt(p.x + p.w / 2 + dx * 16, p.y + p.h + dy);
        T.input.clicked[2] = true;
        update(1 / 60);
      }
    } else if (kind === 'openinv') {
      UI.toggle(true);
      for (let i = 0; i < 30; i++) update(1 / 60);
      UI.refresh();
    } else if (kind === 'craft') {             /* 合成第 n 条配方 */
      const idx = T.recipes.findIndex(r => r.out.id === arg);
      for (let i = 0; i < 4; i++) doCraft(idx);
      UI.refresh();
    } else if (kind === 'bench') {             /* 在附近放一个工作台 */
      const bx = Math.floor(p.x / 16) + 3, by = Math.floor(p.y / 16) - 1;
      for (let a2 = 0; a2 < 2; a2++) for (let b2 = 0; b2 < 2; b2++) W.setTile(bx + a2, by + b2, TID.BENCH, 'keepFurn');
      W.onTilesChanged(bx - 1, by - 1, 4, 4);
      update(1 / 60);
    } else if (kind === 'house') {            /* 测试用：原地造一间木屋 */
      const bx = Math.floor(p.x / 16) + 2, by = Math.floor((p.y + p.h) / 16) - 5;
      for (let x = bx; x < bx + 8; x++) for (let y = by; y < by + 5; y++) {
        W.setTile(x, y, y === by + 4 ? TID.WOOD : 0);
        W.setWall(x, y, TID.WALL_WOOD);
      }
      for (let y = by; y < by + 5; y++) { W.setTile(bx, y, TID.WOOD); W.setTile(bx + 7, y, TID.WOOD); }
      for (let x = bx; x < bx + 8; x++) { W.setTile(x, by, TID.WOOD); }
      for (let y = by + 1; y < by + 4; y++) for (let x = bx + 1; x < bx + 7; x++) W.setTile(x, y, 0);
      W.setTile(bx + 3, by + 3, TID.PLATFORM);
      W.setTile(bx + 2, by + 1, TID.TORCH);
      W.setTile(bx + 5, by + 1, TID.TORCH);
      W.setTile(bx + 6, by + 3, TID.CHEST, 'keepFurn');
      W.setTile(bx + 7, by + 3, TID.CHEST, 'keepFurn');
      W.setTile(bx + 6, by + 4, TID.CHEST, 'keepFurn');
      W.setTile(bx + 7, by + 4, TID.CHEST, 'keepFurn');
      W.setTile(bx + 1, by + 3, TID.BENCH, 'keepFurn');
      W.setTile(bx, by + 3, TID.BENCH, 'keepFurn');
      W.setTile(bx + 1, by + 4, TID.BENCH, 'keepFurn');
      W.setTile(bx, by + 4, TID.BENCH, 'keepFurn');
      W.setTile(bx + 3, by + 1, TID.DOOR, 'keepFurn');
      W.setTile(bx + 4, by + 1, TID.DOOR, 'keepFurn');
      W.setTile(bx + 3, by + 2, TID.DOOR, 'keepFurn');
      W.setTile(bx + 4, by + 2, TID.DOOR, 'keepFurn');
      W.setTile(bx + 3, by + 3, TID.DOOR, 'keepFurn');
      W.setTile(bx + 4, by + 3, TID.DOOR, 'keepFurn');
      W.onTilesChanged(bx - 1, by - 1, 10, 7);
      for (let i = 0; i < 30; i++) update(1 / 60);
      R.cam.x = p.x - R.vw() / 2; R.cam.y = p.y - R.vh() / 2;
    } else if (kind === 'probe') {            /* 只打印液体值（单行） */
      const tx = Math.floor(p.x / 16), ty = Math.floor(p.y / 16);
      let g = 'LIQ y' + (ty - 4) + ':';
      for (let dy = -4; dy <= 3; dy++) {
        g += ' [' + (ty + dy) + ']';
        for (let dx = -4; dx <= 8; dx++) g += (W.liq(tx + dx, ty + dy) || 0) + ',';
      }
      g += ' || TILE:';
      for (let dy = -4; dy <= 3; dy++) {
        g += ' [' + (ty + dy) + ']';
        for (let dx = -4; dx <= 8; dx++) g += (W.tile(tx + dx, ty + dy) || 0) + ',';
      }
      G.probe = g;
    } else if (kind === 'water') {      const bx = Math.floor(p.x / 16) - 2, by = Math.floor((p.y + p.h) / 16);
      for (let x = bx; x < bx + 6; x++) {
        W.setTile(x, by - 1, 0); W.setTile(x, by - 2, 0); W.setTile(x, by - 3, 0);
        for (let y = by - 3; y < by; y++) { W.setLiqRaw(x, y, (1 << 4) | 8); W.queueLiquid(x, y); }
      }
      for (let x = bx; x < bx + 6; x++) { W.setTile(x, by, TID.STONE); W.markMod(x, by); }
      for (let i = 0; i < 200; i++) { W.updateLiquid(3000); }
    } else if (kind === 'torch') {            /* 直接放火把（测试） */
      const dx = arg || 0, dy = a[1] !== undefined ? +a[1] : -1;
      const x = Math.floor(p.x / 16) + dx, y = Math.floor((p.y + p.h) / 16) + dy;
      W.setTile(x, y, TID.TORCH);
      for (let i = 0; i < 20; i++) { W.processLight(); }
      G.torchDbg = x + ',' + y + ' t=' + W.tile(x, y) + ' L=' + W.lightAt(x, y)
        + ' Lp=' + W.lightAt(Math.floor(p.x / 16), Math.floor(p.y / 16));
    } else if (kind === 'findcave') {         /* 找一处洞窟并传送过去 */
      const x0 = Math.floor(p.x / 16);
      let done = false;
      for (let r = 0; r < 260 && !done; r++) {
        for (const sgn of (r === 0 ? [1] : [1, -1])) {
          const x = x0 + r * sgn;
          for (let y = 150; y < 235; y++) {
            if (!E.solidAt(x, y) && E.solidAt(x, y + 1) && !E.solidAt(x, y - 1) && !E.solidAt(x, y - 2)) {
              p.x = x * TS; p.y = y * TS; p.vx = 0; p.vy = 0;
              W.ensure(x >> 6);
              for (let i = 0; i < 60; i++) update(1 / 60);
              R.cam.x = p.x - R.vw() / 2; R.cam.y = p.y - R.vh() / 2;
              G.torchDbg = 'cave ' + x + ',' + y;
              done = true;
              break;
            }
          }
          if (done) break;
        }
      }
    } else if (kind === 'teleport') {          /* 传送到指定格子（测试用） */
      p.x = arg * TS; p.y = (a[2] !== undefined ? +a[2] : 100) * TS;
      p.vx = 0; p.vy = 0;
      W.ensure(Math.floor(p.x / TS / 64));
      for (let i = 0; i < 90; i++) { update(1 / 60); }
      R.cam.x = p.x - R.vw() / 2; R.cam.y = p.y - R.vh() / 2;
    }
  }
}

/* 找一个头顶三格是空气、脚下是实地且不是仙人掌的出生点 */
function findSpawn() {
  for (let r = 0; r < 200; r++) {
    for (const sg of (r === 0 ? [1] : [1, -1])) {
      const x = r * sg;
      W.ensure(x >> 6);
      for (let sy = W.surfaceY(x) - 6; sy < W.surfaceY(x) + 4; sy++) {
        const t = W.tile(x, sy);
        if (t !== TID.GRASS && t !== TID.SAND && t !== TID.DIRT) continue;
        let clear = true;
        for (let k = 1; k <= 5; k++) if (W.tile(x, sy - k) !== 0 || W.liq(x, sy - k)) { clear = false; break; }
        if (!clear) continue;
        if (W.tile(x, sy + 1) === 0 && W.tile(x, sy + 2) === 0) continue;   /* 脚下要是实地 */
        return { x: x * TS + 8, y: (sy - 3) * TS };
      }
    }
  }
  return { x: 8, y: (W.surfaceY(0) - 3) * TS };
}

function start() {
  document.getElementById('screen').classList.add('hidden');
  G.started = true; G.paused = false;
  T.snd.unlock();
  UI.toast('先用手挖掉地表的土，收集木材');
}

function restorePlayer(d) {
  E.createPlayer(d.x, d.y);
  const p = E.P;
  p.hp = d.hp; p.maxHp = d.maxHp || 100;
  p.inv.slots = d.inv;
  p.inv.sel = d.sel || 0;
  p.spawn = d.spawn;
  R.cam.x = p.x - R.vw() / 2; R.cam.y = p.y - R.vh() / 2;
}

/* ------------------------------------------------------------------
   输入
------------------------------------------------------------------ */
function bindInput() {
  cv.addEventListener('mousedown', (e) => {
    T.snd.unlock();
    if (e.button < 3) T.input.down[e.button] = true, T.input.clicked[e.button] = true;
  });
  window.addEventListener('mouseup', (e) => { if (e.button < 3) T.input.down[e.button] = false; });
  cv.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('mousemove', (e) => {
    T.input.mx = e.clientX; T.input.my = e.clientY;
  });
  window.addEventListener('wheel', (e) => {
    if (UI.open) return;
    const p = E.P; if (!p) return;
    p.inv.sel = (p.inv.sel + (e.deltaY > 0 ? 1 : 9)) % 10;
  }, { passive: true });
  window.addEventListener('beforeunload', () => { if (G.started) saveGame(); });
  document.addEventListener('keydown', (e) => {
    const p = E.P;
    if (!G.started) return;
    if (e.code === 'KeyE') { UI.toggle(); e.preventDefault(); }
    if (e.code === 'Escape') { if (UI.open) UI.toggle(false); }
    if (UI.open) return;
    if (e.code === 'KeyF') { G.showMap = !G.showMap; UI.toast(G.showMap ? '小地图：开' : '小地图：关'); }
    if (e.code === 'KeyM') { UI.toast(T.snd.toggle() ? '静音' : '音效开启'); }
    if (e.code === 'KeyQ') { UI.dropCursor(); }
    const n = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0'];
    const i = n.indexOf(e.code);
    if (i >= 0 && p) {
      if (p.inv.sel !== i) { p.inv.sel = i; const s = p.inv.slots[i]; if (s) UI.toast(T.item(s.id).name); }
    }
  });
}

/* ------------------------------------------------------------------
   区块流式加载
------------------------------------------------------------------ */
function streamChunks(all) {
  const p = E.P; if (!p) return;
  const pcx = Math.floor(p.x / TS / 64);
  let budget = all ? 8 : 1;
  for (let d = 0; d <= 4 && budget > 0; d++) {
    for (let s = -1; s <= 1; s += 2) {
      const cx = pcx + d * s;
      if (d === 0) continue;
      if (!W.chunks.has(cx)) { W.ensure(cx); budget--; }
    }
    if (d === 0) { if (!W.chunks.has(pcx)) { W.ensure(pcx); budget--; } }
  }
  /* 卸载远处区块 */
  if (all) return;
  W.chunks.forEach((c, cx) => { if (Math.abs(cx - pcx) > 26) W.chunks.delete(cx); });
}

/* ------------------------------------------------------------------
   主循环
------------------------------------------------------------------ */
function loop(ts) {
  requestAnimationFrame(loop);
  if (!last) last = ts;
  let dt = (ts - last) / 1000;
  last = ts;
  if (dt > .05) dt = .05;
  acc += dt;

  if (G.started && !G.paused) {
    /* 固定步长物理 */
    let steps = 0;
    while (acc >= 1 / 60 && steps < 4) { update(1 / 60); acc -= 1 / 60; steps++; }
    if (steps === 0) { updateIdle(dt); }
    R.updateCam(dt);
    saveT += dt;
    if (saveT > 25) { saveT = 0; saveGame(); }
  } else {
    R.updateCam(dt);
  }
  W.processLight();
  W.updateLiquid(2400);
  R.draw(dt);
  UI.update(dt);
  fpsAcc += dt; fpsN++;
  if (fpsAcc > .5) { G.fps = Math.round(fpsN / fpsAcc); fpsAcc = 0; fpsN = 0; }
  if (qDebug) debugDump();

  T.input.pressed = Object.create(null);
  T.input.clicked = [false, false, false];
}
let qDebug = false, dbgT = 0;
function debugDump() {
  dbgT += 1;
  if (dbgT % 5) return;
  try {
    const p = E.P;
    const tx = Math.floor(p.x / 16), ty = Math.floor(p.y / 16);
    G.debugText = 'fps ' + (G.fps || '-') + ' | 渲染 ' + (G.perf ? G.perf.toFixed(2) : '-') + ' ms/帧'
      + ' | 敌 z' + E.count('zombie') + ' e' + E.count('eye') + ' s' + E.count('slime')
      + ' | 深度 ' + (ty - W.topAt(tx)) + ' | 区块 ' + W.chunks.size + ' | 粒子 ' + E.parts.length;
    let g = '';
    for (let dy = -3; dy <= 3; dy++) { let row = ''; for (let dx = -3; dx <= 4; dx++) row += String(W.tile(tx + dx, ty + dy)).padStart(4); g += row + '\n'; }
    G.debugText2 = (G.probe || '') + g;
  } catch (err) { G.debugText = 'DERR ' + err.message; }
  if (G.probe) document.title = G.probe;
}

function updateIdle(dt) { G.time += dt / DAY_LEN * .2; }

/* ------------------------------------------------------------------
   更新
------------------------------------------------------------------ */
function update(dt) {
  const p = E.P, K = T.input.keys;
  if (!p) return;

  /* 昼夜 */
  const prevT = G.time;
  G.time += dt / DAY_LEN;
  if (G.time >= 1) { G.time -= 1; G.day++; onNewDay(); }
  G.night = T.isNight(G.time);
  if (prevT < 0.62 && G.time >= 0.62) onDusk();

  /* 鼠标世界坐标 */
  T.input.wx = R.cam.x + T.input.mx / R.S();
  T.input.wy = R.cam.y + T.input.my / R.S();
  const hx = p.x + p.w / 2, hy = p.y + p.h / 2;
  G.aimAngle = Math.atan2(T.input.wy - (hy + 3), T.input.wx - hx);

  if (UI.open) updatePlayerPassive(p, dt);
  else updatePlayer(p, dt, K);

  updateMining(dt);
  updatePlacing();
  streamChunks(false);

  E.updateDrops(dt);
  E.updateMobs(dt, G.night, G.bloodMoon);
  E.updateParts(dt);
  E.spawnCycle(dt);
  uiRefreshT -= dt;
  if (UI.open && uiRefreshT <= 0) { uiRefreshT = .25; UI.refresh(); }
}

/* ---------------- 玩家 ---------------- */
function updatePlayer(p, dt, K) {
  const left = K.KeyA || K.ArrowLeft, right = K.KeyD || K.ArrowRight;
  const up = K.Space || K.KeyW || K.ArrowUp;
  const down = K.KeyS || K.ArrowDown;
  const hx = p.x + p.w / 2, hy = p.y + p.h / 2;
  if (p.dead) return;

  /* 移动 */
  const acc = p.onGround ? .62 : .34;
  const maxS = 3.25;
  if (left) { p.vx -= acc * dt * 60; p.face = -1; }
  if (right) { p.vx += acc * dt * 60; p.face = 1; }
  if (!left && !right) {
    const f = (p.onGround ? .58 : .12) * dt * 60;
    p.vx = Math.abs(p.vx) < f ? 0 : p.vx - Math.sign(p.vx) * f;
  }
  p.vx = T.clamp(p.vx, -maxS, maxS);

  /* 跳跃 */
  if (up && p.onGround && p.jumpLock <= 0) {
    p.vy = -7.5; p.onGround = false; p.jumpLock = .12;
    T.snd.play('jump', .5);
  }
  p.jumpLock = Math.max(0, (p.jumpLock || 0) - dt);
  if (!up && p.vy < -2.2) p.vy = -2.2;      // 短跳

  /* 从木平台落下 */
  if (down && p.onGround) p.noPlatT = .22;

  p.vy = Math.min(p.vy + .46 * dt * 60, 13.5);
  E.moveEnt(p, dt);

  /* 液体 */
  const headL = W.liq(Math.floor(hx / TS), Math.floor((p.y + 6) / TS));
  const bodyL = W.liq(Math.floor(hx / TS), Math.floor((p.y + 18) / TS));
  const inWater = ((headL >> 4) === 1) || ((bodyL >> 4) === 1);
  const inLava = ((headL >> 4) === 2) || ((bodyL >> 4) === 2);
  if (inWater) {
    p.vy = Math.min(p.vy, 1.8);
    p.vy -= .16 * dt * 60;
    if (p.vy < -2.4) p.vy = -2.4;
    if (T.rnd() < .08) E.part(hx + (Math.random() * 8 - 4), p.y + 10, {
      vy: -1.4, life: .9, col: 'rgba(180,220,255,.8)', size: 2, g: -.02, type: 'bubble'
    });
  }
  if (inLava) {
    E.hurt(p, 34 * dt, hx, 1.2);
    if (T.rnd() < .4) E.part(hx + (Math.random() * 10 - 5), p.y + 10 + Math.random() * 14, {
      vy: -1 - Math.random(), vx: (Math.random() - .5), life: .5,
      col: T.rnd() < .5 ? '#ff9b2f' : '#ffd964', size: 3, g: -.05, type: 'dust'
    });
  }
  /* 氧气 */
  if (inWater && (headL >> 4) === 1) {
    p.breath -= dt * 2.2;
    if (p.breath <= 0) { p.breath = 0; E.hurt(p, 24 * dt, hx, .5); }
  } else p.breath = Math.min(p.maxBreath, p.breath + dt * 4);

  /* 摔落伤害 */
  if (p.onGround && p.maxFall > 15.5) {
    E.hurt(p, Math.round((p.maxFall - 15.5) * 3.2), hx, 3);
    R.cam.shake = .6;
  }
  p.maxFall = p.onGround ? 0 : Math.max(p.maxFall, p.vy);

  /* 仙人掌 */
  const cx = Math.floor(hx / TS), cy = Math.floor((p.y + p.h - 2) / TS);
  if (W.tileOrGen(cx, cy) === TID.CACTUS || W.tileOrGen(cx, cy - 1) === TID.CACTUS) {
    T.input.hurtCd = (T.input.hurtCd || 0) - dt;
    if (T.input.hurtCd <= 0) { E.hurt(p, 7, hx, 1.5); T.input.hurtCd = .8; }
  }

  p.iframes = Math.max(0, p.iframes - dt);
  p.swingT = Math.max(0, p.swingT - dt);
  p.swingCD = Math.max(0, p.swingCD - dt);
  p.sinceHit += dt;

  /* 回血：静止或有光 */
  if (p.sinceHit > 6 && p.hp < p.maxHp) {
    const lit = W.topAt(cx) < cy || W.lightAt(cx, cy) > 6;
    if ((p.onGround && Math.abs(p.vx) < .2) || lit) {
      p.regenT += dt;
      if (p.regenT > 2.6) { p.regenT = 0; p.hp = Math.min(p.maxHp, p.hp + 2); }
    }
  }
  /* 脚步 */
  if (p.onGround && Math.abs(p.vx) > 1.2) {
    p.stepT -= dt * Math.abs(p.vx);
    if (p.stepT <= 0) { p.stepT = 9; T.snd.play('step', .5); }
  }
}

function updatePlayerPassive(p, dt) {
  p.vx *= .8;
  p.vy = Math.min(p.vy + .46 * dt * 60, 13.5);
  E.moveEnt(p, dt);
  p.iframes = Math.max(0, p.iframes - dt);
  p.swingT = Math.max(0, p.swingT - dt);
  p.maxFall = p.onGround ? 0 : Math.max(p.maxFall, p.vy);
}

/* ---------------- 目标方块 ---------------- */
function targetTile() {
  const p = E.P;
  const hx = p.x + p.w / 2, hy = p.y + p.h / 2;
  let dx = T.input.wx - hx, dy = T.input.wy - hy;
  const d = Math.hypot(dx, dy);
  const reach = 6.2 * TS;
  if (d > reach) { dx = dx / d * reach; dy = dy / d * reach; }
  return { tx: Math.floor((hx + dx) / TS), ty: Math.floor((hy + dy) / TS), dist: d };
}

/* ---------------- 挖掘 & 攻击 ---------------- */
const digSnd = { t: 0 };
function updateMining(dt) {
  const p = E.P;
  if (p.dead || UI.open) { G.mining = null; return; }
  const info = E.heldInfo();
  const tg = targetTile();
  G.target = tg;

  if (!T.input.down[0]) { G.mining = null; return; }

  const id = W.tileOrGen(tg.tx, tg.ty);
  const def = T.tile(id);
  const canMine = id > 0 && (def.solid || def.furn || def.platform) && def.hardness < 1e8;

  if (canMine) {
    if (def.tier > info.tier) {
      if (G.hints.tier === undefined || G.time - G.hints.tier > 4) {
        G.hints.tier = G.time;
        UI.toast(def.tier === 1 ? '需要一把镐才能挖开它' : '需要更好的镐（' + T.TIER_NAME[def.tier - 1] + '镐）');
      }
      G.mining = null; return;
    }
    if (!G.mining || G.mining.x !== tg.tx || G.mining.y !== tg.ty) {
      G.mining = { x: tg.tx, y: tg.ty, prog: 0, dur: E.mineDur(tg.tx, tg.ty, info) };
    }
    G.mining.prog += dt / G.mining.dur;
    digSnd.t -= dt;
    if (digSnd.t <= 0) {
      digSnd.t = .17;
      T.snd.play('dig', .7);
      const col = T.hex2rgb(def.color || '#888');
      E.part(tg.tx * TS + 4 + Math.random() * 8, tg.ty * TS + 4 + Math.random() * 8, {
        vx: (Math.random() - .5) * 2, vy: -Math.random() * 1.5, life: .4,
        col: T.rgb2hex(col[0], col[1], col[2]), size: 2
      });
    }
    if (p.swingT <= 0) { p.swingT = .28; }
    if (G.mining.prog >= 1) {
      E.breakTile(tg.tx, tg.ty, true);
      R.cam.shake = Math.max(R.cam.shake, .12);
      G.mining = null;
    }
    return;
  }

  /* 空气：挥剑 */
  G.mining = null;
  if (p.swingCD <= 0) {
    p.swingT = .3;
    p.swingCD = info.weapon ? 1 / Math.max(.8, info.speed) : .42;
    T.snd.play('swing', .5);
    const reach = 3.6 * TS;
    let hit = false;
    for (const m of E.mobs) {
      const mx = m.x + m.w / 2, my = m.y + m.h / 2;
      const d = Math.hypot(mx - (p.x + p.w / 2), my - (p.y + p.h / 2));
      const a = Math.atan2(my - (p.y + p.h / 2 + 3), mx - (p.x + p.w / 2));
      const da = Math.abs(((a - G.aimAngle + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      if (d < reach && da < 1.15) {
        E.hurtMob(m, info.dmg, info.knock * 4, p.x + p.w / 2);
        hit = true;
      }
    }
    if (hit) R.cam.shake = .25;
  }
}

/* ---------------- 放置 / 交互 ---------------- */
function updatePlacing() {
  const p = E.P;
  if (p.dead || UI.open) return;
  if (!T.input.clicked[2]) return;
  const tg = targetTile();
  const id = W.tileOrGen(tg.tx, tg.ty);

  /* 交互优先 */
  if (id === TID.CHEST) { UI.openChest(chestKey(tg.tx, tg.ty), tg.tx, tg.ty); return; }
  if (id === TID.DOOR) { toggleDoor(tg.tx, tg.ty, TID.DOOR_OPEN); T.snd.play('door'); return; }
  if (id === TID.DOOR_OPEN) { toggleDoor(tg.tx, tg.ty, TID.DOOR); T.snd.play('door'); return; }
  if (id === TID.BED) { sleep(tg.tx, tg.ty); return; }

  const held = p.inv.held();
  G.placeDbg = 'tgt ' + tg.tx + ',' + tg.ty + ' id=' + id + ' held=' + (held ? held.id : 0)
    + ' below=' + E.solidAt(tg.tx, tg.ty + 1) + ' self=' + E.solidAt(tg.tx, tg.ty);
  if (!held) return;
  const def = T.item(held.id);

  if (def.type === 'food') {
    if (p.hp >= p.maxHp) { UI.toast('生命值已满'); return; }
    E.heal(p, def.heal);
    p.inv.removeAt(p.inv.sel, 1);
    T.snd.play('eat', .5);
    UI.toast('吃掉了 ' + def.name);
    return;
  }
  if (!def.tile) return;
  const td = T.tile(def.tile);

  /* 背景墙 */
  if (td.wall) {
    if (W.wall(tg.tx, tg.ty) === def.tile) { UI.toast('这里已经有墙了'); return; }
    W.setWall(tg.tx, tg.ty, def.tile);
    consume(); T.snd.play('place'); return;
  }

  /* 火把需要依托 */
  if (def.tile === TID.TORCH) {
    const ok = W.wall(tg.tx, tg.ty) || E.solidAt(tg.tx, tg.ty + 1) || E.solidAt(tg.tx - 1, tg.ty) ||
      E.solidAt(tg.tx + 1, tg.ty) || E.solidAt(tg.tx, tg.ty - 1) || W.wall(tg.tx, tg.ty - 1);
    if (!ok) { UI.toast('火把需要贴在墙或方块上'); return; }
  }

  /* 家具 */
  if (td.furn) {
    const fw = td.furn.w, fh = td.furn.h;
    for (let dx = 0; dx < fw; dx++) for (let dy = 0; dy < fh; dy++) {
      const x = tg.tx - dx, y = tg.ty - dy;
      const t2 = W.tileOrGen(x, y);
      if (t2 !== 0 && !T.tile(t2).plant) { UI.toast('这里放不下'); return; }
      if (overlapsPlayer(x * TS, y * TS, TS, TS)) { UI.toast('你正站在那里'); return; }
    }
    for (let dx = 0; dx < fw; dx++) for (let dy = 0; dy < fh; dy++) {
      W.setTile(tg.tx - dx, tg.ty - dy, def.tile, 'keepFurn');
      W.markMod(tg.tx - dx, tg.ty - dy);
    }
    W.onTilesChanged(tg.tx - fw, tg.ty - fh, fw + 2, fh + 2);
    consume(); T.snd.play('place');
    return;
  }

  const t2 = W.tileOrGen(tg.tx, tg.ty);
  if (t2 !== 0 && !T.tile(t2).plant) { UI.toast('这里已经有方块了'); return; }
  if (td.solid && overlapsPlayer(tg.tx * TS, tg.ty * TS, TS, TS)) return;
  W.setTile(tg.tx, tg.ty, def.tile);
  consume();
  T.snd.play('place');
}
function overlapsPlayer(x, y, w, h) {
  const p = E.P;
  return p.x < x + w && p.x + p.w > x && p.y < y + h && p.y + p.h > y;
}
function consume() { E.P.inv.removeAt(E.P.inv.sel, 1); }

function chestKey(x, y) {
  const o = W.furnOrigin(x, y, TID.CHEST);
  return o.x + ',' + o.y;
}
function toggleDoor(x, y, to) {
  const o = W.furnOrigin(x, y, W.tile(x, y));
  for (let a = 0; a < o.w; a++) for (let b = 0; b < o.h; b++) W.setTile(o.x + a, o.y + b, to, 'keepFurn');
  W.onTilesChanged(o.x - 1, o.y - 1, o.w + 2, o.h + 2);
}
function sleep(x, y) {
  const p = E.P, o = W.furnOrigin(x, y, TID.BED);
  p.spawn = { x: o.x * TS + 16, y: (o.y - 3) * TS };
  if (G.night) {
    G.time = 0.02;
    UI.banner('新的一天开始了', 2);
    T.snd.play('heal');
    E.heal(p, p.maxHp);
  } else {
    UI.toast('重生点已设置在这里（夜里可以睡觉跳过夜晚）');
  }
}

/* ---------------- 事件 ---------------- */
function onDusk() {
  G.bloodMoon = false;
  if (G.day >= G.nextBlood) {
    G.bloodMoon = true;
    G.nextBlood = G.day + 3 + Math.floor(Math.random() * 6);
    UI.banner('血 月 升 起', 4);
    T.snd.play('growl', .9);
  } else {
    UI.toast('太阳落山了……');
  }
  T.input.hintsDusk = 1;
}
function onNewDay() {
  UI.toast('第 ' + G.day + ' 天开始了');
  if (G.bloodMoon) { G.bloodMoon = false; }
  T.snd.play('heal', .4);
  const p = E.P;
  if (p && !p.dead && p.hp < p.maxHp) E.heal(p, 20);
}

/* ---------------- 存档 ---------------- */
const SAVE_KEY = 'terranova_save_v1';
function saveGame() {
  if (!G.started) return;
  const p = E.P;
  if (!p) return;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      world: W.serialize(),
      player: {
        x: p.x, y: p.y, hp: p.hp, maxHp: p.maxHp, inv: p.inv.slots, sel: p.inv.sel,
        spawn: p.spawn, time: G.time, day: G.day
      }
    }));
  } catch (e) { /* 存储满 */ }
}
function loadSave() {
  try {
    const s = localStorage.getItem(SAVE_KEY);
    return s ? JSON.parse(s) : null;
  } catch (e) { return null; }
}
function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { } }

/* ------------------------------------------------------------------ */
window.addEventListener('error', (e) => {
  let d = document.getElementById('dbg');
  if (!d) { d = document.createElement('pre'); d.id = 'dbg'; document.body.appendChild(d); }
  d.textContent = 'ERR ' + e.message + '\n' + (e.error && e.error.stack ? e.error.stack : '');
});
window.addEventListener('load', boot);
})(window.T);
