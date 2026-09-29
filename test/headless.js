/* ==========================================================================
   无头回归测试：模拟 DOM/Canvas，跑一遍完整玩法流程，抓运行时异常
   用法：node test/headless.js
   ========================================================================== */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function makeCtx() {
  const g = {
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
    getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
    putImageData() {}
  };
  return new Proxy(g, { get: (t, k) => (k in t ? t[k] : () => { }), set: (t, k, v) => { t[k] = v; return true; } });
}
function makeEl() {
  return {
    tagName: 'div', style: {}, dataset: {}, children: [], firstChild: null, textContent: '', innerHTML: '',
    classList: { _s: new Set(), add() { }, remove() { }, toggle() { return true; }, contains() { return false; } },
    appendChild(c) { this.children.push(c); if (!this.firstChild) this.firstChild = c; return c; },
    insertBefore(c) { this.children.push(c); if (!this.firstChild) this.firstChild = c; return c; },
    removeChild() { }, replaceChild() { }, addEventListener() { }, removeEventListener() { },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 44, height: 44 }),
    querySelector: () => makeEl(), querySelectorAll: () => [], closest: () => null,
    getContext: () => makeCtx(), toDataURL: () => 'data:', focus() { }, click() { }
  };
}
const els = {};
const win = {
  console, innerWidth: 1280, innerHeight: 800, addEventListener() { },
  document: {
    getElementById: (id) => (els[id] || (els[id] = makeEl())),
    createElement: () => makeEl(), addEventListener() { }, body: makeEl()
  },
  localStorage: { _d: {}, getItem(k) { return this._d[k] || null; }, setItem(k, v) { this._d[k] = v; }, removeItem(k) { delete this._d[k]; } },
  requestAnimationFrame: () => 0
};
win.window = win;
const ctxv = vm.createContext(win);
const base = path.join(__dirname, '..', 'js');
for (const f of ['core.js', 'tiles.js', 'world.js', 'entities.js', 'render.js', 'ui.js', 'main.js']) {
  vm.runInContext(fs.readFileSync(path.join(base, f), 'utf8'), ctxv, { filename: f });
}
const T = win.T, E = T.E, W = T.W;
let fails = 0;
const ok = (name, cond, extra) => {
  if (!cond) fails++;
  console.log((cond ? '  ✓ ' : '  ✗ ') + name + (extra !== undefined ? '  ' + extra : ''));
};

console.log('\n[1] 初始化');
T.Tex.build();
ok('贴图生成', Object.keys(T.Tex.tile).length > 25, Object.keys(T.Tex.tile).length + ' 组');
ok('物品图标', Object.keys(T.Tex.item).length > 30, Object.keys(T.Tex.item).length + ' 个');
T.R.init(); T.UI.init();
T.G.started = true;

console.log('\n[2] 世界生成');
const t0 = Date.now();
W.setSeed(20240607);
for (let c = 0; c < 5; c++) W.ensure(c);
const genMs = Date.now() - t0;
ok('5 个区块生成', true, genMs + ' ms (' + (genMs / 5).toFixed(1) + ' ms/块)');
ok('区块生成耗时可接受', genMs / 5 < 400, '注：Node vm 环境比浏览器慢 5~10 倍');

let counts = {};
for (let x = -80; x < 80; x++) for (let y = 0; y < W.H; y++) {
  const t = W.tile(x, y); if (t > 0) counts[t] = (counts[t] || 0) + 1;
}
const names = Object.keys(counts).map(k => T.tile(+k).name + ':' + counts[k]);
console.log('    地形:', names.join(' '));
ok('有矿石生成', !!counts[8] || !!counts[9] || !!counts[10], '铜' + (counts[8] || 0) + ' 铁' + (counts[9] || 0) + ' 金' + (counts[10] || 0));
let veg = 0;
for (let c = -3; c <= 3; c++) { if (!W.chunks.has(c)) W.ensure(c); }
for (const [, ch] of W.chunks) for (let i = 0; i < ch.tiles.length; i++) { const t = ch.tiles[i]; if (t === T.TID.WOOD || t === T.TID.LEAVES || t === T.TID.GRASS) veg++; }
ok('有树木/草地', veg > 0, '植物方块 ' + veg);

console.log('\n[3] 玩家与物理');
const p = E.createPlayer(8, (W.surfaceY(0) - 4) * 16);
p.inv.add(T.IID.WOOD, 40); p.inv.add(T.IID.GEL, 20);
p.inv.add(T.IID.COPPER_BAR, 60); p.inv.add(T.IID.COPPER_ORE, 40);
const step = () => { p.vy = Math.min(p.vy + .46 / 60, 13.5); E.moveEnt(p, 1 / 60); };
for (let i = 0; i < 200; i++) step();
const y1 = p.y;
for (let i = 0; i < 60; i++) step();
ok('玩家落地后不再下沉', Math.abs(p.y - y1) < 0.01, 'y ' + (y1 | 0) + ' → ' + (p.y | 0));
ok('脚下是实地', W.solid(Math.floor(p.x / 16), Math.floor((p.y + p.h + 2) / 16)),
  '脚下 ' + T.tile(W.tile(Math.floor(p.x / 16), Math.floor((p.y + p.h + 2) / 16))).name);

console.log('\n[4] 挖掘与掉落');
let tx = Math.floor(p.x / 16) + 1, ty = Math.floor((p.y + p.h) / 16);
if (!T.tile(W.tile(tx, ty)).solid) ty++;
const info = E.heldInfo();
const dur = E.mineDur(tx, ty, info);
ok('挖掘耗时 > 0', dur > 0, dur.toFixed(2) + ' 秒');
E.breakTile(tx, ty, true);
ok('破坏方块产生掉落', E.drops.length > 0, E.drops.length + ' 个');
const before = p.inv.count(T.IID.DIRT);
for (let i = 0; i < 400; i++) E.updateDrops(1 / 60);
const d0 = E.drops[0];
ok('掉落物被吸收入背包', p.inv.count(T.IID.DIRT) > before || E.drops.length === 0,
  '泥土 ' + before + ' → ' + p.inv.count(T.IID.DIRT) +
  (d0 ? '，剩余 ' + E.drops.length + ' 个（距玩家 ' + Math.hypot(d0.x - p.x, d0.y - p.y).toFixed(0) + 'px）' : ''));

console.log('\n[5] 工具等级门槛');
p.inv.slots[0] = { id: T.IID.COPPER_PICK, n: 1 };
p.inv.sel = 0;
const ti = E.heldInfo();
ok('铜镐 tier=1', ti.tier === 1);
ok('铜矿可采', E.mineDur(0, 0, { tier: 1, speed: 2.4, kind: 'pick' }) > 0);
const ironTile = (() => { for (let x = -80; x < 80; x++) for (let y = 100; y < 240; y++) if (W.tile(x, y) === T.TID.IRON) return { x, y }; return null; })();
ok('世界里能找到铁矿', !!ironTile, ironTile ? ironTile.x + ',' + ironTile.y : '');

console.log('\n[6] 放置与光照');
const bx = Math.floor(p.x / 16) - 2, by = Math.floor(p.y / 16) - 1;
W.setTile(bx, by, TID_ = T.TID.TORCH);
W.processLight();
ok('火把产生光照', W.lightAt(bx, by) > 5, 'L=' + W.lightAt(bx, by));
ok('光照向外扩散', W.lightAt(bx + 2, by) > 0 && W.lightAt(bx + 2, by) < W.lightAt(bx, by), '2格外 L=' + W.lightAt(bx + 2, by));
W.setTile(bx, by, 0);
W.processLight();
ok('移除火把后光照消失', W.lightAt(bx, by) === 0);

console.log('\n[7] 家具与多格');
const fx = Math.floor(p.x / 16) + 3, fy = Math.floor(p.y / 16) - 1;
for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) W.setTile(fx + a, fy + b, T.TID.BENCH, 'keepFurn');
W.processLight();
ok('工作台被识别', W.hasBench(p.x + 6, p.y + 14, 6));
E.breakTile(fx, fy, true);
ok('拆家具会清空整块', W.tile(fx, fy) === 0 && W.tile(fx + 1, fy + 1) === 0);

console.log('\n[8] 合成与熔炼');
const pIdx = T.recipes.findIndex(r => r.out.id === T.IID.COPPER_PICK);
ok('存在铜镐配方', pIdx >= 0);
E.P.inv.remove(T.IID.COPPER_BAR, 12); E.P.inv.remove(T.IID.WOOD, 3);
W.setTile(fx, fy, T.TID.BENCH, 'keepFurn'); W.setTile(fx + 1, fy, T.TID.BENCH, 'keepFurn');
W.setTile(fx, fy + 1, T.TID.BENCH, 'keepFurn'); W.setTile(fx + 1, fy + 1, T.TID.BENCH, 'keepFurn');
const barsBefore = p.inv.count(T.IID.COPPER_BAR);
T.UI.craft(pIdx);
ok('制作铜镐', p.inv.firstOf(T.IID.COPPER_PICK) >= 0, '铜锭 ' + barsBefore + ' → ' + p.inv.count(T.IID.COPPER_BAR));
T.UI.toggle(true); T.UI.toggle(false);
ok('背包面板开关正常', true);

console.log('\n[9] 液体');
let wet = 0;
for (let x = -80; x < 80; x++) for (let y = 0; y < W.H; y++) if (W.liq(x, y)) wet++;
ok('世界有水体', wet > 0, wet + ' 格');
let bad = 0;
for (const [, c] of W.chunks) for (let i = 0; i < c.liq.length; i++) {
  const v = c.liq[i];
  if (v && ((v >> 4 < 1 || v >> 4 > 2) || (v & 15) > 8)) bad++;
}
ok('没有非法液体数值', bad === 0, bad + ' 个异常');

console.log('\n[10] 敌人');
T.G.night = true; T.G.time = 0.8;
for (let i = 0; i < 900; i++) E.spawnCycle(1 / 60);
ok('夜晚刷出僵尸', E.count('zombie') > 0, '僵尸 ' + E.count('zombie'));
ok('夜晚刷出恶魔眼', E.count('eye') > 0, '恶魔眼 ' + E.count('eye'));
const hpBefore = p.hp;
for (let i = 0; i < 300; i++) E.updateMobs(1 / 60, true, false);
ok('敌人 AI 运行 300 帧', true, '玩家 HP ' + (hpBefore | 0) + ' → ' + (p.hp | 0));
const m = E.mobs[0];
if (m) { const h = m.hp; E.hurtMob(m, 999, 4, 0); ok('击杀敌人掉落战利品', E.drops.length > 0, 'HP ' + h + ' → ' + m.hp); }

console.log('\n[11] 存档 / 读档');
W.setTile(fx + 5, fy, T.TID.CHEST, 'keepFurn');
W.setTile(fx + 6, fy, T.TID.CHEST, 'keepFurn');
W.setTile(fx + 5, fy + 1, T.TID.CHEST, 'keepFurn');
W.setTile(fx + 6, fy + 1, T.TID.CHEST, 'keepFurn');
T.UI.openChest(fx + 5 + ',' + fy, fx + 5, fy);
ok('箱子有战利品', W.chests.get(fx + 5 + ',' + fy).items.length > 0,
  W.chests.get(fx + 5 + ',' + fy).items.length + ' 格');
T.UI.toggle(false);
const snap = JSON.parse(JSON.stringify(W.serialize()));
const size = JSON.stringify(snap).length;
ok('序列化体积合理', size < 400 * 1024, (size / 1024).toFixed(1) + ' KB');
const chestTileBefore = W.tile(fx + 5, fy);
W.setTile(fx + 20, fy, T.TID.STONE);
W.deserialize(snap);
for (let c = -2; c <= 2; c++) W.ensure(c);
ok('读档还原方块', W.tile(fx + 5, fy) === chestTileBefore && W.tile(fx + 20, fy) === 0);
ok('读档还原箱子', W.chests.has(fx + 5 + ',' + fy));

console.log('\n[12] 渲染 300 帧');
W.ensure(2); W.ensure(3);
let err = null;
try {
  for (let i = 0; i < 300; i++) {
    T.R.updateCam(1 / 60);
    W.processLight(); W.updateLiquid(2000);
    E.updateDrops(1 / 60); E.updateMobs(1 / 60, T.G.night, false);
    E.updateParts(1 / 60); E.spawnCycle(1 / 60);
    T.R.draw(1 / 60);
  }
} catch (e) { err = e; }
ok('300 帧渲染无异常', !err, err ? err.message : '');
ok('粒子数量受控', E.parts.length <= 900, E.parts.length + '');

console.log('\n' + (fails ? '✗ ' + fails + ' 项失败' : '✓ 全部通过'));
process.exit(fails ? 1 : 0);
