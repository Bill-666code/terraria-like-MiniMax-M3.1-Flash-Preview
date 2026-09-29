/* ==========================================================================
   render.js —— 天空 / 视差 / 方块 / 液体 / 光照 / 实体 / HUD
   ========================================================================== */
(function (T) {
'use strict';
const W = T.W, TID = T.TID, TS = 16, E = T.E;
const R = {};
T.R = R;

let cv, ctx, lightCv, lightCtx, lightImg;
let S = 2;                 // CSS 像素 / 世界像素
let vw = 800, vh = 600;    // 内部缓冲（世界像素）
R.S = () => S;

R.init = function () {
  cv = document.getElementById('game');
  ctx = cv.getContext('2d');
  const lm = T.mkCanvas(4, 4);
  lightCv = lm.c; lightCtx = lm.x;
  R.resize();
  window.addEventListener('resize', R.resize);
};

R.resize = function () {
  const w = window.innerWidth, h = window.innerHeight;
  S = w < 700 ? 2 : 2;
  cv.width = Math.ceil(w / S); cv.height = Math.ceil(h / S);
  cv.style.width = w + 'px'; cv.style.height = h + 'px';
  vw = cv.width; vh = cv.height;
  ctx.imageSmoothingEnabled = false;
};

/* ------------------------------------------------------------------
   相机
------------------------------------------------------------------ */
R.cam = { x: 0, y: 0, shake: 0 };
R.vw = () => vw; R.vh = () => vh;

R.updateCam = function (dt) {
  const p = E.P, G = T.G;
  if (!p) return;
  const cx = p.x + p.w / 2 + p.vx * 10;
  const cy = p.y + p.h / 2 + p.vy * 6;
  let tx = cx - vw / 2, ty = cy - vh / 2;
  const K = 1 - Math.pow(0.001, dt);
  R.cam.x += (tx - R.cam.x) * K;
  R.cam.y += (ty - R.cam.y) * K;
  if (R.cam.y < -vh * 0.55) R.cam.y = -vh * 0.55;
  if (R.cam.y > W.H * TS - vh * 0.45) R.cam.y = W.H * TS - vh * 0.45;
  R.cam.shake = Math.max(0, R.cam.shake - dt * 3.2);
  G.camX = R.cam.x; G.camY = R.cam.y;
};

/* ------------------------------------------------------------------
   天空颜色
   时间 t∈[0,1)：0 = 4:30 AM，0.0625 = 6:00 AM 日出，0.604 = 7:00 PM 日落
------------------------------------------------------------------ */
const T_SUNRISE = 0.0625, T_SUNSET = 0.604, T_NIGHT = 0.625;

/* 白昼强度 0..1 */
function dayFactor(t) {
  let d = 0;
  if (t > T_SUNRISE - 0.05 && t < T_SUNSET + 0.05) {
    d = T.clamp(Math.min(t - (T_SUNRISE - 0.05), (T_SUNSET + 0.05) - t) / 0.10, 0, 1);
  } else if (t >= T_SUNSET + 0.05 && t < T_SUNRISE + 1 - 0.05) {
    d = 0;
  }
  return Math.pow(d, 0.65);
}
/* 黎明/黄昏的暖色强度 */
function duskFactor(t) {
  const a = Math.max(0, 1 - Math.abs(t - T_SUNRISE) / 0.045);
  const b = Math.max(0, 1 - Math.abs(t - T_SUNSET) / 0.045);
  return Math.min(1, a + b);
}
function mix3(a, b, k) { return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]; }

function skyCol(t) {
  const d = dayFactor(t), k = duskFactor(t);
  let top = mix3([8, 11, 32], [92, 152, 238], d);
  let bot = mix3([18, 22, 56], [178, 214, 250], d);
  top = mix3(top, [96, 84, 150], k * .55);
  bot = mix3(bot, [248, 156, 92], k * .8);
  return [top, bot];
}
R.skyCol = skyCol;

/* 天空光颜色（乘算用） */
R.skyLight = function (t) {
  const d = dayFactor(t), k = duskFactor(t);
  let r = T.lerp(46, 255, d);
  let g = T.lerp(54, 253, d);
  let b = T.lerp(104, 242, d);
  r = T.lerp(r, 255, k * .5);
  g = T.lerp(g, 186, k * .45);
  b = T.lerp(b, 132, k * .5);
  return [r, g, b];
};
R.dayFactor = dayFactor;

/* ------------------------------------------------------------------
   主绘制
------------------------------------------------------------------ */
R.draw = function (dt) {
  const G = T.G, p = E.P;
  ctx.save();
  /* 震屏 */
  let sx = 0, sy = 0;
  if (R.cam.shake > 0) {
    sx = (Math.random() - .5) * R.cam.shake * 7;
    sy = (Math.random() - .5) * R.cam.shake * 7;
  }
  ctx.translate(Math.round(sx), Math.round(sy));

  const camX = Math.floor(R.cam.x), camY = Math.floor(R.cam.y);
  const tx0 = Math.floor(camX / TS), tx1 = Math.floor((camX + vw) / TS);
  const ty0 = Math.floor(camY / TS), ty1 = Math.floor((camY + vh) / TS);

  const only = G.only;
  const on = (k) => !only || only.indexOf(k) >= 0;
  if (on('sky')) { drawSky(G, camX, camY, tx0, tx1, ty0, ty1); drawParallax(G, camX, camY); drawUnderground(camX, camY, tx0, tx1, ty0, ty1); }
  if (on('wall')) drawWalls(camX, camY, tx0, tx1, ty0, ty1);
  if (on('tile')) drawTiles(camX, camY, tx0, tx1, ty0, ty1, G);
  if (on('liq')) drawLiquids(camX, camY, tx0, tx1, ty0, ty1, G);
  if (on('ent')) { drawDrops(camX, camY); drawMobs(camX, camY, G); if (p && !p.dead) drawPlayer(p, G); drawParticles(camX, camY); drawMining(gx0(), gy0()); }
  if (on('light')) drawLight(camX, camY, tx0, tx1, ty0, ty1, G);
  if (on('sky')) drawVignette(G);
  ctx.restore();
  if (on('hud')) drawHUD();
};
const gx0 = () => Math.floor(R.cam.x / TS), gy0 = () => Math.floor(R.cam.y / TS);

/* ---------------- 天空 ---------------- */
function drawSky(G, camX, camY, tx0, tx1, ty0, ty1) {
  const c = skyCol(G.time);
  const grd = ctx.createLinearGradient(0, 0, 0, vh);
  grd.addColorStop(0, `rgb(${c[0][0] | 0},${c[0][1] | 0},${c[0][2] | 0})`);
  grd.addColorStop(1, `rgb(${c[1][0] | 0},${c[1][1] | 0},${c[1][2] | 0})`);
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, vw, vh);

  /* 星空 */
  const night = T.clamp(1 - dayFactor(G.time) * 1.15, 0, 1);
  if (night > .05) {
    ctx.globalAlpha = night;
    for (let i = 0; i < 150; i++) {
      const sx = ((T.hash2(i, 1, 7) * 3000 - camX * 0.06) % (vw + 40) + vw + 40) % (vw + 40) - 20;
      const sy = T.hash2(i, 2, 7) * vh * 0.62 - camY * 0.02;
      if (sy < -10 || sy > vh) continue;
      const tw = .55 + .45 * Math.sin(G.time * 60 + i);
      ctx.fillStyle = `rgba(255,255,240,${(0.35 + T.hash2(i, 3, 7) * 0.65) * tw})`;
      const s = T.hash2(i, 4, 7) < .12 ? 2 : 1;
      ctx.fillRect(Math.round(sx), Math.round(sy), s, s);
    }
    ctx.globalAlpha = 1;
  }
  /* 日月 */
  const horizon = (W.surfaceY(Math.floor((camX + vw / 2) / TS)) * TS - camY);
  drawClouds(G, camX, camY, horizon);
  drawSunMoon(G, horizon, 0, true);
  drawSunMoon(G, horizon, 0, false);
  if (G.bloodMoon) {
    ctx.fillStyle = 'rgba(180,20,15,.22)';
    ctx.fillRect(0, 0, vw, vh);
  }
}

function drawSunMoon(G, horizon, _, isSun) {
  const t = G.time;
  const dayT = isSun ? (t - T_SUNRISE) / (T_SUNSET - T_SUNRISE) : (t - T_NIGHT) / (1.0625 - T_NIGHT);
  const p = dayT;                                // 0=东方地平线 1=西方地平线
  if (p < 0 || p > 1) return;
  const ang = p * Math.PI;
  const cx = vw / 2 - Math.cos(ang) * vw * 0.95;
  const cy = horizon - Math.sin(ang) * vh * 0.85 - 20;
  const r = isSun ? 17 : 14;
  ctx.save();
  if (isSun) {
    const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, r * 4.5);
    g.addColorStop(0, 'rgba(255,246,200,.55)');
    g.addColorStop(1, 'rgba(255,220,120,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, r * 4.5, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff6c8';
  } else {
    const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, r * 3.6);
    g.addColorStop(0, 'rgba(200,215,255,.35)');
    g.addColorStop(1, 'rgba(160,180,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, r * 3.6, 0, 7); ctx.fill();
    ctx.fillStyle = '#e8ecff';
  }
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill();
  if (!isSun) {
    ctx.fillStyle = 'rgba(150,160,200,.55)';
    ctx.beginPath(); ctx.arc(cx - 5, cy - 4, 3, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + 4, cy + 3, 2.2, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + 6, cy - 5, 1.6, 0, 7); ctx.fill();
  }
  ctx.restore();
}

/* ---------------- 视差远景 ---------------- */
function drawParallax(G, camX, camY) {
  const t = G.time;
  const horizon = W.surfaceY(Math.floor((camX + vw / 2) / TS)) * TS - camY;
  if (horizon < -60 || horizon > vh + 200) return;
  /* 远山两层 */
  for (let layer = 0; layer < 2; layer++) {
    const par = layer === 0 ? .12 : .26;
    const off = -camX * par;
    const base = horizon + (layer === 0 ? 6 : 0);
    const amp = layer === 0 ? 58 : 34;
    ctx.fillStyle = layer === 0 ? 'rgba(38,58,92,.55)' : 'rgba(30,46,76,.75)';
    ctx.beginPath();
    ctx.moveTo(-10, vh);
    for (let sx = -10; sx <= vw + 10; sx += 6) {
      const wx = (sx - off) * .012 + layer * 40;
      const hgt = T.fbm(wx, layer * 3.3, 4242, 3) * amp;
      ctx.lineTo(sx, base - hgt);
    }
    ctx.lineTo(vw + 10, vh); ctx.closePath(); ctx.fill();
  }
}
function drawClouds(G, camX, camY, horizon) {
  const coff = camX * .3 + G.time * 700;
  const day = dayFactor(G.time);
  ctx.fillStyle = 'rgba(255,255,255,' + (0.30 + 0.32 * day) + ')';
  for (let i = 0; i < 16; i++) {
    const cx = ((T.hash2(i, 21, 99) * 2400 - coff) % (vw + 300) + vw + 300) % (vw + 300) - 150;
    const cy = 24 + T.hash2(i, 22, 99) * Math.max(30, Math.min(horizon * .6, vh * .5));
    const s = .6 + T.hash2(i, 23, 99) * 1.1;
    drawCloud(cx, cy, s);
  }
}
function drawCloud(x, y, s) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.beginPath();
  ctx.arc(0, 0, 14, 0, 7); ctx.arc(16, 3, 11, 0, 7); ctx.arc(-16, 4, 10, 0, 7); ctx.arc(6, -6, 10, 0, 7);
  ctx.rect(-24, 0, 48, 12);
  ctx.fill();
  ctx.restore();
}

/* ---------------- 地下背景 ---------------- */
function drawUnderground(camX, camY, tx0, tx1, ty0, ty1) {
  for (let x = tx0; x <= tx1; x++) {
    const top = W.topAt(x);
    const sy = top * TS - camY;
    if (sy >= vh) continue;
    const h = Math.max(0, sy);
    const g = ctx.createLinearGradient(0, h, 0, Math.min(vh, h + 34 * TS));
    g.addColorStop(0, undergroundCol(top, 0));
    g.addColorStop(0.45, undergroundCol(top + 14, 0));
    g.addColorStop(1, undergroundCol(top + 34, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x * TS - camX, h, TS, vh - h);
  }
}
/* top = 该列地表所在的格子（深度 0） */
function undergroundCol(top, far) {
  const r0 = 132, g0 = 100, b0 = 74;
  const k = Math.min(1, Math.max(0, (top - 0)) / 60);
  let r = T.lerp(r0, 14, Math.pow(k, .8));
  let g = T.lerp(g0, 12, Math.pow(k, .8));
  let b = T.lerp(b0, 22, Math.pow(k, .8));
  if (top > W.UNDERWORLD) {
    const k2 = Math.min(1, (top - W.UNDERWORLD) / 18);
    r = T.lerp(r, 66, k2); g = T.lerp(g, 20, k2); b = T.lerp(b, 16, k2);
  }
  if (far) { r *= .55; g *= .55; b *= .55; }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

/* ---------------- 背景墙 ---------------- */
function drawWalls(camX, camY, tx0, tx1, ty0, ty1) {
  for (let ty = Math.max(0, ty0); ty <= Math.min(W.H - 1, ty1); ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      const wv = W.wall(tx, ty);
      if (!wv) continue;
      const tex = T.Tex.tile[T.tile(wv).tex];
      if (!tex) continue;
      const v = varOf(tx, ty);
      ctx.drawImage(tex[v % tex.length], Math.round(tx * TS - camX), Math.round(ty * TS - camY), TS, TS);
    }
  }
}

/* ---------------- 方块 ---------------- */
function varOf(x, y) { return ((x * 73856093) ^ (y * 19349663)) >>> 0; }

function drawTiles(camX, camY, tx0, tx1, ty0, ty1, G) {
  for (let ty = Math.max(0, ty0); ty <= Math.min(W.H - 1, ty1); ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      const id = W.tile(tx, ty);
      if (!id || id < 0) continue;
      const def = T.tile(id);
      if (!def.tex) continue;
      const dx = Math.round(tx * TS - camX), dy = Math.round(ty * TS - camY);
      if (def.furn) {
        const o = W.furnOrigin(tx, ty, id);
        if (o.x !== tx || o.y !== ty) continue;
        const tex = T.Tex.tile[def.tex];
        if (tex) ctx.drawImage(tex[0], Math.round(o.x * TS - camX), Math.round(o.y * TS - camY), o.w * TS, o.h * TS);
        continue;
      }
      const tex = T.Tex.tile[def.tex];
      if (!tex) continue;
      ctx.drawImage(tex[varOf(tx, ty) % tex.length], dx, dy, TS, TS);
      /* 边缘明暗 */
      if (def.solid) {
        const above = W.tile(tx, ty - 1), below = W.tile(tx, ty + 1);
        const aboveD = above > 0 ? T.tile(above) : null;
        const solidAbove = aboveD && aboveD.solid;
        if (!solidAbove) {
          ctx.fillStyle = 'rgba(255,255,255,.10)';
          ctx.fillRect(dx, dy, TS, 1);
          ctx.fillStyle = 'rgba(0,0,0,.14)';
          ctx.fillRect(dx, dy + 1, TS, 1);
        }
        if (!below || !T.tile(below).solid) {
          ctx.fillStyle = 'rgba(0,0,0,.20)';
          ctx.fillRect(dx, dy + TS - 2, TS, 2);
        }
      }
      if (id === TID.TORCH) drawTorchFx(dx, dy, G);
    }
  }
}
function drawTorchFx(dx, dy, G) {
  const f = 0.75 + Math.sin(G.time * 22 + dx * .1) * .18 + Math.random() * .1;
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(dx + 8, dy + 5, 0, dx + 8, dy + 5, 26 * f);
  g.addColorStop(0, 'rgba(255,190,90,.55)');
  g.addColorStop(1, 'rgba(255,120,20,0)');
  ctx.fillStyle = g;
  ctx.fillRect(dx - 20, dy - 20, 56, 56);
  ctx.globalCompositeOperation = 'source-over';
}

/* ---------------- 液体 ---------------- */
function drawLiquids(camX, camY, tx0, tx1, ty0, ty1, G) {
  for (let ty = Math.max(0, ty0); ty <= Math.min(W.H - 1, ty1); ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      const v = W.liq(tx, ty);
      if (!v) continue;
      const type = v >> 4, lvl = v & 15;
      if ((type !== 1 && type !== 2) || lvl > 8) continue;
      const dx = tx * TS - camX, dy = ty * TS - camY;
      const hp = Math.max(2, lvl * 2);
      const top = dy + TS - hp;
      const above = W.liq(tx, ty - 1);
      const openTop = ((above >> 4) !== type) || (above & 15) < lvl;
      if (type === 1) {
        ctx.fillStyle = `rgba(48,104,200,${.40 + lvl * .032})`;
        ctx.fillRect(dx, top, TS, hp);
        if (openTop) {
          ctx.fillStyle = 'rgba(150,205,255,.55)';
          const wob = Math.sin(G.time * 3 + tx * .8) * 1.2;
          ctx.fillRect(dx, top + wob, TS, 2);
        }
      } else {
        ctx.fillStyle = `rgba(248,${(88 + lvl * 7) | 0},24,${.72 + lvl * .025})`;
        ctx.fillRect(dx, top, TS, hp);
        if (openTop) {
          ctx.fillStyle = 'rgba(255,235,130,.6)';
          ctx.fillRect(dx, top + Math.sin(G.time * 2.4 + tx) * .8, TS, 2);
        }
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = 'rgba(255,110,20,.16)';
        ctx.fillRect(dx - 2, top - 2, TS + 4, hp + 4);
        ctx.globalCompositeOperation = 'source-over';
      }
    }
  }
}

/* ---------------- 掉落物 ---------------- */
function drawDrops(camX, camY) {
  for (const d of E.drops) {
    const bob = Math.sin(d.t * 4) * 1.6;
    const x = Math.round(d.x - camX - 5), y = Math.round(d.y - camY - 5 + bob);
    if (x < -20 || y < -20 || x > vw + 20 || y > vh + 20) continue;
    ctx.globalAlpha = .25; ctx.fillStyle = '#000';
    ctx.fillRect(x + 1, Math.round(d.y - camY + 5), 10, 3);
    ctx.globalAlpha = 1;
    const ic = T.Tex.item[d.id];
    if (ic) ctx.drawImage(ic, x, y, 10, 10);
    else { ctx.fillStyle = '#f0f'; ctx.fillRect(x, y, 10, 10); }
  }
}

/* ---------------- 玩家 ---------------- */
function drawPlayer(p, G) {
  const camX = Math.round(R.cam.x), camY = Math.round(R.cam.y);
  const x = Math.round(p.x - camX), y = Math.round(p.y - camY);
  const walk = p.onGround ? Math.min(1, Math.abs(p.vx) / 3) : 0;
  p.animT += p.onGround ? Math.abs(p.vx) * .08 : .012;
  const ph = p.animT;
  const legA = Math.sin(ph) * 3.2 * walk, legB = -legA;
  const armA = Math.sin(ph) * 2.4 * walk;

  ctx.save();
  if (p.iframes > 0 && Math.floor(p.iframes * 18) % 2 === 0) ctx.globalAlpha = .45;

  const f = p.face;
  const bx = x + (f < 0 ? p.w : 0);
  /* 腿 + 鞋 */
  ctx.fillStyle = '#2f4a7a';
  ctx.fillRect(bx + 1, y + 23, 5, 7);
  ctx.fillRect(bx + 7, y + 23, 5, 7);
  ctx.fillStyle = '#3f5f9a';
  ctx.fillRect(bx + 1, y + 23, 5, 2);
  ctx.fillRect(bx + 7, y + 23, 5, 2);
  ctx.fillStyle = '#4a3020';
  ctx.fillRect(bx + 1, y + 29 + legA * .4, 6, 3);
  ctx.fillRect(bx + 6, y + 29 + legB * .4, 6, 3);
  /* 身体 */
  ctx.fillStyle = '#3a7ec8'; ctx.fillRect(bx, y + 12, 13, 12);
  ctx.fillStyle = '#4f95dd'; ctx.fillRect(bx, y + 12, 13, 2);
  ctx.fillStyle = '#2a5f9f'; ctx.fillRect(bx, y + 22, 13, 2);
  ctx.fillStyle = '#2f6ba8'; ctx.fillRect(bx + (f > 0 ? 0 : 9), y + 15, 4, 8);
  /* 后手 */
  ctx.fillStyle = '#e0b088';
  ctx.fillRect(bx + (f > 0 ? 0 : 10), y + 15 + armA * .2, 3, 7);
  /* 头 */
  ctx.fillStyle = '#f0c49b'; ctx.fillRect(bx, y + 1, 13, 12);
  ctx.fillStyle = '#dca87e'; ctx.fillRect(bx, y + 9, 13, 3);
  /* 头发 */
  ctx.fillStyle = '#6a3a1c';
  ctx.fillRect(bx, y, 13, 5);
  ctx.fillRect(bx + (f > 0 ? 0 : 9), y, 4, 9);
  ctx.fillStyle = '#8a4d26';
  ctx.fillRect(bx, y, 13, 1);
  /* 眼睛 */
  const ex = f > 0 ? 7 : 3;
  ctx.fillStyle = '#fff'; ctx.fillRect(bx + ex, y + 6, 3, 3);
  ctx.fillStyle = '#2a2a3a'; ctx.fillRect(bx + ex + (f > 0 ? 1 : 0), y + 6, 2, 3);
  ctx.fillStyle = '#000'; ctx.fillRect(bx + ex + (f > 0 ? 2 : 0), y + 7, 1, 1);
  /* 前手 + 武器 */
  const aim = G.aimAngle === undefined ? 0 : G.aimAngle;
  const swing = p.swingT > 0 ? Math.sin((1 - p.swingT / 0.3) * Math.PI) * 1.0 : 0;
  const ha = aim + swing * f;
  const hxp = bx + 6.5 + Math.cos(ha) * 6 * f, hyp = y + 17 + Math.sin(ha) * 6;
  ctx.fillStyle = '#f0c49b';
  ctx.fillRect(hxp - 1.5, hyp - 1.5, 4, 4);
  const held = p.inv.held();
  if (held) {
    const ic = T.Tex.item[held.id];
    if (ic) {
      ctx.save();
      ctx.translate(hxp + Math.cos(ha) * 5 * f, hyp + Math.sin(ha) * 5);
      ctx.rotate(ha);
      ctx.scale(f, 1);
      ctx.drawImage(ic, -7, -10, 14, 14);
      ctx.restore();
    }
  }
  ctx.restore();
}

/* ---------------- 敌人 ---------------- */
function drawMobs(camX, camY, G) {
  for (const m of E.mobs) {
    const x = Math.round(m.x - camX), y = Math.round(m.y - camY);
    if (x < -60 || y < -60 || x > vw + 60 || y > vh + 60) continue;
    ctx.save();
    if (m.hitT > 0) ctx.globalAlpha = .55 + .45 * Math.abs(Math.sin(m.hitT * 60));
    const f = m.face;
    if (m.type === 'zombie') drawZombie(m, x, y, f);
    else if (m.type === 'eye') drawEye(m, x, y);
    else drawSlime(m, x, y, f);
    ctx.restore();
    /* 血条 */
    if (m.hp < m.maxHp && m.type !== 'eye') {
      const bw = m.w + 4;
      ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(x - 2, y - 5, bw, 3);
      ctx.fillStyle = '#d84a3a'; ctx.fillRect(x - 2, y - 5, bw * (m.hp / m.maxHp), 3);
    }
  }
}
function drawZombie(m, x, y, f) {
  const ph = m.t * 7;
  const walk = Math.min(1, Math.abs(m.vx) / 1.2);
  const la = Math.sin(ph) * 2.6 * walk, lb = -la;
  const bx = f > 0 ? x : x + m.w - 12;
  /* 腿 */
  ctx.fillStyle = '#3a4a6a'; ctx.fillRect(bx + 1, y + 20, 4, 9 + la * .2); ctx.fillRect(bx + 7, y + 20, 4, 9 + lb * .2);
  /* 身体 */
  ctx.fillStyle = '#4a6a9a'; ctx.fillRect(bx, y + 10, 12, 11);
  ctx.fillStyle = '#5a7ab0'; ctx.fillRect(bx, y + 10, 12, 2);
  /* 伸向前方的手臂 */
  ctx.fillStyle = '#6f9a4a';
  ctx.fillRect(bx + (f > 0 ? 9 : -6), y + 11, 9, 3);
  ctx.fillRect(bx + (f > 0 ? 9 : -6), y + 15, 8, 3);
  /* 头 */
  ctx.fillStyle = '#6f9a4a'; ctx.fillRect(bx + 1, y, 11, 10);
  ctx.fillStyle = '#87b35c'; ctx.fillRect(bx + 1, y, 11, 2);
  /* 眼 */
  ctx.fillStyle = '#101018';
  ctx.fillRect(bx + (f > 0 ? 3 : 6), y + 4, 3, 3);
  /* 嘴 */
  ctx.fillRect(bx + (f > 0 ? 3 : 6), y + 8, 4, 1);
}
function drawEye(m, x, y) {
  const flap = Math.sin(m.t * 18) * .5 + .5;
  const cx = x + m.w / 2, cy = y + m.h / 2;
  /* 翅膀 */
  ctx.fillStyle = 'rgba(90,40,40,.85)';
  ctx.beginPath();
  ctx.moveTo(cx - 4, cy);
  ctx.lineTo(cx - 14, cy - 8 - flap * 6);
  ctx.lineTo(cx - 12, cy + 4);
  ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx + 4, cy);
  ctx.lineTo(cx + 14, cy - 8 - flap * 6);
  ctx.lineTo(cx + 12, cy + 4);
  ctx.closePath(); ctx.fill();
  /* 眼球 */
  ctx.fillStyle = '#e8e0d0';
  ctx.beginPath(); ctx.arc(cx, cy, 9, 0, 7); ctx.fill();
  ctx.fillStyle = '#c9bfae';
  ctx.beginPath(); ctx.arc(cx, cy + 2, 9, .4, 2.7); ctx.fill();
  /* 血管 */
  ctx.strokeStyle = 'rgba(190,70,60,.7)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(cx - 6, cy - 3); ctx.lineTo(cx - 1, cy + 1); ctx.moveTo(cx + 5, cy - 5); ctx.lineTo(cx + 2, cy); ctx.stroke();
  /* 瞳孔 */
  ctx.fillStyle = '#3a1010';
  ctx.beginPath(); ctx.arc(cx + m.face * 2, cy, 4.2, 0, 7); ctx.fill();
  ctx.fillStyle = '#c33';
  ctx.beginPath(); ctx.arc(cx + m.face * 2, cy, 2.4, 0, 7); ctx.fill();
}
function drawSlime(m, x, y, f) {
  const sq = m.squash || 0;
  m.squash = Math.max(0, sq - 0.05);
  const w = m.w * (1 + sq * .18), h = m.h * (1 - sq * .22);
  const cx = x + m.w / 2, cy = y + m.h - h / 2;
  ctx.globalAlpha = .88;
  ctx.fillStyle = m.type === 'small' ? '#6fc8f0' : '#4aa8e0';
  ctx.beginPath();
  ctx.ellipse(cx, cy, w / 2, h / 2, 0, Math.PI, 0);
  ctx.lineTo(cx + w / 2, y + m.h - 1);
  ctx.lineTo(cx - w / 2, y + m.h - 1);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.5)';
  ctx.beginPath(); ctx.ellipse(cx - w * .18, cy - h * .12, w * .16, h * .18, -.4, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(10,40,80,.45)';
  ctx.beginPath(); ctx.ellipse(cx, cy + h * .1, w * .22, h * .14, 0, 0, 7); ctx.fill();
  ctx.globalAlpha = 1;
  /* 眼 */
  ctx.fillStyle = '#20303a';
  ctx.fillRect(cx - 4, cy - 1, 2, 3);
  ctx.fillRect(cx + 2, cy - 1, 2, 3);
}

/* ---------------- 粒子 ---------------- */
function drawParticles(camX, camY) {
  for (const p of E.parts) {
    const a = p.fade ? (1 - p.t / p.life) : 1;
    ctx.globalAlpha = Math.max(0, Math.min(1, a));
    ctx.fillStyle = p.col;
    ctx.fillRect(Math.round(p.x - camX), Math.round(p.y - camY), p.size, p.size);
  }
  ctx.globalAlpha = 1;
}

/* ---------------- 挖掘裂纹 ---------------- */
function drawMining(tx0, ty0) {
  const G = T.G;
  if (!G.mining) return;
  const m = G.mining;
  const stage = Math.min(9, Math.floor(m.prog * 10));
  if (stage <= 0) return;
  const tex = T.Tex.crack[stage];
  ctx.drawImage(tex, Math.round(m.x * TS - R.cam.x), Math.round(m.y * TS - R.cam.y), TS, TS);
}

/* ---------------- 光照 ---------------- */
let lw = 0, lh = 0;
let skyBuf = null, blkBuf = null;
function ensureBuf(w, h) {
  if (!skyBuf || lw < w || lh < h) {
    lw = Math.max(w, 80); lh = Math.max(h, 80);
    skyBuf = new Float32Array(lw * lh);
    blkBuf = new Float32Array(lw * lh);
    lightCv.width = lw; lightCv.height = lh;
    lightImg = lightCtx.createImageData(lw, lh);
  }
}
/* 注意：所有数组访问都必须用缓冲区行跨度 lw，而不是可见宽度 w */
function drawLight(camX, camY, tx0, tx1, ty0, ty1, G) {
  const m = 3;
  const x0 = tx0 - m, x1 = tx1 + m, y0 = ty0 - m, y1 = ty1 + m;
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  ensureBuf(w, h);
  const S = lw;
  for (let j = 0; j < h; j++) {
    const ty = y0 + j, row = j * S;
    for (let i = 0; i < w; i++) {
      const tx = x0 + i, k = row + i;
      skyBuf[k] = (ty <= W.topAt(tx)) ? 1 : 0;
      blkBuf[k] = W.lightAt(tx, ty) / 15;
    }
  }
  /* 天光扩散：横向 + 纵向扫描，每格衰减 D，重复 P 轮 */
  const D = 0.062, P = 14;
  for (let pass = 0; pass < P; pass++) {
    for (let j = 0; j < h; j++) {
      const row = j * S;
      for (let i = 1; i < w; i++) { const v = skyBuf[row + i - 1] - D; if (v > skyBuf[row + i]) skyBuf[row + i] = v; }
      for (let i = w - 2; i >= 0; i--) { const v = skyBuf[row + i + 1] - D; if (v > skyBuf[row + i]) skyBuf[row + i] = v; }
    }
    for (let j = 1; j < h; j++) {
      const row = j * S, up = row - S;
      for (let i = 0; i < w; i++) { const v = skyBuf[up + i] - D; if (v > skyBuf[row + i]) skyBuf[row + i] = v; }
    }
    for (let j = h - 2; j >= 0; j--) {
      const row = j * S, dn = row + S;
      for (let i = 0; i < w; i++) { const v = skyBuf[dn + i] - D; if (v > skyBuf[row + i]) skyBuf[row + i] = v; }
    }
  }
  /* 火光柔化 */
  for (let pass = 0; pass < 2; pass++) {
    const d = .1;
    for (let j = 0; j < h; j++) {
      const row = j * S;
      for (let i = 1; i < w; i++) { const v = blkBuf[row + i - 1] - d; if (v > blkBuf[row + i]) blkBuf[row + i] = v; }
      for (let i = w - 2; i >= 0; i--) { const v = blkBuf[row + i + 1] - d; if (v > blkBuf[row + i]) blkBuf[row + i] = v; }
    }
  }
  const sl = R.skyLight(G.time);
  let sr = sl[0], sg = sl[1], sb = sl[2];
  if (G.bloodMoon) { sr = T.lerp(sr, 190, .5); sg = T.lerp(sg, 40, .5); sb = T.lerp(sb, 40, .5); }
  const d8 = lightImg.data;
  const amb = 14;
  for (let j = 0; j < h; j++) {
    const row = j * S;
    for (let i = 0; i < w; i++) {
      const k = row + i, q = k * 4;
      const sv = skyBuf[k], b = blkBuf[k];
      let r = sv * sr, g = sv * sg, bl = sv * sb;
      const wr = b * 255, wg = b * 170, wb = b * 100;
      if (wr > r) r = wr;
      if (wg > g) g = wg;
      if (wb > bl) bl = wb;
      d8[q] = Math.min(255, r + amb);
      d8[q + 1] = Math.min(255, g + amb);
      d8[q + 2] = Math.min(255, bl + amb);
      d8[q + 3] = 255;
    }
  }
  lightCtx.putImageData(lightImg, 0, 0);
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.globalCompositeOperation = 'multiply';
  ctx.drawImage(lightCv, 0, 0, w, h, x0 * TS - camX, y0 * TS - camY, w * TS, h * TS);
  ctx.restore();
}

/* ---------------- 暗角 ---------------- */
function drawVignette(G) {
  const g = ctx.createRadialGradient(vw / 2, vh / 2, Math.min(vw, vh) * .38, vw / 2, vh / 2, Math.max(vw, vh) * .78);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,.42)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, vw, vh);
}

/* ---------------- HUD ---------------- */
const HEART = [
  '.XX.XX.',
  'XXXXXXX',
  'XXXXXXX',
  'XXXXXXX',
  '.XXXXX.',
  '..XXX..',
  '...X...'
];
function heart(x, y, kind) {          // kind: 0 空 1 半 2 满
  for (let j = 0; j < HEART.length; j++) for (let i = 0; i < 7; i++) {
    if (HEART[j][i] !== 'X') continue;
    const half = kind === 1 && i > 2;
    ctx.fillStyle = half ? '#3a2028' : '#e03a3a';
    ctx.fillRect(x + i, y + j, 1, 1);
    if (kind && !half) {
      ctx.fillStyle = 'rgba(255,255,255,.4)';
      ctx.fillRect(x + i, y + j, 1, 1);
      ctx.fillStyle = '#b02424';
      ctx.fillRect(x + i, y + j + (j > 3 ? 0 : 0), 1, 1);
    }
  }
  ctx.strokeStyle = kind ? '#5a0f0f' : '#1a1016';
  ctx.lineWidth = 1;
  ctx.strokeRect(x - .5, y - .5, 8, 8);
}
function bubble(x, y) {
  ctx.strokeStyle = 'rgba(200,230,255,.9)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(x + 3, y + 3, 3, 0, 7); ctx.stroke();
  ctx.fillStyle = 'rgba(200,230,255,.35)';
  ctx.beginPath(); ctx.arc(x + 3, y + 3, 2, 0, 7); ctx.fill();
}

function drawHUD() {
  const p = E.P, G = T.G;
  if (!p) return;
  ctx.save();
  /* 生命（10 个半心） */
  for (let i = 0; i < 10; i++) {
    const v = T.clamp(p.hp / 10 - i, 0, 1);
    heart(16 + i * 15, 14, v >= 1 ? 2 : (v > 0 ? 1 : 0));
  }
  /* 氧气 */
  if (p.breath < p.maxBreath) {
    for (let i = 0; i < 10; i++) if (p.breath * 2 > i) bubble(16 + i * 15, 28);
  }
  /* 深度/时间 */
  ctx.font = '12px "PingFang SC","Microsoft YaHei",sans-serif';
  ctx.textBaseline = 'top';
  ctx.fillStyle = 'rgba(0,0,0,.55)';
  ctx.fillText(T.fmtTime(G.time), vw - 78, 15);
  ctx.fillText('第 ' + G.day + ' 天', vw - 78, 30);
  ctx.fillStyle = '#f0e6c8';
  ctx.fillText(T.fmtTime(G.time), vw - 79, 14);
  ctx.fillText('第 ' + G.day + ' 天', vw - 79, 29);
  const depth = Math.floor(p.y / TS) - W.surfaceY(Math.floor(p.x / TS));
  ctx.fillStyle = 'rgba(240,230,200,.75)';
  ctx.fillText(depth > 4 ? '地下 ' + depth + ' 格' : W.biomeAt(Math.floor(p.x / TS)) === 1 ? '沙漠' : '地表', vw - 78, 45);

  if (G.debugText) {
    ctx.font = '10px monospace'; ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(0,0,0,.65)'; ctx.fillRect(8, 42, vw - 16, 13);
    ctx.fillStyle = '#9fe'; ctx.fillText(G.debugText, 11, 52);
    if (G.debugText2) {
      ctx.fillStyle = 'rgba(0,0,0,.65)'; ctx.fillRect(8, 58, 300, 7 * (G.debugText2.split('\n').length) + 4);
      ctx.fillText(G.debugText2, 11, 66);
    }
  }
  /* 快捷栏 */
  const n = 10, sz = 34, gap = 3;
  const totW = n * sz + (n - 1) * gap;
  const bx = Math.round((vw - totW) / 2), by = vh - sz - 8;
  for (let i = 0; i < n; i++) {
    const x = bx + i * (sz + gap);
    ctx.fillStyle = 'rgba(12,11,18,.86)';
    ctx.fillRect(x, by, sz, sz);
    ctx.strokeStyle = i === p.inv.sel ? '#f0d9a0' : 'rgba(150,145,170,.5)';
    ctx.lineWidth = i === p.inv.sel ? 2 : 1;
    ctx.strokeRect(x + .5, by + .5, sz - 1, sz - 1);
    const s = p.inv.slots[i];
    if (s) {
      const ic = T.Tex.item[s.id];
      if (ic) ctx.drawImage(ic, x + 5, by + 3, sz - 10, sz - 10);
      if (s.n > 1) {
        ctx.font = 'bold 11px "PingFang SC",sans-serif';
        ctx.textAlign = 'right';
        ctx.fillStyle = '#000'; ctx.fillText(s.n, x + sz - 3, by + sz - 12);
        ctx.fillStyle = '#fff'; ctx.fillText(s.n, x + sz - 4, by + sz - 13);
        ctx.textAlign = 'left';
      }
    }
  }

  /* 小地图 */
  if (G.showMap) drawMinimap(p);

  /* 光标 */
  const m = T.input;
  ctx.save();
  ctx.translate(Math.round(m.mx / S), Math.round(m.my / S));
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#1a1a22';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(0, 11); ctx.lineTo(3, 8.5); ctx.lineTo(5, 13); ctx.lineTo(7, 12);
  ctx.lineTo(5, 7.5); ctx.lineTo(8.5, 7);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.restore();
  ctx.restore();
}

function drawMinimap(p) {
  const mw = 132, mh = 92;
  const mx = vw - mw - 10, my = vh - mh - 10;
  const cpx = Math.floor(p.x / TS), cpy = Math.floor(p.y / TS);
  const x0 = cpx - (mw >> 1), y0 = cpy - (mh >> 1);
  const img = R._mm || (R._mm = document.createElement('canvas'));
  if (img.width !== mw || img.height !== mh) { img.width = mw; img.height = mh; }
  const g = img.getContext('2d');
  const id = g.createImageData(mw, mh);
  const d = id.data;
  for (let j = 0; j < mh; j++) for (let i = 0; i < mw; i++) {
    const tx = x0 + i, ty = y0 + j, k = (j * mw + i) * 4;
    const t = W.tile(tx, ty);
    let r = 0, gg = 0, b = 0, a = 255;
    if (t > 0) {
      const col = T.hex2rgb(T.tile(t).color || '#000000');
      const open = ty < W.topAt(tx);
      const l = open ? 1 : .38 + W.lightAt(tx, ty) / 15 * .62;
      r = col[0] * l; gg = col[1] * l; b = col[2] * l;
    } else {
      const v = W.liq(tx, ty);
      if (v) { r = 30; gg = 70; b = 160; }
      else { r = 12; gg = 13; b = 20; a = 120; }
    }
    d[k] = r; d[k + 1] = gg; d[k + 2] = b; d[k + 3] = a;
  }
  g.putImageData(id, 0, 0);
  /* 敌人点 */
  g.fillStyle = '#e04030';
  for (const m of E.mobs) {
    const i = Math.floor(m.x / TS) - x0, j = Math.floor(m.y / TS) - y0;
    if (i < 0 || j < 0 || i >= mw || j >= mh) continue;
    g.fillRect(i, j, 2, 2);
  }
  ctx.save();
  ctx.fillStyle = 'rgba(10,10,16,.8)';
  ctx.fillRect(mx - 2, my - 2, mw + 4, mh + 4);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, mx, my);
  ctx.strokeStyle = 'rgba(160,150,190,.8)'; ctx.lineWidth = 1;
  ctx.strokeRect(mx - .5, my - .5, mw + 1, mh + 1);
  /* 玩家 */
  ctx.fillStyle = '#7fe07f';
  ctx.fillRect(mx + (mw >> 1) - 1, my + (mh >> 1) - 1, 3, 3);
  ctx.restore();
}

R.heart = heart;

})(window.T);
