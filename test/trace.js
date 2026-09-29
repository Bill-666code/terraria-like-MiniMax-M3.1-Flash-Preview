/* 记录渲染调用，找出金色矩形的来源 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const calls = [];
function makeCtx() {
  const rec = (name) => function (...a) { calls.push([name].concat(a)); };
  const g = {
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
    getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
    putImageData() { }
  };
  const wrap = {
    get: (t, k) => {
      if (k in t) return t[k];
      return rec(k);
    },
    set: (t, k, v) => { t[k] = v; return true; }
  };
  return new Proxy(g, wrap);
}
function makeEl(tag) {
  return {
    tagName: tag, style: {}, dataset: {}, children: [], firstChild: null, textContent: '', innerHTML: '',
    classList: { _s: new Set(), add() { }, remove() { }, toggle() { return true; }, contains() { return false; } },
    appendChild(c) { this.children.push(c); if (!this.firstChild) this.firstChild = c; return c; },
    insertBefore(c) { this.children.push(c); if (!this.firstChild) this.firstChild = c; return c; },
    removeChild() { }, replaceChild() { }, addEventListener() { }, removeEventListener() { },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 44, height: 44, right: 44, bottom: 44 }),
    querySelector: () => makeEl('div'), querySelectorAll: () => [], closest: () => null,
    getContext: () => makeCtx(), toDataURL: () => 'data:', focus() { }, click() { }
  };
}
const els = {};
const win = {
  console, innerWidth: 1280, innerHeight: 800, addEventListener() { },
  document: { getElementById: (id) => (els[id] || (els[id] = makeEl('div'))), createElement: (t) => makeEl(t), addEventListener() { }, body: makeEl('body') },
  localStorage: { _d: {}, getItem(k) { return this._d[k] || null; }, setItem(k, v) { this._d[k] = v; }, removeItem(k) { delete this._d[k]; } },
  requestAnimationFrame: () => 0
};
win.window = win;
const ctxv = vm.createContext(win);
const base = path.join(__dirname, '..', 'js');
for (const f of ['core.js', 'tiles.js', 'world.js', 'entities.js', 'render.js', 'ui.js', 'main.js']) {
  vm.runInContext(fs.readFileSync(path.join(base, f), 'utf8'), ctxv, { filename: f });
}
const T = win.T;
T.Tex.build(); T.R.init(); T.UI.init(); T.W.setSeed(7);
T.G.started = true; T.G.time = 0.2;
const p = T.E.createPlayer(8, (T.W.surfaceY(0) - 3) * 16);
for (let i = 0; i < 200; i++) T.E.moveEnt(p, 1 / 60);
T.R.cam.x = p.x - T.R.vw() / 2; T.R.cam.y = p.y - T.R.vh() / 2;

/* 造水池 */
const by = Math.floor((p.y + p.h) / 16);
const bx = Math.floor(p.x / 16) - 2;
for (let x = bx; x < bx + 6; x++) {
  T.W.setTile(x, by - 1, 0); T.W.setTile(x, by - 2, 0); T.W.setTile(x, by - 3, 0);
  for (let y = by - 3; y < by; y++) { T.W.setLiqRaw(x, y, (1 << 4) | 8); T.W.queueLiquid(x, y); }
}
for (let x = bx; x < bx + 6; x++) { T.W.setTile(x, by, T.TID.STONE); T.W.markMod(x, by); }
for (let i = 0; i < 200; i++) T.W.updateLiquid(3000);
T.W.processLight();
calls.length = 0;
T.R.draw(1 / 60);

/* 找出金色填充 */
const gold = calls.filter(c => {
  const s = String(c[1]);
  return /^rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(s);
}).filter(c => {
  const m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(String(c[1]));
  const r = +m[1], g = +m[2], b = +m[3];
  return r > 170 && g > 120 && b < 90 && r - b > 120;
});
console.log('金色类绘制调用:', gold.length);
const seen = new Set();
for (const c of gold) {
  const k = c[0] + String(c[1]) + JSON.stringify(c.slice(2, 5));
  if (seen.has(k)) continue;
  seen.add(k);
  console.log(' ', c[0], String(c[1]).slice(0, 40), '参数', c.slice(2).map(v => typeof v === 'number' ? v.toFixed(1) : v).join(','));
}
console.log('总绘制调用', calls.length);
const cols = {};
for (const c of calls) {
  if (c[0] !== 'fillRect' && c[0] !== 'strokeRect' && c[0] !== 'fill') continue;
  const s2 = String(c[1]);
  cols[s2] = (cols[s2] || 0) + 1;
}
console.log('矩形颜色统计:');
for (const k in cols) console.log('   ', k, cols[k]);
/* 统计 drawImage 的来源贴图 */
const usage = {};
for (const c of calls) {
  if (c[0] !== 'drawImage') continue;
  const src = c[1];
  const n = (src && src.__name) || (src && src.__tag) || 'unknown';
  usage[n] = (usage[n] || 0) + 1;
}
console.log('drawImage 来源统计:', JSON.stringify(usage));
