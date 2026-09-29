/* ==========================================================================
   core.js —— 数学 / 随机 / 噪声 / 颜色 / 音效 / 输入
   ========================================================================== */
window.T = window.T || {};
(function (T) {
'use strict';

/* ---------------- 数学 ---------------- */
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);
const sign = Math.sign;
T.clamp = clamp; T.lerp = lerp; T.smooth = smooth; T.sign = sign;

const approach = (v, target, step) =>
  v < target ? Math.min(v + step, target) : Math.max(v - step, target);
T.approach = approach;

T.dist2 = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };

/* ---------------- 随机 ---------------- */
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
T.mulberry32 = mulberry32;

let seed = 1234;
T.setSeed = (s) => { seed = s >>> 0; };
T.rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
T.rndi = (a, b) => a + Math.floor(T.rnd() * (b - a + 1));
T.rndc = (cx, cy) => hash2(cx, cy, seed);
T.pick = (arr) => arr[Math.floor(T.rnd() * arr.length) % arr.length];

/* 整数哈希 → [0,1) */
function hash2(x, y, s) {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(s | 0, 0x9e3779b9);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
T.hash2 = hash2;

/* 二维值噪声 */
function noise2(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const u = smooth(x - xi), v = smooth(y - yi);
  const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s);
  const c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}
T.noise2 = noise2;

function fbm(x, y, s, oct, lac, gain) {
  oct = oct || 4; lac = lac || 2; gain = gain || 0.5;
  let sum = 0, norm = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) {
    sum += a * noise2(x * f, y * f, s + i * 1013);
    norm += a; a *= gain; f *= lac;
  }
  return sum / norm;
}
T.fbm = fbm;

/* ---------------- 颜色 ---------------- */
function hex2rgb(h) {
  h = h.replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
T.hex2rgb = hex2rgb;
T.rgb2hex = (r, g, b) => '#' + ((1 << 24) | (clamp(r | 0, 0, 255) << 16) | (clamp(g | 0, 0, 255) << 8) | clamp(b | 0, 0, 255)).toString(16).slice(1);
T.shade = (c, k) => T.rgb2hex(c[0] * k, c[1] * k, c[2] * k);
T.mixc = (a, b, t) => T.rgb2hex(lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t));

/* ---------------- Canvas 小工具 ---------------- */
T.mkCanvas = (w, h) => {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  return { c: c, x: x };
};

/* ---------------- 输入 ---------------- */
T.input = {
  keys: Object.create(null),
  pressed: Object.create(null),   // 本帧刚按下
  mx: 0, my: 0,                  // 鼠标（CSS 像素）
  wx: 0, wy: 0,                  // 鼠标（世界像素）
  down: [false, false, false],
  clicked: [false, false, false],
  wheel: 0,
  anyGesture: false
};
window.addEventListener('keydown', (e) => {
  const k = e.code;
  if (!T.input.keys[k]) T.input.pressed[k] = true;
  T.input.keys[k] = true;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].indexOf(k) >= 0) e.preventDefault();
  T.snd.unlock();
});
window.addEventListener('keyup', (e) => { T.input.keys[e.code] = false; });
window.addEventListener('blur', () => { T.input.keys = Object.create(null); T.input.down = [false, false, false]; });

/* ---------------- 音效（WebAudio 合成，无外部资源） ---------------- */
const snd = {
  ctx: null, master: null, muted: false, noiseBuf: null,
  unlock() {
    if (snd.ctx) { if (snd.ctx.state === 'suspended') snd.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      snd.ctx = new AC();
      snd.master = snd.ctx.createGain();
      snd.master.gain.value = 0.32;
      snd.master.connect(snd.ctx.destination);
      const len = snd.ctx.sampleRate * 0.6;
      const buf = snd.ctx.createBuffer(1, len, snd.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      snd.noiseBuf = buf;
    } catch (e) { /* 忽略 */ }
  },
  ok() { return snd.ctx && !snd.muted; },
  /* 单个振荡器音 */
  tone(o) {
    if (!snd.ok()) return;
    const c = snd.ctx, t0 = c.currentTime;
    const osc = c.createOscillator(), g = c.createGain();
    osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(o.f0, t0);
    if (o.f1) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), t0 + o.dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(o.vol || .2, t0 + (o.atk || .008));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
    osc.connect(g); g.connect(snd.master);
    osc.start(t0); osc.stop(t0 + o.dur + .02);
  },
  /* 噪声冲击（挖掘/破碎/脚步） */
  hit(o) {
    if (!snd.ok()) return;
    const c = snd.ctx, t0 = c.currentTime;
    const src = c.createBufferSource(); src.buffer = snd.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = o.filter || 'bandpass';
    f.frequency.setValueAtTime(o.f0 || 900, t0);
    if (o.f1) f.frequency.exponentialRampToValueAtTime(Math.max(40, o.f1), t0 + o.dur);
    f.Q.value = o.q || 1.2;
    const g = c.createGain();
    g.gain.setValueAtTime(o.vol || .2, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
    src.connect(f); f.connect(g); g.connect(snd.master);
    src.start(t0); src.stop(t0 + o.dur + .02);
  },
  /* 事件音表 */
  play(name, v) {
    v = v === undefined ? 1 : v;
    switch (name) {
      case 'dig':    snd.hit({ f0: 520 + Math.random() * 180, f1: 220, dur: .07, vol: .13 * v, q: .8 }); break;
      case 'break':  snd.hit({ f0: 1500, f1: 300, dur: .17, vol: .17 * v, filter: 'lowpass', q: .7 });
                    snd.tone({ type: 'triangle', f0: 190, f1: 70, dur: .14, vol: .09 * v }); break;
      case 'place':  snd.hit({ f0: 800, f1: 400, dur: .06, vol: .14 * v, q: 2 }); break;
      case 'step':   snd.hit({ f0: 380, f1: 180, dur: .05, vol: .055 * v, q: .6 }); break;
      case 'jump':   snd.tone({ type: 'square', f0: 300, f1: 560, dur: .1, vol: .07 * v }); break;
      case 'swing':  snd.hit({ f0: 2400, f1: 700, dur: .07, vol: .05 * v, filter: 'highpass' }); break;
      case 'hurt':   snd.tone({ type: 'sawtooth', f0: 320, f1: 110, dur: .22, vol: .15 * v });
                    snd.hit({ f0: 500, f1: 160, dur: .12, vol: .1 * v }); break;
      case 'hitmob': snd.hit({ f0: 700, f1: 180, dur: .1, vol: .16 * v, q: .5 });
                    snd.tone({ type: 'square', f0: 180, f1: 80, dur: .09, vol: .08 * v }); break;
      case 'die':    snd.tone({ type: 'triangle', f0: 200, f1: 40, dur: .7, vol: .18 * v }); break;
      case 'craft':  snd.tone({ type: 'square', f0: 520, dur: .08, vol: .1 * v });
                    setTimeout(() => snd.tone({ type: 'square', f0: 780, dur: .1, vol: .1 * v }), 80); break;
      case 'pickup': snd.tone({ type: 'sine', f0: 640, f1: 980, dur: .09, vol: .09 * v }); break;
      case 'splash': snd.hit({ f0: 2600, f1: 500, dur: .3, vol: .13 * v, filter: 'lowpass' }); break;
      case 'open':   snd.tone({ type: 'square', f0: 240, f1: 400, dur: .1, vol: .08 * v }); break;
      case 'door':   snd.hit({ f0: 400, f1: 140, dur: .12, vol: .12 * v, q: .5 }); break;
      case 'smelt':  snd.hit({ f0: 300, f1: 120, dur: .5, vol: .07 * v, filter: 'lowpass' }); break;
      case 'growl':  snd.tone({ type: 'sawtooth', f0: 95, f1: 62, dur: .75, vol: .1 * v, atk: .12 }); break;
      case 'eyefly':  snd.hit({ f0: 2000, f1: 900, dur: .18, vol: .05 * v, filter: 'bandpass', q: 3 }); break;
      case 'slime':   snd.tone({ type: 'sine', f0: 220, f1: 520, dur: .12, vol: .1 * v }); break;
      case 'sleep':   break;
      case 'heal':    snd.tone({ type: 'sine', f0: 520, f1: 880, dur: .22, vol: .11 * v }); break;
      case 'chest':   snd.tone({ type: 'triangle', f0: 440, f1: 660, dur: .16, vol: .1 * v }); break;
    }
  },
  toggle() { snd.muted = !snd.muted; return snd.muted; }
};
T.snd = snd;

/* ---------------- 通用小工具 ---------------- */
T.fmtTime = (t) => {                 // t∈[0,1) 一整天
  let h = 4.5 + t * 24;
  h = ((h % 24) + 24) % 24;
  const hh = Math.floor(h), mm = Math.floor((h - hh) * 60 / 5) * 5;
  const ampm = hh >= 12 ? 'PM' : 'AM';
  let h12 = hh % 12; if (h12 === 0) h12 = 12;
  return h12 + ':' + (mm < 10 ? '0' : '') + mm + ' ' + ampm;
};
T.isNight = (t) => t >= 0.62;

})(window.T);
