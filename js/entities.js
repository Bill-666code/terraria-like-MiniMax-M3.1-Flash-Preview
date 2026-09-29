/* ==========================================================================
   entities.js —— 玩家 / 敌人 / 掉落物 / 粒子 / 背包
   ========================================================================== */
(function (T) {
'use strict';
const W = T.W, TID = T.TID, IID = T.IID, TS = 16;
const E = {};
T.E = E;

E.mobs = [];
E.drops = [];
E.parts = [];
E.P = null;

/* ------------------------------------------------------------------
   背包
------------------------------------------------------------------ */
function Inv() { this.slots = new Array(40).fill(null); this.sel = 0; }
Inv.prototype.add = function (id, n) {
  const def = T.item(id);
  let left = n;
  for (let i = 0; i < 40 && left > 0; i++) {
    const s = this.slots[i];
    if (s && s.id === id && s.n < def.stack) { const take = Math.min(def.stack - s.n, left); s.n += take; left -= take; }
  }
  for (let i = 0; i < 40 && left > 0; i++) {
    if (!this.slots[i]) { const take = Math.min(def.stack, left); this.slots[i] = { id: id, n: take }; left -= take; }
  }
  return n - left;
};
Inv.prototype.count = function (id) {
  let c = 0; for (const s of this.slots) if (s && s.id === id) c += s.n; return c;
};
Inv.prototype.remove = function (id, n) {
  let left = n;
  for (let i = 39; i >= 0 && left > 0; i--) {
    const s = this.slots[i];
    if (!s || s.id !== id) continue;
    const take = Math.min(s.n, left); s.n -= take; left -= take;
    if (s.n <= 0) this.slots[i] = null;
  }
  return n - left;
};
Inv.prototype.removeAt = function (i, n) {
  const s = this.slots[i]; if (!s) return 0;
  const take = Math.min(s.n, n === undefined ? s.n : n);
  s.n -= take; if (s.n <= 0) this.slots[i] = null;
  return take;
};
Inv.prototype.firstEmpty = function () {
  for (let i = 0; i < 40; i++) if (!this.slots[i]) return i;
  return -1;
};
Inv.prototype.held = function () { return this.slots[this.sel] || null; };
Inv.prototype.firstOf = function (id) {
  for (let i = 0; i < 40; i++) { const s = this.slots[i]; if (s && s.id === id) return i; }
  return -1;
};
E.Inv = Inv;

/* ------------------------------------------------------------------
   粒子
------------------------------------------------------------------ */
E.part = function (x, y, opt) {
  if (E.parts.length > 900) E.parts.shift();
  E.parts.push({
    x: x, y: y,
    vx: opt.vx || 0, vy: opt.vy || 0,
    life: opt.life || .6, t: 0,
    col: opt.col || '#ffffff',
    size: opt.size || 2,
    g: opt.g === undefined ? .12 : opt.g,
    type: opt.type || 'dust',
    fade: opt.fade !== false
  });
};
E.burst = function (x, y, n, opt) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, sp = (opt.sp || 1.6) * (0.4 + Math.random());
    E.part(x, y, {
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (opt.up || 0),
      life: (opt.life || .6) * (0.6 + Math.random() * .7),
      col: Array.isArray(opt.col) ? opt.col[(Math.random() * opt.col.length) | 0] : opt.col,
      size: opt.size || 2, g: opt.g, type: opt.type
    });
  }
};
E.updateParts = function (dt) {
  const P = E.parts;
  for (let i = P.length - 1; i >= 0; i--) {
    const p = P[i];
    p.t += dt;
    if (p.t >= p.life) { P.splice(i, 1); continue; }
    p.vy += p.g;
    p.x += p.vx; p.y += p.vy;
    if (p.type === 'bubble') { p.x += Math.sin(p.t * 9) * .3; }
    if (p.type === 'leaf') { p.x += Math.sin(p.t * 4) * .5; p.vy *= .99; }
  }
};

/* ------------------------------------------------------------------
   通用物理
------------------------------------------------------------------ */
function solidAt(tx, ty) {
  const t = W.tile(tx, ty);
  return t > 0 && T.tile(t).solid;
}
function platformAt(tx, ty) {
  return W.tile(tx, ty) === TID.PLATFORM;
}

function moveX(e, dx) {
  if (dx === 0) return;
  e.x += dx;
  const x0 = Math.floor(e.x / TS), x1 = Math.floor((e.x + e.w - .01) / TS);
  const y0 = Math.floor(e.y / TS), y1 = Math.floor((e.y + e.h - .01) / TS);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (solidAt(tx, ty)) {
        if (dx > 0) e.x = tx * TS - e.w; else e.x = (tx + 1) * TS;
        e.vx = 0; return;
      }
    }
  }
}
function moveY(e, dy) {
  if (dy === 0) return;
  e.y += dy;
  const x0 = Math.floor(e.x / TS), x1 = Math.floor((e.x + e.w - .01) / TS);
  const y0 = Math.floor(e.y / TS), y1 = Math.floor((e.y + e.h - .01) / TS);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (solidAt(tx, ty)) {
        if (dy > 0) { e.y = ty * TS - e.h; e.onGround = true; }
        else e.y = (ty + 1) * TS;
        e.vy = 0; return;
      }
    }
  }
  if (dy > 0 && e.noPlatT > 0) return;
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (platformAt(tx, ty)) {
        const top = ty * TS;
        if (e.y + e.h >= top && e.y + e.h <= top + 9 && e.vy >= 0) {
          e.y = top - e.h; e.vy = 0; e.onGround = true; return;
        }
      }
    }
  }
}
E.solidAt = solidAt;
E.moveEnt = function (e, dt) {
  e.noPlatT = Math.max(0, (e.noPlatT || 0) - dt);
  if (e.noClip) {
    e.x += e.vx * dt * 60; e.y += e.vy * dt * 60;
    e.y = Math.max(0, Math.min(e.y, W.H * TS - e.h));
    e.onGround = false;
    return;
  }
  const wasGround = e.onGround;
  e.onGround = false;
  moveX(e, e.vx * dt * 60);
  moveY(e, e.vy * dt * 60);
  if (!wasGround && e.onGround && e.onLand) e.onLand();
  if (e.onGround) e.maxFall = 0; else e.maxFall = Math.max(e.maxFall, e.vy);
};

/* ------------------------------------------------------------------
   玩家
------------------------------------------------------------------ */
E.createPlayer = function (x, y) {
  const p = {
    x: x, y: y, vx: 0, vy: 0, w: 13, h: 32,
    face: 1, onGround: false, maxFall: 0,
    hp: 100, maxHp: 100, iframes: 0, sinceHit: 99, breath: 10, maxBreath: 10,
    dead: false, regenT: 0, stepT: 0, animT: 0,
    swingT: 0, swingCD: 0, using: 0,
    inv: new Inv(),
    spawn: { x: x, y: y },
    reach: 6.2 * TS,
    key: null
  };
  E.P = p;
  return p;
};

E.hurt = function (p, dmg, srcX, knock) {
  if (p.dead || p.iframes > 0) return;
  p.hp -= dmg;
  p.iframes = .9; p.sinceHit = 0;
  const dir = (p.x + p.w / 2) < srcX ? -1 : 1;
  p.vx = dir * (knock || 5); p.vy = -3.2;
  T.snd.play('hurt');
  E.burst(p.x + p.w / 2, p.y + p.h / 2, 8, { col: ['#c33', '#8a1f1f', '#e66'], sp: 2, life: .5, type: 'blood', up: 1 });
  if (p.hp <= 0) E.killPlayer(p);
};
E.killPlayer = function (p) {
  p.hp = 0; p.dead = true;
  T.snd.play('die');
  E.burst(p.x + p.w / 2, p.y + p.h / 2, 26, { col: ['#c33', '#8a1f1f'], sp: 3, life: 1.1, type: 'blood' });
  if (T.UI) T.UI.onDeath(p.sinceDead = 0);
};
E.heal = function (p, n) {
  const before = p.hp;
  p.hp = Math.min(p.maxHp, p.hp + n);
  if (p.hp > before) T.snd.play('heal');
};
E.respawn = function () {
  const p = E.P;
  p.x = p.spawn.x; p.y = p.spawn.y; p.vx = 0; p.vy = 0;
  p.hp = p.maxHp; p.dead = false; p.iframes = 2; p.breath = p.maxBreath;
};

/* 当前手持物品的“工具信息” */
E.heldInfo = function () {
  const p = E.P; if (!p) return { speed: 1, tier: 0, kind: 'pick', dmg: 5, knock: 1 };
  const s = p.inv.held();
  const d = s ? T.item(s.id) : null;
  if (d && d.type === 'tool') return { speed: d.speed, tier: d.tier, kind: d.kind, dmg: d.dmg, knock: 1.4, item: d };
  if (d && d.type === 'weapon') return { speed: d.speed, tier: 0, kind: 'sword', dmg: d.dmg, knock: d.knock, item: d, weapon: true };
  if (d && d.type === 'block') return { speed: 1.1, tier: 0, kind: 'pick', dmg: 4, knock: 1, block: true };
  return { speed: 1, tier: 0, kind: 'pick', dmg: 5, knock: 1 };
};

/* 采矿耗时（秒） */
E.mineDur = function (tx, ty, info) {
  const def = T.tile(W.tileOrGen(tx, ty));
  let sp = info.speed;
  if ((def.tool === 'axe' && info.kind !== 'axe') || (def.tool === 'pick' && info.kind !== 'pick')) sp = 1;
  return Math.max(.05, def.hardness / sp);
};

/* 破坏方块：掉落 */
E.breakTile = function (tx, ty, byPlayer) {
  const id = W.tileOrGen(tx, ty);
  if (!id) return;
  const def = T.tile(id);
  if (def.hardness >= 1e8) return;
  if (def.furn) {
    const o = W.furnOrigin(tx, ty, id);
    for (let a = 0; a < o.w; a++) for (let b = 0; b < o.h; b++) {
      const d2 = T.tile(W.tileOrGen(o.x + a, o.y + b));
      if (d2.drop) E.dropItem(o.x + a, o.y + b, d2.drop, 1);
    }
  } else if (def.drop) {
    const n = id === TID.WOOD ? 1 : (def.hardness > 2 ? 1 : 1);
    E.dropItem(tx, ty, def.drop, n);
  } else if (def.dropChance && T.rnd() < def.dropChance) {
    E.dropItem(tx, ty, def.dropItem, 1);
  }
  W.setTile(tx, ty, 0);
  W.flowInto(tx, ty);
  E.burst(tx * TS + 8, ty * TS + 8, 8, {
    col: [def.color, T.shade(T.hex2rgb(def.color), .7), T.shade(T.hex2rgb(def.color), 1.25)],
    sp: 1.6, life: .5, type: 'dust'
  });
  T.snd.play('break', .8);
  if (def.furn && id === TID.CHEST) { /* 箱子内容保留 */ }
};

E.dropItem = function (tx, ty, id, n) {
  if (!id || !T.item(id)) return;
  E.drops.push({
    id: id, n: n || 1,
    x: tx * TS + 8 + (Math.random() * 8 - 4), y: ty * TS + 8,
    vx: (Math.random() - .5) * 2, vy: -2 - Math.random(),
    w: 10, h: 10, t: 0, life: 240, onGround: false, pickDelay: .45
  });
};
E.spawnDrop = function (x, y, id, n) {
  if (!id || !T.item(id)) return;
  E.drops.push({
    id: id, n: n || 1, x: x, y: y,
    vx: (Math.random() - .5) * 2.4, vy: -2.5 - Math.random() * 1.5,
    w: 10, h: 10, t: 0, life: 240, onGround: false, pickDelay: .5
  });
};

/* ------------------------------------------------------------------
   掉落物更新
------------------------------------------------------------------ */
E.updateDrops = function (dt) {
  const p = E.P;
  for (let i = E.drops.length - 1; i >= 0; i--) {
    const d = E.drops[i];
    d.t += dt;
    if (d.t > d.life) { E.drops.splice(i, 1); continue; }
    d.vy += .28 * dt * 60;
    d.vx *= .985;
    /* 磁吸 */
    if (p && !p.dead && d.t > d.pickDelay) {
      const dx = (p.x + p.w / 2) - d.x, dy = (p.y + p.h / 2) - d.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 24) {
        const got = p.inv.add(d.id, d.n);
        if (got > 0) {
          T.snd.play('pickup', .5);
          if (T.UI) T.UI.toast(T.item(d.id).name + (d.n > 1 ? ' ×' + d.n : ''));
          E.burst(d.x, d.y, 4, { col: ['#fff8d0', '#ffe08a'], sp: 1, life: .3, size: 1, g: 0 });
          E.drops.splice(i, 1);
          continue;
        }
      }
      if (dist < 64) {
        const k = (1 - dist / 64) * .9 * dt * 60;
        d.vx += dx / dist * k; d.vy += dy / dist * k;
        if (dist < 9) { d.vx *= .5; d.vy *= .5; }
      }
    }
    d.vy = Math.min(d.vy, 9);
    moveX(d, d.vx * dt * 60);
    moveY(d, d.vy * dt * 60);
    if (d.onGround) { d.vx *= .8; }
    d.onGround = false;
    const t = W.tileOrGen(Math.floor(d.x / TS), Math.floor((d.y + d.h) / TS));
    if (T.tile(t).solid) d.onGround = true;
  }
};

/* ------------------------------------------------------------------
   敌人
------------------------------------------------------------------ */
const MOB_DEF = {
  zombie: { w: 14, h: 30, hp: 45, dmg: 11, speed: 1.05, kb: 0.45, color: '#6f9a4a', name: '僵尸' },
  eye:    { w: 20, h: 20, hp: 22, dmg: 9,  speed: 2.3,  kb: 0.3,  color: '#d84a3a', name: '恶魔眼' },
  slime:  { w: 18, h: 14, hp: 26, dmg: 8,  speed: 1.3,  kb: 0.4,  color: '#4aa8e0', name: '蓝史莱姆' },
  small:  { w: 11, h: 9,  hp: 10, dmg: 5,  speed: 1.9,  kb: 0.2,  color: '#6fc8f0', name: '小史莱姆' }
};
E.MOB_DEF = MOB_DEF;

E.spawnMob = function (type, x, y) {
  const d = MOB_DEF[type];
  const m = {
    type: type, x: x - d.w / 2, y: y - d.h, w: d.w, h: d.h,
    vx: 0, vy: 0, face: 1, onGround: false, maxFall: 0,
    hp: d.hp, maxHp: d.hp, dmg: d.dmg, speed: d.speed, kbRes: d.kb,
    hitT: 0, atkCd: 0, animT: Math.random() * 5, jumpCd: 0, t: 0,
    noPlatT: 0, onGround2: false
  };
  E.mobs.push(m);
  return m;
};

E.hurtMob = function (m, dmg, knock, fromX) {
  if (m.hitT > 0 && dmg < 90) return;
  m.hp -= dmg; m.hitT = .18;
  const dir = (m.x + m.w / 2) < fromX ? 1 : -1;
  m.vx += dir * knock * (1 - (m.kbRes || 0));
  m.vy -= knock * .35;
  T.snd.play('hitmob', .7);
  E.burst(m.x + m.w / 2, m.y + m.h / 2, 7, { col: ['#b32a2a', '#7a1414', '#d95a4a'], sp: 1.8, life: .45, type: 'blood' });
  if (m.hp <= 0) E.killMob(m);
};

E.killMob = function (m) {
  const i = E.mobs.indexOf(m);
  if (i >= 0) E.mobs.splice(i, 1);
  E.burst(m.x + m.w / 2, m.y + m.h / 2, 16, { col: ['#b32a2a', '#7a1414'], sp: 2.4, life: .8, type: 'blood' });
  T.snd.play('die', .4);
  const cx = m.x + m.w / 2, cy = m.y + m.h / 2;
  if (m.type === 'zombie') {
    E.spawnDrop(cx, cy, IID.ZOMBIE_ARM, 1);
    if (T.rnd() < .5) E.spawnDrop(cx, cy, IID.GEL, 1);
  } else if (m.type === 'eye') {
    E.spawnDrop(cx, cy, IID.GEL, 1 + (T.rnd() * 2 | 0));
  } else if (m.type === 'slime') {
    E.spawnDrop(cx, cy, IID.GEL, 1 + (T.rnd() * 3 | 0));
  } else if (m.type === 'small') {
    E.spawnDrop(cx, cy, IID.GEL, 1);
  }
};

function inLiquid(e) {
  const tx = Math.floor((e.x + e.w / 2) / TS), ty = Math.floor((e.y + e.h / 2) / TS);
  return W.liq(tx, ty);
}

E.updateMobs = function (dt, night, bloodMoon) {
  const p = E.P;
  for (let i = E.mobs.length - 1; i >= 0; i--) {
    const m = E.mobs[i];
    m.t += dt;
    m.hitT = Math.max(0, m.hitT - dt);
    m.atkCd = Math.max(0, m.atkCd - dt);
    m.jumpCd = Math.max(0, m.jumpCd - dt);
    const cx = m.x + m.w / 2, cy = m.y + m.h / 2;

    if (p && !p.dead) {
      const d2 = Math.hypot(p.x - cx, p.y - cy);
      if (d2 > 95 * TS) { E.mobs.splice(i, 1); continue; }
    }

    if (m.type === 'eye') {
      /* 恶魔眼：朝玩家飞，白天在阳光下消散 */
      m.noClip = true;
      if (p && !p.dead) {
        const a = Math.atan2(p.y + p.h / 2 - cy, p.x + p.w / 2 - cx);
        m.vx += Math.cos(a) * .14 * dt * 60;
        m.vy += Math.sin(a) * .14 * dt * 60;
        m.face = Math.cos(a) > 0 ? 1 : -1;
        if (T.rnd() < .01) T.snd.play('eyefly', .35);
      }
      const sp = Math.hypot(m.vx, m.vy);
      const max = m.speed * (bloodMoon ? 1.3 : 1) * 1.4;
      if (sp > max) { m.vx = m.vx / sp * max; m.vy = m.vy / sp * max; }
      /* 白天暴露在阳光下会消失 */
      const tx = Math.floor(cx / TS), ty = Math.floor(cy / TS);
      if (!(T.G && T.G.night) && W.topAt(tx) > ty) {
        E.burst(cx, cy, 8, { col: ['#ff9b2f', '#ffd964'], sp: 1.2, life: .4, type: 'dust' });
        E.mobs.splice(i, 1);
        continue;
      }
    } else if (m.type === 'slime' || m.type === 'small') {
      /* 史莱姆：跳跃前进 */
      m.vx += (m.face * m.speed - m.vx) * .06;
      if (m.onGround && m.jumpCd <= 0) {
        m.vy = m.type === 'slime' ? -5.2 : -6.4;
        m.jumpCd = .8;
        m.squash = 1;
      }
      if (m.onGround && Math.abs(m.vx) < .2 && p && !p.dead) {
        const dx = p.x - cx;
        if (Math.abs(dx) < 220) m.face = dx > 0 ? 1 : -1;
      }
      if (Math.abs(m.vx) < .05) m.vx = 0;
    } else {
      /* 僵尸：地面行走，遇障跳跃 */
      if (p && !p.dead) {
        const dx = (p.x + p.w / 2) - cx;
        if (Math.abs(dx) < 26 * TS) m.face = dx > 0 ? 1 : -1;
        if (Math.abs(dx) < 16 * TS && m.jumpCd <= 0 && m.onGround) { m.vy = -6.2; m.jumpCd = .55; }
      }
      const want = m.face * m.speed * (bloodMoon ? 1.25 : 1);
      m.vx += (want - m.vx) * .12;
      if (Math.abs(m.vx) < .03) m.vx = 0;
      /* 前方有墙就跳 */
      if (m.onGround) {
        const ahead = Math.floor((m.face > 0 ? m.x + m.w + 1 : m.x - 1) / TS);
        const feet = Math.floor((m.y + m.h - 1) / TS);
        if ((E.solidAt(ahead, feet) || E.solidAt(ahead, feet - 1)) && m.jumpCd <= 0) { m.vy = -6.2; m.jumpCd = .5; }
      }
      /* 白天怕光：暴露在阳光下持续掉血 */
      const tx = Math.floor(cx / TS), ty = Math.floor(cy / TS);
      if (!(T.G && T.G.night) && W.topAt(tx) > ty) m.hp -= 6 * dt;
    }

    if (m.type !== 'eye') m.vy = Math.min(m.vy + .45 * dt * 60, 13);

    /* 液体浮力 */
    const lq = inLiquid(m);
    if (lq) { m.vy = Math.max(m.vy - .28 * dt * 60, -1.6); m.inWater = true; }
    else m.inWater = false;

    E.moveEnt(m, dt);

    /* 岩浆伤害 */
    if (m.inWater && (lq >> 4) === 2) { m.hp -= 40 * dt; }

    /* 接触伤害 */
    if (p && !p.dead && m.atkCd <= 0) {
      if (cx > p.x - 4 && cx < p.x + p.w + 4 && cy > p.y - 4 && cy < p.y + p.h + 4) {
        E.hurt(p, m.dmg, cx, 4.5);
        m.atkCd = 1.1;
      }
    }
    if (m.hp <= 0) { E.killMob(m); }
  }
};

/* ------------------------------------------------------------------
   生成
------------------------------------------------------------------ */
E.count = function (type) {
  let c = 0; for (const m of E.mobs) if (m.type === type) c++;
  return c;
};

E.spawnStat = { try: 0, why: '-', x: 0, y: 0, sy: 0, gt: 0, night: 0 };
E.spawnCycle = function (dt) {
  const p = E.P, G = T.G;
  E.spawnStat.night = G.night ? 1 : 0;
  if (!p || p.dead) return;
  G.spawnT -= dt;
  if (G.spawnT > 0) return;
  G.spawnT = 1.4;
  const night = G.night, blood = G.bloodMoon;
  const ptx = p.x / TS, pty = p.y / TS;
  const under = pty > W.surfaceY(Math.floor(ptx)) + 14;

  const trySpawn = (type, tx, ty) => {
    /* 只检查出生格和头顶两格，地面本身不算 */
    E.spawnStat.try++;
    E.spawnStat.x = tx; E.spawnStat.y = ty;
    if (E.solidAt(tx, ty) || E.solidAt(tx - 1, ty) || E.solidAt(tx + 1, ty)) { E.spawnStat.why = 'ground'; return false; }
    if (E.solidAt(tx, ty - 1) || E.solidAt(tx, ty - 2)) { E.spawnStat.why = 'head'; return false; }
    E.spawnMob(type, tx * TS + 8, ty * TS + 16);
    return true;
  };

  const maxZ = blood ? 10 : 6, maxE = blood ? 7 : 4, maxS = 4;

  if (night && E.count('zombie') < maxZ) {
    const dir = T.rnd() < .5 ? -1 : 1;
    const dist = (19 + T.rnd() * 17) * dir;
    const tx = Math.floor(ptx + dist);
    for (let k = 0; k < 40; k++) {
      const x = tx + (T.rnd() * 8 - 4) * dir;
      const sy = W.surfaceY(x);
      E.spawnStat.sy = sy; E.spawnStat.gt = W.tileOrGen(x, sy);
      if (sy > 3 && W.tileOrGen(x, sy) !== 0 && trySpawn('zombie', x, sy - 1)) {
        T.snd.play('growl', .25); break;
      }
    }
  }
  if (night && E.count('eye') < maxE) {
    for (let k = 0; k < 30; k++) {
      const x = Math.floor(ptx + (T.rnd() * 28 - 14) * (T.rnd() < .5 ? -1 : 1));
      const y = Math.floor(pty + (T.rnd() * 20 - 14));
      if (y < 5) continue;
      if (E.solidAt(x, y)) continue;
      if (W.liq(x, y)) continue;
      if (W.lightAt(x, y) > 8) continue;
      E.spawnMob('eye', x * TS + 8, y * TS + 8);
      break;
    }
  }
  if ((under || night) && E.count('slime') < maxS) {
    for (let k = 0; k < 30; k++) {
      const x = Math.floor(ptx + (T.rnd() * 22 - 11) * (T.rnd() < .5 ? -1 : 1));
      const y = Math.floor(pty + (T.rnd() * 16 - 8));
      if (y < 5 || y > W.H - 5) continue;
      if (!E.solidAt(x, y + 1) || E.solidAt(x, y)) continue;
      if (W.liq(x, y)) continue;
      E.spawnMob('slime', x * TS + 8, y * TS + 8);
      T.snd.play('slime', .4);
      break;
    }
  }
};

})(window.T);
