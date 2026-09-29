/* ==========================================================================
   world.js —— 区块地形生成 / 方块读写 / 液体 / 光照 / 存档
   ========================================================================== */
(function (T) {
'use strict';
const TID = T.TID;
const CW = 64, H = 320, TILE = 16;
const W = {};
T.W = W;
W.CW = CW; W.H = H; W.TILE = TILE;

/* 液体编码：0 = 无，(type<<4)|level，type 1=水 2=岩浆，level 1..8 */
const W_WATER = 1, W_LAVA = 2;

let seed = 1;
let chunks = new Map();
let mods = new Map();          // cx -> {t:Uint8Array, w:Uint8Array} 玩家改动（也用于存档）
W.chests = new Map();          // "x,y" -> {items:[]}

W.setSeed = function (s) {
  seed = s >>> 0;
  chunks = new Map(); mods = new Map();
  W.chunks = chunks; W.mods = mods; W.chests = new Map();
};
W.getSeed = () => seed;
W.chunks = chunks;
W.mods = mods;

/* ------------------------------------------------------------------
   地形函数
------------------------------------------------------------------ */
const biomes = new Map();
function biomeAt(x) {
  const b = T.fbm(x * 0.0017, 7.7, seed + 91, 2);
  if (b > 0.615) return 1;      // 沙漠
  if (b < 0.415) return 2;      // 森林
  return 0;                    // 平原
}
function surfaceY(x) {
  let h = 98 + T.fbm(x * 0.011, 3.3, seed + 11, 4) * 42;
  h += T.fbm(x * 0.043, 9.1, seed + 23, 2) * 5;
  if (biomeAt(x) === 1) h += 2;
  return Math.max(70, Math.min(150, Math.round(h)));
}
W.surfaceY = surfaceY;
W.biomeAt = biomeAt;

function dirtDepth(x) { return 16 + T.fbm(x * 0.02, 55, seed + 41, 2) * 22; }

const UW = 250;   // 下界起始 y
W.UNDERWORLD = UW;

function isCave(x, y, sy) {
  if (y < sy + 4) return false;
  const v = sv(COLB[F_CAVE1], y) * 0.62 + sv(COLB[F_CAVE2], y) * 0.38;
  let thr = 0.632;
  if (y > 150) thr = 0.607;          // 洞穴层更大
  if (y > UW) thr = 0.600;
  return v > thr;
}

/* ------------------------------------------------------------------
   粗网格噪声场：把高频 fbm 预计算成 1/4 格分辨率的网格；
   再按“列”预插值，采样时只需对 y 做一次线性插值。
------------------------------------------------------------------ */
const CS = 4;                       // 采样步长（格）
const GW = (CW / CS) + 3;           // 每块 19 个采样点
const GH = (H / CS) + 3;            // 每块 83 个采样点

const FIELD_DEF = [
  ['cave1', 0.052, 0.072, 31, 2], ['cave2', 0.052, 0.072, 57, 2],
  ['slate', 0.030, 0.030, 66, 1], ['marble', 0.045, 0.045, 121, 2],
  ['oreC', 0.140, 0.140, 201, 1], ['oreI', 0.130, 0.130, 202, 1],
  ['oreG', 0.120, 0.120, 203, 1], ['oreA', 0.160, 0.160, 204, 1],
  ['oreTo', 0.160, 0.160, 205, 1], ['oreE', 0.160, 0.160, 206, 1],
  ['pool', 0.060, 0.080, 303, 1], ['hell', 0.100, 0.100, 88, 1]
];
const F_CAVE1 = 0, F_CAVE2 = 1, F_SLATE = 2, F_MARBLE = 3, F_OREC = 4, F_OREI = 5,
  F_OREG = 6, F_OREA = 7, F_ORETO = 8, F_OREE = 9, F_POOL = 10, F_HELL = 11;
const NF = FIELD_DEF.length;

let FLD = null;          // 当前区块的粗网格
let COLB = null;         // 当前列的预插值缓冲
let FLX0 = 0;

function buildFields(x0) {
  const F = new Array(NF);
  const xs = x0 - CS;
  for (let f = 0; f < NF; f++) {
    const d = FIELD_DEF[f], a = new Float32Array(GW * GH);
    for (let j = 0; j < GH; j++) {
      const wy = -CS + j * CS;
      for (let i = 0; i < GW; i++) {
        a[j * GW + i] = T.fbm((xs + i * CS) * d[1], wy * d[2], seed + d[3], d[4]);
      }
    }
    F[f] = a;
  }
  return F;
}
/* 为 x 这一列做 x 方向插值 */
function prepColumn(x) {
  let fx = (x - FLX0) / CS;
  if (fx < 0) fx = 0; else if (fx > GW - 1.001) fx = GW - 1.001;
  const i = fx | 0, tx = fx - i;
  for (let f = 0; f < NF; f++) {
    const a = FLD[f], b = COLB[f];
    for (let j = 0; j < GH; j++) {
      const r = j * GW + i;
      b[j] = a[r] + (a[r + 1] - a[r]) * tx;
    }
  }
}
/* y 方向线性插值 */
function sv(b, y) {
  let fy = (y + CS) / CS;
  if (fy < 0) fy = 0; else if (fy > GH - 1.001) fy = GH - 1.001;
  const j = fy | 0, ty = fy - j;
  return b[j] + (b[j + 1] - b[j]) * ty;
}

/* ------------------------------------------------------------------
   区块
------------------------------------------------------------------ */
function newChunk(cx) {
  return {
    cx: cx, tiles: new Uint8Array(CW * H), walls: new Uint8Array(CW * H),
    liq: new Uint8Array(CW * H), light: new Uint8Array(CW * H),
    top: new Uint16Array(CW)
  };
}
W.newChunk = newChunk;

function idx(ch, lx, y) { return y * CW + lx; }

W.chunkAt = function (x, create) {
  const cx = x >> 6;
  let c = chunks.get(cx);
  if (!c && create) { c = W.ensure(cx); }
  return c;
};

W.ensure = function (cx) {
  let c = chunks.get(cx);
  if (c) return c;
  c = genChunk(cx);
  chunks.set(cx, c);
  return c;
};

function genChunk(cx) {
  const ch = newChunk(cx);
  const x0 = cx * CW;
  FLD = buildFields(x0);
  if (!COLB) COLB = [];
  for (let f = 0; f < NF; f++) if (!COLB[f]) COLB[f] = new Float32Array(GH);
  FLX0 = x0 - CS;

  for (let lx = 0; lx < CW; lx++) {
    const x = x0 + lx;
    prepColumn(x);
    const bio = biomeAt(x);
    const sy = surfaceY(x);
    const dd = dirtDepth(x);
    const isLake = T.fbm(x * 0.02, 50, seed + 77, 2) > 0.700 && sy > 112;
    for (let y = 0; y < H; y++) {
      const i = idx(ch, lx, y);
      let t = 0;
      if (y >= H - 2) { ch.tiles[i] = TID.BEDROCK; continue; }
      if (y >= sy) {
        if (y >= UW) t = (y > 282 && sv(COLB[F_HELL], y) > 0.60) ? TID.HELLSTONE : TID.ASH;
        else if (y < sy + dd) t = (bio === 1) ? TID.SAND : TID.DIRT;
        else t = (y > 140 && sv(COLB[F_SLATE], y) > 0.575) ? TID.SLATE : TID.STONE;
        if (y === sy) t = (bio === 1 || isLake) ? TID.SAND : TID.GRASS;
      }
      ch.tiles[i] = t;
    }
    /* 挖洞 */
    for (let y = sy + 4; y < H - 2; y++) {
      if (isCave(x, y, sy)) {
        ch.tiles[idx(ch, lx, y)] = 0;
        if (ch.tiles[idx(ch, lx, y + 1)] === TID.GRASS) ch.tiles[idx(ch, lx, y + 1)] = TID.DIRT;
      }
    }
    /* 大理石补丁 */
    for (let y = 120; y < 240; y++) {
      const i = idx(ch, lx, y);
      if (ch.tiles[i] === TID.STONE && sv(COLB[F_MARBLE], y) > 0.68) ch.tiles[i] = TID.MARBLE;
    }
    /* 矿脉 */
    const copperTop = sy + 8;
    for (let y = 0; y < H; y++) {
      const i = idx(ch, lx, y);
      const cur = ch.tiles[i];
      if (cur !== TID.STONE && cur !== TID.SLATE) continue;
      if (y >= copperTop && y <= 200 && sv(COLB[F_OREC], y) > 0.655) ch.tiles[i] = TID.COPPER;
      else if (y >= 70 && y <= 230 && sv(COLB[F_OREI], y) > 0.675) ch.tiles[i] = TID.IRON;
      else if (y >= 140 && y <= 280 && sv(COLB[F_OREG], y) > 0.690) ch.tiles[i] = TID.GOLD;
      else if (y >= 130 && y <= 260 && sv(COLB[F_OREA], y) > 0.730) ch.tiles[i] = TID.AMETHYST;
      else if (y >= 150 && y <= 280 && sv(COLB[F_ORETO], y) > 0.730) ch.tiles[i] = TID.TOPAZ;
      else if (y >= 175 && y <= 300 && sv(COLB[F_OREE], y) > 0.735) ch.tiles[i] = TID.EMERALD;
    }
    /* 水：湖泊 / 洞穴水洼 / 下界岩浆海 */
    if (isLake) {
      for (let y = sy - 3; y <= sy; y++) ch.liq[idx(ch, lx, y)] = (W_WATER << 4) | 8;
    }
    for (let y = 150; y < UW - 6; y++) {
      const i = idx(ch, lx, y);
      if (ch.tiles[i] === 0 && (ch.tiles[i + CW] !== 0 || ch.tiles[i - CW] !== 0)) {
        if (sv(COLB[F_POOL], y) > 0.700) ch.liq[i] = (W_WATER << 4) | 8;
      }
    }
    for (let y = 290; y < H - 3; y++) {
      const i = idx(ch, lx, y);
      if (ch.tiles[i] === 0) ch.liq[i] = (W_LAVA << 4) | 8;
    }
    /* 装饰植物 */
    const rr = T.hash2(x, 5, seed);
    const topTile = ch.tiles[idx(ch, lx, sy)];
    if (topTile === TID.GRASS && ch.tiles[idx(ch, lx, sy - 1)] === 0 && sy - 1 > 2) {
      if (rr < 0.30) ch.tiles[idx(ch, lx, sy - 1)] = TID.TALLGRASS;
      else if (rr < 0.36) ch.tiles[idx(ch, lx, sy - 1)] = TID.FLOWER;
    } else if (topTile === TID.SAND && ch.tiles[idx(ch, lx, sy - 1)] === 0 && sy - 1 > 2) {
      if (rr < 0.05) {
        const th = 2 + (T.hash2(x, 9, seed) * 3 | 0);
        for (let k = 0; k < th; k++) ch.tiles[idx(ch, lx, sy - 1 - k)] = TID.CACTUS;
      }
    }
    /* 洞穴地面装饰（只长在地下） */
    for (let y = sy + 8; y < H - 3; y++) {
      const i = idx(ch, lx, y);
      if (ch.tiles[i] === 0 && ch.tiles[i + CW] !== 0 && ch.tiles[i - 1] === 0) {
        const d = T.tile(ch.tiles[i + CW]);
        if (d.solid && d.tier === 0 && d.tex !== 'bedrock') {
          const h2 = T.hash2(x, y, seed + 5);
          if (y > UW + 4) { if (h2 < 0.10) ch.tiles[i] = TID.MUSHROOM; }
          else if (h2 < 0.035) ch.tiles[i] = TID.MUSHROOM;
          else if (y > 140 && h2 < 0.10) ch.tiles[i] = TID.GLOWMOSS;
        }
      }
    }
  }

  /* 树木 */
  for (let x = x0 - 12; x < x0 + CW + 12; x++) treePass(ch, x);

  for (let x = x0 - 10; x < x0 + CW + 10; x++) cabinPass(ch, x);

  /* 应用玩家改动 */
  const md = mods.get(cx);
  if (md) {
    for (let i = 0; i < md.t.length; i++) {
      if (md.t[i]) ch.tiles[i] = md.t[i];
      if (md.w[i]) ch.walls[i] = md.w[i];
    }
  }

  for (let lx = 0; lx < CW; lx++) recomputeTop(ch, lx);
  /* 初始化光源 */
  for (let lx = 0; lx < CW; lx++) {
    for (let y = 0; y < H; y++) {
      const t = ch.tiles[idx(ch, lx, y)];
      const def = T.tile(t);
      if (def.light) W.addLight(x0 + lx, y, def.light);
    }
  }
  /* 让初始水体沉降 */
  for (let lx = 0; lx < CW; lx++) {
    for (let y = 0; y < H; y++) {
      const v = ch.liq[idx(ch, lx, y)];
      if (!v) continue;
      const above = y > 0 ? ch.liq[idx(ch, lx, y - 1)] : 0;
      if ((v & 15) < 8 || !above) W.queueLiquid(x0 + lx, y);
    }
  }
  return ch;
}

function treePass(ch, x) {
  const cx = ch.cx, lx = x - cx * CW;
  if (lx < 0 || lx >= CW) return;
  const bio = biomeAt(x);
  if (bio === 1) return;
  const density = bio === 2 ? 0.030 : 0.013;
  if (T.hash2(x, 3, seed + 5) > density) return;
  const sy = surfaceY(x);
  const i = idx(ch, lx, sy);
  if (ch.tiles[i] !== TID.GRASS) return;
  const h = 6 + (T.hash2(x, 4, seed + 5) * 9 | 0);
  const top = sy - h;
  if (top < 4) return;
  /* 树干 */
  for (let y = sy; y > top; y--) ch.tiles[idx(ch, lx, y)] = TID.WOOD;
  /* 树冠 */
  const put = (xx, yy) => {
    if (xx < cx * CW || xx >= cx * CW + CW) return;
    const l2 = xx - cx * CW;
    if (yy < 1 || yy >= H) return;
    const k = idx(ch, l2, yy);
    if (ch.tiles[k] === 0 || ch.tiles[k] === TID.LEAVES) ch.tiles[k] = TID.LEAVES;
  };
  /* 树冠：圆润的椭圆轮廓 + 随机缺口 */
  for (let dy = 0; dy <= 6; dy++) {
    const t = dy / 6;
    const r = 3.0 * Math.sin(Math.PI * (0.20 + t * 0.66));
    for (let dx = -4; dx <= 4; dx++) {
      const d = Math.abs(dx) - r;
      if (d <= 0 || (d < 0.9 && T.hash2(x + dx, top + dy, seed + 7) < 0.6)) put(x + dx, top + dy);
    }
  }
}

function cabinPass(ch, x) {
  const cx = ch.cx;
  if (T.hash2(x, 991, seed + 17) > 0.010) return;
  const y0 = 150 + (T.hash2(x, 992, seed + 17) * (UW - 175) | 0);
  const x0 = x - 5;
  const put = (xx, yy, t) => {
    if (xx < cx * CW || xx >= cx * CW + CW || yy < 1 || yy >= H) return;
    const k = idx(ch, xx - cx * CW, yy);
    if (t) ch.tiles[k] = t;
    else { ch.tiles[k] = 0; ch.walls[k] = 0; }
  };
  for (let xx = x0; xx <= x0 + 10; xx++) for (let yy = y0; yy <= y0 + 5; yy++) put(xx, yy, 0);
  for (let xx = x0 + 1; xx <= x0 + 9; xx++) { put(xx, y0, TID.WALL_WOOD); put(xx, y0 + 5, TID.WALL_WOOD); }
  for (let yy = y0; yy <= y0 + 5; yy++) { put(x0, yy, TID.WALL_WOOD); put(x0 + 10, yy, TID.WALL_WOOD); }
  put(x0 + 5, y0 + 5, TID.AIR);
  put(x0 + 2, y0, TID.TORCH); put(x0 + 8, y0, TID.TORCH);
  put(x0 + 1, y0 + 4, TID.BENCH);
  put(x0 + 8, y0 + 4, TID.CHEST);
  put(x0 + 6, y0 + 4, TID.FLOWER);
}

/* ------------------------------------------------------------------
   读写
------------------------------------------------------------------ */
W.tile = function (x, y) {
  if (y < 0) return 0;
  if (y >= H) return TID.BEDROCK;
  const c = chunks.get(x >> 6);
  if (!c) return -1;                 // 未生成
  return c.tiles[(y << 6) + (x & 63)];
};
W.tileOrGen = function (x, y) {
  if (y < 0) return 0;
  if (y >= H) return TID.BEDROCK;
  const cx = x >> 6;
  const c = chunks.get(cx) || W.ensure(cx);
  return c.tiles[(y << 6) + (x & 63)];
};
W.wall = function (x, y) {
  if (y < 0 || y >= H) return 0;
  const c = chunks.get(x >> 6);
  return c ? c.walls[(y << 6) + (x & 63)] : 0;
};
W.def = function (x, y) { return T.tile(W.tile(x, y)); };
W.solid = function (x, y) { const t = W.tile(x, y); return t < 0 ? false : T.tile(t).solid; };
W.liq = function (x, y) {
  if (y < 0 || y >= H) return 0;
  const c = chunks.get(x >> 6);
  return c ? c.liq[(y << 6) + (x & 63)] : 0;
};
W.lightAt = function (x, y) {
  if (y < 0 || y >= H) return 0;
  const c = chunks.get(x >> 6);
  return c ? c.light[(y << 6) + (x & 63)] : 0;
};
W.topAt = function (x) {
  const c = chunks.get(x >> 6);
  return c ? c.top[x & 63] : surfaceY(x);
};
W.liqType = (v) => v >> 4;
W.liqLevel = (v) => v & 15;

W.canHoldLiq = function (x, y) {
  if (y < 0 || y >= H - 2) return false;
  const t = W.tileOrGen(x, y);
  if (t < 0) return false;
  const d = T.tile(t);
  return !d.solid && !d.furn && !d.platform;
};

function modFor(cx) {
  let m = mods.get(cx);
  if (!m) { m = { t: new Uint8Array(CW * H), w: new Uint8Array(CW * H) }; mods.set(cx, m); }
  return m;
}
W.markMod = function (x, y) {
  const cx = x >> 6, c = chunks.get(cx);
  if (!c) return;
  const m = modFor(cx);
  const i = (y << 6) + (x & 63);
  m.t[i] = c.tiles[i];
  m.w[i] = c.walls[i];
};

function recomputeTop(ch, lx) {
  let y = 0;
  for (; y < H; y++) {
    if (T.tile(ch.tiles[(y << 6) + lx]).opaque) break;
  }
  ch.top[lx] = y;
}
W.recomputeTopAt = function (x) {
  const c = chunks.get(x >> 6);
  if (c) recomputeTop(c, x & 63);
};

/* 家具整体坐标 */
W.furnOrigin = function (x, y, id) {
  const d = T.tile(id).furn;
  if (!d) return { x: x, y: y, w: 1, h: 1 };
  let ox = x, oy = y;
  for (let k = 1; k < d.w; k++) { if (W.tile(x - k, y) === id) ox = x - k; else break; }
  for (let k = 1; k < d.h; k++) { if (W.tile(x, y - k) === id) oy = y - k; else break; }
  return { x: ox, y: oy, w: d.w, h: d.h };
};

W.setTile = function (x, y, id, opts) {
  if (y < 0 || y >= H) return false;
  const cx = x >> 6;
  const c = chunks.get(cx) || W.ensure(cx);
  const i = (y << 6) + (x & 63);
  const old = c.tiles[i];
  if (old === id) return false;
  const oldDef = T.tile(old), newDef = T.tile(id);

  /* 拆家具：整块一起消失 */
  if (opts !== 'keepFurn' && oldDef.furn && id === 0) {
    const o = W.furnOrigin(x, y, old);
    if (!(o.w === 1 && o.h === 1)) {
      for (let a = 0; a < o.w; a++) for (let b = 0; b < o.h; b++) { rawSet(o.x + a, o.y + b, 0); W.markMod(o.x + a, o.y + b); }
      W.onTilesChanged(o.x - 1, o.y - 1, o.w + 2, o.h + 2);
      return true;
    }
  }
  rawSet(x, y, id);
  /* 掀掉草皮后，下面的草变成泥土 */
  if (old === TID.GRASS && id === 0) {
    const below = W.tile(x, y + 1);
    if (below === TID.GRASS) { rawSet(x, y + 1, TID.DIRT); W.markMod(x, y + 1); W.recomputeTopAt(x); }
  }

  /* 光照 */
  if (oldDef.light) removeLight(x, y);
  if (newDef.light) addLight(x, y, newDef.light);
  /* 背景墙透光不算 */
  W.markMod(x, y);
  W.onTilesChanged(x - 1, y - 1, 3, 3);
  return true;
};

function rawSet(x, y, id) {
  if (y < 0 || y >= H) return;
  const c = chunks.get(x >> 6) || W.ensure(x >> 6);
  const i = (y << 6) + (x & 63);
  c.tiles[i] = id;
}

W.onTilesChanged = function (x0, y0, w, h) {
  for (let a = 0; a < w; a++) {
    const x = x0 + a;
    W.recomputeTopAt(x);
    for (let b = 0; b < h; b++) W.queueLiquid(x, y0 + b);
  }
  for (let a = -1; a <= w; a++) for (let b = -1; b <= h; b++) W.queueLiquid(x0 + a, y0 + b);
};

W.setWall = function (x, y, id) {
  if (y < 0 || y >= H) return false;
  const c = chunks.get(x >> 6) || W.ensure(x >> 6);
  const i = (y << 6) + (x & 63);
  if (c.walls[i] === id) return false;
  c.walls[i] = id;
  W.markMod(x, y);
  if (id && T.tile(id).light) addLight(x, y, T.tile(id).light);
  else if (!id) { /* 墙不影响光源 */ }
  return true;
};

/* ------------------------------------------------------------------
   光照（方块光源 BFS）
------------------------------------------------------------------ */
const lq = [];
W.addLight = function (x, y, v) { if (v > 0) lq.push(x, y, v); W.lightDirty = true; };
W.removeLight = function (x, y) { rq.push(x, y); W.lightDirty = true; };

function addLight(x, y, v) {
  /* 栈式 BFS：q = [x, y, v, x, y, v, ...]（后进先出） */
  const q = [x, y, v];
  while (q.length) {
    const cv = q.pop(), cy = q.pop(), cx = q.pop();
    if (cv <= 0 || cy < 0 || cy >= H) continue;
    const c = chunks.get(cx >> 6);
    if (!c) continue;
    const i = (cy << 6) + (cx & 63);
    if (c.light[i] >= cv) continue;
    c.light[i] = cv;
    const nv = cv - 1;
    if (nv <= 0) continue;
    const n1 = chunks.get((cx + 1) >> 6); if (n1) q.push(cx + 1, cy, nv);
    const n2 = chunks.get((cx - 1) >> 6); if (n2) q.push(cx - 1, cy, nv);
    if (cy < H - 1) q.push(cx, cy + 1, nv);
    if (cy > 0) q.push(cx, cy - 1, nv);
  }
}

function removeLight(x, y) {
  const c = chunks.get(x >> 6);
  if (!c) return;
  const i = (y << 6) + (x & 63);
  const start = c.light[i];
  if (start === 0) return;
  c.light[i] = 0;
  const q = [x, y, start];
  const zeroed = [x, y];
  while (q.length) {
    const cv = q.pop(), cy = q.pop(), cx = q.pop();
    /* 四个邻居 */
    for (let k = 0; k < 4; k++) {
      const nx = k === 0 ? cx + 1 : k === 1 ? cx - 1 : cx;
      const ny = k === 2 ? cy + 1 : k === 3 ? cy - 1 : cy;
      if (ny < 0 || ny >= H) continue;
      const nc = chunks.get(nx >> 6);
      if (!nc) continue;
      const ni = (ny << 6) + (nx & 63);
      const nl = nc.light[ni];
      if (nl !== 0 && nl < cv) { nc.light[ni] = 0; q.push(nx, ny, nl); zeroed.push(nx, ny); }
    }
  }
  /* 从被清除区域的边缘重新传播 */
  for (let k = 0; k < zeroed.length; k += 2) {
    const zx = zeroed[k], zy = zeroed[k + 1];
    for (let m = 0; m < 4; m++) {
      const nx = m === 0 ? zx + 1 : m === 1 ? zx - 1 : zx;
      const ny = m === 2 ? zy + 1 : m === 3 ? zy - 1 : zy;
      if (ny < 0 || ny >= H) continue;
      const nc = chunks.get(nx >> 6);
      if (!nc) continue;
      const nl = nc.light[(ny << 6) + (nx & 63)];
      if (nl > 0) addLight(nx, ny, nl);
    }
  }
}

W.processLight = function () {
  if (rq.length) {
    while (rq.length) { const y = rq.pop(), x = rq.pop(); removeLight(x, y); }
  }
  if (lq.length) {
    while (lq.length) { const v = lq.pop(), y = lq.pop(), x = lq.pop(); addLight(x, y, v); }
  }
  W.lightDirty = false;
};
const rq = [];

/* ------------------------------------------------------------------
   液体
------------------------------------------------------------------ */
const liqQ = new Set();
const liqList = [];
W.queueLiquid = function (x, y) {
  if (y < 0 || y >= H) return;
  const k = (x << 10) + y;
  if (liqQ.has(k)) return;
  liqQ.add(k); liqList.push(x, y);
};

W.setLiqRaw = function (x, y, v) {
  if (y < 0 || y >= H) return;
  /* 净化：类型只能是 1(水)/2(岩浆)，液量 1~8，其余一律清空 */
  v = v | 0;
  if (v) {
    const t = v >> 4, l = v & 15;
    v = ((t === 1 || t === 2) && l > 0 && l <= 8) ? (t << 4) | l : 0;
  }
  const c = chunks.get(x >> 6);
  if (c) c.liq[(y << 6) + (x & 63)] = v;
};

function addLiq(x, y, type, n) {
  if (!W.canHoldLiq(x, y)) return 0;
  const v = W.liq(x, y);
  const t = v >> 4, l = v & 15;
  if (v && t !== type) return 0;
  const room = 8 - l;
  const give = Math.min(n, room);
  if (give <= 0) return 0;
  const base = v ? (v & 0xF0) : (type << 4);
  W.setLiqRaw(x, y, base + l + give);
  return give;
}
W.addLiq = addLiq;

function stepLiquid(x, y) {
  let v = W.liq(x, y);
  if (!v) return;
  let type = v >> 4, lvl = v & 15;
  if ((type !== 1 && type !== 2) || lvl > 8) { W.setLiqRaw(x, y, 0); return; }
  /* 水岩浆相变 */
  if (type === W_LAVA) {
    const nb = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
    for (let k = 0; k < 4; k++) {
      const w2 = W.liq(nb[k][0], nb[k][1]);
      if ((w2 >> 4) === W_WATER && (w2 & 15) > 0) {
        for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++)
          if (W.liq(x + a, y + b) && (W.liq(x + a, y + b) >> 4) === W_LAVA) W.setLiqRaw(x + a, y + b, 0);
        W.setLiqRaw(x, y, 0);
        rawSet(x, y, TID.SLATE);
        W.markMod(x, y);
        W.recomputeTopAt(x);
        T.snd.play('smelt', .3);
        return;
      }
    }
  }
  let rest = lvl;
  /* 下落 */
  if (y + 1 < H) {
    const bv = W.liq(x, y + 1);
    if (W.canHoldLiq(x, y + 1) && (bv === 0 || (bv >> 4) === type)) {
      const give = addLiq(x, y + 1, type, rest);
      if (give > 0) {
        W.setLiqRaw(x, y, type * 16 + (rest - give));
        W.queueLiquid(x, y + 1);
        if (rest - give === 0) return;
        rest -= give;
      }
    }
  }
  /* 侧向扩散 */
  if (rest >= 2) {
    const give = Math.ceil(rest / 2);
    for (let s = -1; s <= 1; s += 2) {
      const nx = x + s;
      const bv = W.liq(nx, y);
      if (W.canHoldLiq(nx, y) && (bv === 0 || (bv >> 4) === type)) {
        const g2 = addLiq(nx, y, type, Math.min(give, 8 - (bv & 15)));
        if (g2 > 0) { W.setLiqRaw(x, y, type * 16 + (rest - g2)); W.queueLiquid(nx, y); rest -= g2; }
      }
    }
  }
  /* 清理残液 */
  if ((W.liq(x, y) & 15) <= 0) W.setLiqRaw(x, y, 0);
}

W.updateLiquid = function (budget) {
  let n = 0;
  const lim = budget || 2200;
  while (liqList.length && n < lim) {
    const y = liqList.pop(), x = liqList.pop();
    liqQ.delete((x << 10) + y);
    stepLiquid(x, y);
    n++;
  }
};

/* 玩家挖开水下方块时，水从邻格流入 */
W.flowInto = function (x, y) {
  const nb = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
  for (let k = 0; k < 4; k++) {
    const nx = nb[k][0], ny = nb[k][1];
    const v = W.liq(nx, ny);
    if (!v) continue;
    const type = v >> 4;
    if (W.canHoldLiq(x, y)) { addLiq(x, y, type, 8 - (W.liq(x, y) & 15)); W.queueLiquid(x, y); }
  }
};

/* ------------------------------------------------------------------
   便捷查询
------------------------------------------------------------------ */
W.hasBench = function (px, py, r) {
  r = r || 5;
  const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
  for (let y = ty - r; y <= ty + r; y++) for (let x = tx - r; x <= tx + r; x++) {
    const t = W.tileOrGen(x, y);
    if (t === TID.BENCH) return true;
  }
  return false;
};
W.hasFurnace = function (px, py, r) {
  r = r || 5;
  const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
  for (let y = ty - r; y <= ty + r; y++) for (let x = tx - r; x <= tx + r; x++) {
    const t = W.tileOrGen(x, y);
    if (t === TID.FURNACE) return true;
  }
  return false;
};

/* 玩家落脚点检查 */
W.boxSolid = function (x, y, w, h) {
  const x0 = Math.floor(x / TILE), x1 = Math.floor((x + w - 0.001) / TILE);
  const y0 = Math.floor(y / TILE), y1 = Math.floor((y + h - 0.001) / TILE);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
    if (W.solid(tx, ty)) return true;
  }
  return false;
};

/* ------------------------------------------------------------------
   存档
------------------------------------------------------------------ */
function rle(arr) {
  const out = [];
  let v = arr[0], c = 0;
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] === v && c < 65000) c++;
    else { out.push(v, c); v = arr[i]; c = 1; }
  }
  out.push(v, c);
  return out;
}
function unrle(list, arr) {
  let p = 0;
  for (let i = 0; i < list.length; i += 2) {
    const v = list[i], c = list[i + 1];
    for (let k = 0; k < c && p < arr.length; k++) arr[p++] = v;
  }
  return arr;
}
W.rle = rle; W.unrle = unrle;

W.serialize = function () {
  const m = {};
  mods.forEach((v, k) => { m[k] = { t: rle(v.t), w: rle(v.w) }; });
  const ch = {};
  W.chests.forEach((v, k) => { if (v.items && v.items.length) ch[k] = v.items; });
  return { v: 1, seed: seed, mods: m, chests: ch };
};
W.deserialize = function (data) {
  W.setSeed(data.seed);
  W.chests = new Map();
  mods = new Map(); W.mods = mods;
  for (const k in data.mods) {
    const src = data.mods[k];
    const m = { t: unrle(src.t, new Uint8Array(CW * H)), w: unrle(src.w, new Uint8Array(CW * H)) };
    mods.set(+k, m);
  }
  if (data.chests) for (const k in data.chests) W.chests.set(k, { items: data.chests[k] });
};

})(window.T);
