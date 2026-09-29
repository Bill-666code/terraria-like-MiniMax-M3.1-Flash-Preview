/* ==========================================================================
   tiles.js —— 方块 / 物品 / 配方 定义 + 程序化像素贴图
   ========================================================================== */
(function (T) {
'use strict';
const C = T.hex2rgb, hex = T.rgb2hex, mix = T.mixc, shade = T.shade;

/* ------------------------------------------------------------------
   方块 ID
------------------------------------------------------------------ */
const TID = {
  AIR: 0, DIRT: 1, GRASS: 2, STONE: 3, WOOD: 4, LEAVES: 5, SAND: 6, GRAVEL: 7,
  COPPER: 8, IRON: 9, GOLD: 10, AMETHYST: 11, TOPAZ: 12, EMERALD: 13,
  SLATE: 14, MARBLE: 15, HELLSTONE: 16, ASH: 17, TORCH: 18,
  BENCH: 19, FURNACE: 20, CHEST: 21, DOOR: 22, DOOR_OPEN: 23, PLATFORM: 24,
  WALL_WOOD: 25, WALL_STONE: 26, GLASS: 27, MUSHROOM: 28, GLOWMOSS: 29,
  CACTUS: 30, FLOWER: 31, BED: 32, LANTERN: 33, BEDROCK: 34, TALLGRASS: 35,
};
T.TID = TID;

/* ------------------------------------------------------------------
   物品 ID
------------------------------------------------------------------ */
const IID = {
  DIRT: 1, STONE: 2, SAND: 3, GRAVEL: 4, WOOD: 5,
  COPPER_ORE: 6, IRON_ORE: 7, GOLD_ORE: 8, AMETHYST: 9, TOPAZ: 10, EMERALD: 11,
  COPPER_BAR: 12, IRON_BAR: 13, GOLD_BAR: 14, GLASS: 15, GEL: 16, MUSHROOM: 17,
  ZOMBIE_ARM: 18,
  TORCH: 20, PLATFORM: 21, WALL_WOOD: 22, WALL_STONE: 23, BENCH: 24, FURNACE: 25,
  CHEST: 26, DOOR: 27, BED: 28, LANTERN: 29,
  COPPER_PICK: 30, COPPER_AXE: 31, COPPER_SWORD: 32,
  IRON_PICK: 33, IRON_AXE: 34, IRON_SWORD: 35,
  GOLD_PICK: 36, GOLD_AXE: 37, GOLD_SWORD: 38,
};
T.IID = IID;

/* ------------------------------------------------------------------
   方块定义
   kind: solid(实心) / platform(可穿下) / plant(装饰) / furn(家具) / wall(背景墙) / liquidless
------------------------------------------------------------------ */
function td(o) {
  o.solid = o.solid !== undefined ? o.solid : true;
  o.opaque = o.opaque !== undefined ? o.opaque : o.solid;
  o.hardness = o.hardness === undefined ? 1 : o.hardness;
  o.tool = o.tool || 'pick';
  o.tier = o.tier || 0;
  return o;
}

T.tiles = [];
T.tiles[TID.AIR] = td({ name: '空气', solid: false, opaque: false, tex: null, drop: 0 });
T.tiles[TID.DIRT] = td({ name: '泥土', tex: 'dirt', hardness: .55, tool: 'pick', tier: 0, drop: IID.DIRT, color: '#8d6244' });
T.tiles[TID.GRASS] = td({ name: '草地', tex: 'grass', hardness: .6, tool: 'pick', tier: 0, drop: IID.DIRT, color: '#6a4a33' });
T.tiles[TID.STONE] = td({ name: '石头', tex: 'stone', hardness: 1.5, tool: 'pick', tier: 0, drop: IID.STONE, color: '#6a6a73' });
T.tiles[TID.SAND] = td({ name: '沙子', tex: 'sand', hardness: .5, tool: 'pick', tier: 0, drop: IID.SAND, color: '#d6c48c' });
T.tiles[TID.GRAVEL] = td({ name: '砾石', tex: 'gravel', hardness: .8, tool: 'pick', tier: 0, drop: IID.GRAVEL, color: '#7d7a76' });
T.tiles[TID.WOOD] = td({ name: '木头', tex: 'wood', hardness: 1.1, tool: 'axe', tier: 0, drop: IID.WOOD, color: '#7a4f27' });
T.tiles[TID.LEAVES] = td({ name: '树叶', tex: 'leaves', hardness: .3, tool: 'axe', tier: 0, drop: 0, dropChance: .18, dropItem: IID.WOOD, color: '#3d7a28' });
T.tiles[TID.COPPER] = td({ name: '铜矿', tex: 'ore8', ore: '#c9743a', ore2: '#f0a262', hardness: 2, tool: 'pick', tier: 1, drop: IID.COPPER_ORE, color: '#6a6a73' });
T.tiles[TID.IRON] = td({ name: '铁矿', tex: 'ore9', ore: '#b6b6c2', ore2: '#e2e2ea', hardness: 2.4, tool: 'pick', tier: 2, drop: IID.IRON_ORE, color: '#6a6a73' });
T.tiles[TID.GOLD] = td({ name: '金矿', tex: 'ore10', ore: '#e8be35', ore2: '#fff08a', hardness: 2.8, tool: 'pick', tier: 3, drop: IID.GOLD_ORE, color: '#6a6a73' });
T.tiles[TID.AMETHYST] = td({ name: '紫水晶', tex: 'gem11', ore: '#9b52d8', ore2: '#d3a4ff', hardness: 1.6, tool: 'pick', tier: 1, drop: IID.AMETHYST, color: '#6a6a73' });
T.tiles[TID.TOPAZ] = td({ name: '黄玉', tex: 'gem12', ore: '#3fbfd8', ore2: '#a5efff', hardness: 1.6, tool: 'pick', tier: 1, drop: IID.TOPAZ, color: '#6a6a73' });
T.tiles[TID.EMERALD] = td({ name: '绿宝石', tex: 'gem13', ore: '#2fae4e', ore2: '#96f0a8', hardness: 1.6, tool: 'pick', tier: 1, drop: IID.EMERALD, color: '#6a6a73' });
T.tiles[TID.SLATE] = td({ name: '深板岩', tex: 'slate', hardness: 2, tool: 'pick', tier: 0, drop: IID.STONE, color: '#454e58' });
T.tiles[TID.MARBLE] = td({ name: '大理石', tex: 'marble', hardness: 2, tool: 'pick', tier: 0, drop: IID.STONE, color: '#c6c1b6' });
T.tiles[TID.HELLSTONE] = td({ name: '狱石', tex: 'hellstone', hardness: 3.2, tool: 'pick', tier: 1, drop: 0, color: '#9c3620' });
T.tiles[TID.ASH] = td({ name: '灰烬', tex: 'ash', hardness: .6, tool: 'pick', tier: 0, drop: 0, color: '#4a423e' });
T.tiles[TID.BEDROCK] = td({ name: '基岩', tex: 'bedrock', hardness: 1e9, tool: 'pick', tier: 0, drop: 0, color: '#2a2a2e' });
T.tiles[TID.TORCH] = td({ name: '火把', tex: 'torch', solid: false, opaque: false, light: 14, hardness: .05, drop: IID.TORCH, color: '#ffb457' });
T.tiles[TID.LANTERN] = td({ name: '紫水晶灯', tex: 'lantern', solid: false, opaque: false, light: 15, hardness: .4, drop: IID.LANTERN, color: '#c79bff' });
T.tiles[TID.BENCH] = td({ name: '工作台', tex: 'bench', furn: { w: 2, h: 2 }, hardness: 1.2, tool: 'axe', tier: 0, drop: IID.BENCH, color: '#8a5a2b' });
T.tiles[TID.FURNACE] = td({ name: '熔炉', tex: 'furnace', furn: { w: 3, h: 2 }, hardness: 2, tool: 'pick', tier: 0, drop: IID.FURNACE, color: '#6a6a73' });
T.tiles[TID.CHEST] = td({ name: '箱子', tex: 'chest', furn: { w: 2, h: 2 }, hardness: 1.2, tool: 'axe', tier: 0, drop: IID.CHEST, color: '#8a5a2b' });
T.tiles[TID.DOOR] = td({ name: '木门', tex: 'door', furn: { w: 2, h: 3 }, hardness: 1, tool: 'axe', tier: 0, drop: IID.DOOR, color: '#7a4f27' });
T.tiles[TID.DOOR_OPEN] = td({ name: '木门', tex: 'doorOpen', furn: { w: 2, h: 3 }, solid: false, opaque: false, hardness: 1, tool: 'axe', tier: 0, drop: IID.DOOR, color: '#7a4f27' });
T.tiles[TID.PLATFORM] = td({ name: '木平台', tex: 'platform', solid: false, opaque: false, hardness: .5, tool: 'axe', tier: 0, drop: IID.PLATFORM, color: '#a97842' });
T.tiles[TID.WALL_WOOD] = td({ name: '木墙', tex: 'wallwood', wall: true, solid: false, opaque: false, hardness: .5, tool: 'axe', tier: 0, drop: IID.WALL_WOOD, color: '#6d4520' });
T.tiles[TID.WALL_STONE] = td({ name: '石墙', tex: 'wallstone', wall: true, solid: false, opaque: false, hardness: 1, tool: 'pick', tier: 0, drop: IID.WALL_STONE, color: '#5a5a63' });
T.tiles[TID.GLASS] = td({ name: '玻璃', tex: 'glass', opacity: false, opaque: false, hardness: .6, tool: 'pick', tier: 0, drop: IID.GLASS, color: '#bfe4f2' });
T.tiles[TID.MUSHROOM] = td({ name: '蘑菇', tex: 'mushroom', solid: false, opaque: false, hardness: .1, drop: IID.MUSHROOM, color: '#c8607a' });
T.tiles[TID.GLOWMOSS] = td({ name: '荧光苔', tex: 'moss', solid: false, opaque: false, hardness: .1, light: 9, drop: 0, color: '#4fe0a0' });
T.tiles[TID.CACTUS] = td({ name: '仙人掌', tex: 'cactus', hardness: .5, tool: 'axe', tier: 0, drop: IID.WOOD, dropChance: .35, color: '#3f8a3a' });
T.tiles[TID.FLOWER] = td({ name: '郁金香', tex: 'flower', solid: false, opaque: false, hardness: .1, drop: 0, color: '#e05a5a' });
T.tiles[TID.TALLGRASS] = td({ name: '草丛', tex: 'tallgrass', solid: false, opaque: false, hardness: .1, drop: 0, color: '#4f9a3a' });
T.tiles[TID.BED] = td({ name: '床', tex: 'bed', furn: { w: 2, h: 1 }, hardness: .8, tool: 'axe', tier: 0, drop: IID.BED, color: '#a04a4a' });
T.tile = (id) => T.tiles[id] || T.tiles[0];

/* ------------------------------------------------------------------
   物品定义
   type: block 方块 / mat 材料 / tool 工具 / weapon 武器 / food 食物 / furn 家具 / junk 垃圾
------------------------------------------------------------------ */
function itd(o) {
  o.stack = o.stack || 999;
  o.type = o.type || 'mat';
  return o;
}
T.items = [];
T.items[0] = itd({ name: '', type: 'none' });

function blockItem(iid, tileId, name) {
  T.items[iid] = itd({ name: name, type: 'block', tile: tileId, stack: 999 });
}
blockItem(IID.DIRT, TID.DIRT, '泥土');
blockItem(IID.STONE, TID.STONE, '石头');
blockItem(IID.SAND, TID.SAND, '沙子');
blockItem(IID.GRAVEL, TID.GRAVEL, '砾石');
blockItem(IID.WOOD, TID.WOOD, '木头');
blockItem(IID.GLASS, TID.GLASS, '玻璃');
blockItem(IID.TORCH, TID.TORCH, '火把');
blockItem(IID.PLATFORM, TID.PLATFORM, '木平台');
blockItem(IID.WALL_WOOD, TID.WALL_WOOD, '木墙');
blockItem(IID.WALL_STONE, TID.WALL_STONE, '石墙');
blockItem(IID.BENCH, TID.BENCH, '工作台');
blockItem(IID.FURNACE, TID.FURNACE, '熔炉');
blockItem(IID.CHEST, TID.CHEST, '箱子');
blockItem(IID.DOOR, TID.DOOR, '木门');
blockItem(IID.BED, TID.BED, '床');
blockItem(IID.LANTERN, TID.LANTERN, '紫水晶灯');

T.items[IID.COPPER_ORE] = itd({ name: '铜矿', type: 'mat' });
T.items[IID.IRON_ORE] = itd({ name: '铁矿', type: 'mat' });
T.items[IID.GOLD_ORE] = itd({ name: '金矿', type: 'mat' });
T.items[IID.AMETHYST] = itd({ name: '紫水晶', type: 'mat' });
T.items[IID.TOPAZ] = itd({ name: '黄玉', type: 'mat' });
T.items[IID.EMERALD] = itd({ name: '绿宝石', type: 'mat' });
T.items[IID.COPPER_BAR] = itd({ name: '铜锭', type: 'mat' });
T.items[IID.IRON_BAR] = itd({ name: '铁锭', type: 'mat' });
T.items[IID.GOLD_BAR] = itd({ name: '金锭', type: 'mat' });
T.items[IID.GEL] = itd({ name: '凝胶', type: 'mat', desc: '史莱姆掉落，粘糊糊的。' });
T.items[IID.MUSHROOM] = itd({ name: '蘑菇', type: 'food', heal: 25, desc: '地下洞窟里成片生长，回复 25 生命。' });
T.items[IID.ZOMBIE_ARM] = itd({ name: '僵尸手臂', type: 'junk', desc: '一只还在抽搐的手臂。目前毫无用处。' });

/* 工具：pick 镐 / axe 斧 */
function tool(iid, name, kind, tier, dmg, spd, color) {
  T.items[iid] = itd({ name: name, type: 'tool', kind: kind, tier: tier, dmg: dmg, speed: spd, color: color });
}
const TIER_NAME = ['', '铜', '铁', '金'];
tool(IID.COPPER_PICK, '铜镐', 'pick', 1, 6, 2.4, '#c9743a');
tool(IID.IRON_PICK, '铁镐', 'pick', 2, 8, 3.1, '#d6d6de');
tool(IID.GOLD_PICK, '金镐', 'pick', 3, 10, 3.8, '#e8be35');
tool(IID.COPPER_AXE, '铜斧', 'axe', 1, 7, 2.4, '#c9743a');
tool(IID.IRON_AXE, '铁斧', 'axe', 2, 9, 3.1, '#d6d6de');
tool(IID.GOLD_AXE, '金斧', 'axe', 3, 12, 3.8, '#e8be35');

function weapon(iid, name, dmg, spd, kb, color) {
  T.items[iid] = itd({ name: name, type: 'weapon', dmg: dmg, speed: spd, knock: kb, color: color });
}
weapon(IID.COPPER_SWORD, '铜剑', 9, 1.5, 3, '#c9743a');
weapon(IID.IRON_SWORD, '铁剑', 14, 1.8, 4, '#d6d6de');
weapon(IID.GOLD_SWORD, '金剑', 21, 2.1, 5.5, '#e8be35');
T.TIER_NAME = TIER_NAME;
T.item = (id) => T.items[id] || T.items[0];

/* ------------------------------------------------------------------
   合成配方   need: {物品:数量}  out: {物品:数量}  station: 'hand'|'bench'|'furnace'
------------------------------------------------------------------ */
T.recipes = [
  { out: { id: IID.TORCH, n: 4 }, need: { [IID.WOOD]: 1, [IID.GEL]: 1 }, station: 'hand', tip: '最基础的光源' },
  { out: { id: IID.PLATFORM, n: 2 }, need: { [IID.WOOD]: 1 }, station: 'hand' },
  { out: { id: IID.WALL_WOOD, n: 4 }, need: { [IID.WOOD]: 1 }, station: 'hand', tip: '背景墙不挡光以外的碰撞，可做房屋' },
  { out: { id: IID.WALL_STONE, n: 4 }, need: { [IID.STONE]: 1 }, station: 'hand' },
  { out: { id: IID.BENCH, n: 1 }, need: { [IID.WOOD]: 10 }, station: 'hand', tip: '解锁工具与家具制作' },
  { out: { id: IID.FURNACE, n: 1 }, need: { [IID.STONE]: 20, [IID.WOOD]: 5, [IID.TORCH]: 1 }, station: 'hand' },

  { out: { id: IID.COPPER_PICK, n: 1 }, need: { [IID.COPPER_BAR]: 12, [IID.WOOD]: 3 }, station: 'bench' },
  { out: { id: IID.COPPER_AXE, n: 1 }, need: { [IID.COPPER_BAR]: 9, [IID.WOOD]: 3 }, station: 'bench' },
  { out: { id: IID.COPPER_SWORD, n: 1 }, need: { [IID.COPPER_BAR]: 10, [IID.WOOD]: 2 }, station: 'bench' },
  { out: { id: IID.IRON_PICK, n: 1 }, need: { [IID.IRON_BAR]: 12, [IID.WOOD]: 3 }, station: 'bench' },
  { out: { id: IID.IRON_AXE, n: 1 }, need: { [IID.IRON_BAR]: 9, [IID.WOOD]: 3 }, station: 'bench' },
  { out: { id: IID.IRON_SWORD, n: 1 }, need: { [IID.IRON_BAR]: 10, [IID.WOOD]: 2 }, station: 'bench' },
  { out: { id: IID.GOLD_PICK, n: 1 }, need: { [IID.GOLD_BAR]: 12, [IID.WOOD]: 3 }, station: 'bench' },
  { out: { id: IID.GOLD_AXE, n: 1 }, need: { [IID.GOLD_BAR]: 9, [IID.WOOD]: 3 }, station: 'bench' },
  { out: { id: IID.GOLD_SWORD, n: 1 }, need: { [IID.GOLD_BAR]: 10, [IID.WOOD]: 2 }, station: 'bench' },

  { out: { id: IID.CHEST, n: 1 }, need: { [IID.WOOD]: 8, [IID.COPPER_BAR]: 2 }, station: 'bench' },
  { out: { id: IID.DOOR, n: 1 }, need: { [IID.WOOD]: 6, [IID.COPPER_BAR]: 1 }, station: 'bench' },
  { out: { id: IID.BED, n: 1 }, need: { [IID.WOOD]: 12, [IID.GEL]: 3 }, station: 'bench', tip: '放置后按 E 睡觉可设定重生点' },
  { out: { id: IID.LANTERN, n: 1 }, need: { [IID.AMETHYST]: 1, [IID.TORCH]: 2 }, station: 'bench' },

  /* 熔炼 */
  { out: { id: IID.COPPER_BAR, n: 1 }, need: { [IID.COPPER_ORE]: 3 }, station: 'furnace', fuel: true },
  { out: { id: IID.IRON_BAR, n: 1 }, need: { [IID.IRON_ORE]: 3 }, station: 'furnace', fuel: true },
  { out: { id: IID.GOLD_BAR, n: 1 }, need: { [IID.GOLD_ORE]: 3 }, station: 'furnace', fuel: true },
  { out: { id: IID.GLASS, n: 1 }, need: { [IID.SAND]: 2 }, station: 'furnace', fuel: true },
];
T.STATION_NAME = { hand: '徒手', bench: '工作台', furnace: '熔炉' };

/* ------------------------------------------------------------------
   贴图生成
------------------------------------------------------------------ */
const Tex = { tile: {}, item: {}, crack: [] };
T.Tex = Tex;

function px(x, col, a) { x.fillStyle = col; if (a !== undefined) x.globalAlpha = a; x.fillRect(0, 0, 1, 1); x.globalAlpha = 1; }
function rect(x, X, Y, w, h, col) { x.fillStyle = col; x.fillRect(X, Y, w, h); }
function dot(x, X, Y, r, g, b) { x.fillStyle = `rgb(${r|0},${g|0},${b|0})`; x.fillRect(X, Y, 1, 1); }

function newTex(w, h) { return T.mkCanvas(w || 16, h || 16); }

function noiseFill(x, w, h, base, amt, rng) {
  const bc = C(base);
  for (let i = 0; i < w * h; i++) {
    const k = 1 + (rng() - .5) * amt;
    dot(x, i % w, (i / w) | 0, bc[0] * k, bc[1] * k, bc[2] * k);
  }
}

function blobs(x, n, col, col2, rng, size) {
  for (let i = 0; i < n; i++) {
    const cx = (rng() * 16) | 0, cy = (rng() * 16) | 0, s = size || (1 + (rng() * 2 | 0));
    for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) {
      if (rng() < .35) continue;
      dot(x, cx + dx, cy + dy, C(col)[0] + (dx ? 22 : 0) - dy * 8, C(col)[1] + (dx ? 22 : 0) - dy * 8, C(col)[2] + (dx ? 22 : 0) - dy * 8);
    }
    if (col2) dot(x, cx, cy, C(col2)[0], C(col2)[1], C(col2)[2]);
  }
}

const builders = {
  dirt(x, rng) {
    noiseFill(x, 16, 16, '#976b4b', .22, rng);
    blobs(x, 12, '#7a5238', null, rng, 2);
    blobs(x, 5, '#ab7d59', null, rng, 1);
  },
  grass(x, rng, topOnly) {
    builders.dirt(x, rng);
    if (topOnly) {
      // 草被削掉：顶部 4 行用泥土
      noiseFillTop(x, rng);
      return;
    }
    for (let i = 0; i < 16; i++) {
      const h = 3 + ((rng() * 3) | 0);
      for (let j = 0; j < h; j++) {
        const k = 1 - j * .07 + (rng() - .5) * .16;
        const g = C('#4f9a3a');
        dot(x, i, j, g[0] * k, g[1] * k, g[2] * k);
      }
      if (rng() < .45) { dot(x, i, h, C('#4f9a3a')[0] * .8, C('#4f9a3a')[1] * .8, C('#4f9a3a')[2] * .8); }
    }
    for (let i = 0; i < 16; i += 3) dot(x, i, 0, C('#6ec24a')[0], C('#6ec24a')[1], C('#6ec24a')[2]);
  },
  stone(x, rng) {
    noiseFill(x, 16, 16, '#6a6a73', .2, rng);
    blobs(x, 8, '#5b5b64', null, rng, 2);
    blobs(x, 6, '#7d7d87', null, rng, 1);
    if (rng() < .5) { // 裂纹
      let cx = 3 + rng() * 10 | 0, cy = 3 + rng() * 10 | 0;
      for (let i = 0; i < 6; i++) { dot(x, cx, cy, 40, 40, 46); cx += rng() < .5 ? 1 : 0; cy += rng() < .5 ? 1 : (rng() < .5 ? 0 : -1); }
    }
  },
  slate(x, rng) {
    noiseFill(x, 16, 16, '#454e58', .24, rng);
    blobs(x, 10, '#39414a', null, rng, 2);
    blobs(x, 5, '#586470', null, rng, 1);
  },
  marble(x, rng) {
    noiseFill(x, 16, 16, '#c6c1b6', .14, rng);
    for (let i = 0; i < 3; i++) {
      let cx = rng() * 16 | 0, cy = 0;
      while (cy < 16) { dot(x, cx, cy, 150, 144, 134); if (rng() < .5) cx += rng() < .5 ? 1 : -1; cy++; }
    }
  },
  ash(x, rng) {
    noiseFill(x, 16, 16, '#4a423e', .3, rng);
    blobs(x, 9, '#332d2b', null, rng, 2);
    blobs(x, 4, '#6a5f58', null, rng, 1);
  },
  bedrock(x, rng) {
    noiseFill(x, 16, 16, '#2a2a2e', .5, rng);
    blobs(x, 12, '#141416', null, rng, 2);
    blobs(x, 6, '#3d3d44', null, rng, 1);
  },
  sand(x, rng) {
    noiseFill(x, 16, 16, '#d6c48c', .16, rng);
    blobs(x, 14, '#c2ae74', null, rng, 1);
    blobs(x, 6, '#eee0ae', null, rng, 1);
  },
  gravel(x, rng) {
    noiseFill(x, 16, 16, '#7d7a76', .2, rng);
    for (let i = 0; i < 14; i++) {
      const cx = rng() * 15 | 0, cy = rng() * 15 | 0, s = 2 + (rng() * 2 | 0);
      const k = .78 + rng() * .4;
      const g = C('#7d7a76');
      for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++)
        if (cx + dx < 16 && cy + dy < 16) dot(x, cx + dx, cy + dy, g[0] * k, g[1] * k, g[2] * k);
    }
  },
  wood(x, rng) {
    const b = C('#7a4f27'), l = C('#5d3a1c'), h = C('#96632f');
    for (let i = 0; i < 16; i++) {
      const k = .92 + ((i * 37) % 7) * .03;
      for (let j = 0; j < 16; j++) dot(x, i, j, b[0] * k, b[1] * k, b[2] * k);
    }
    for (let i = 0; i < 16; i += 3) { if (rng() < .8) for (let j = 0; j < 16; j++) { const k = .9 + rng() * .2; dot(x, i, j, l[0] * k, l[1] * k, l[2] * k); } }
    for (let i = 0; i < 16; i += 4) for (let j = 0; j < 16; j += 5) if (rng() < .5) dot(x, i, j, h[0], h[1], h[2]);
  },
  leaves(x, rng) {
    const a = C('#3d7a28'), b = C('#2f6b20'), c = C('#58a83a'), d = C('#245a1c');
    for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) {
      const v = T.hash2(i, j, ((rng() * 1e6) | 0));
      const col = v < .22 ? d : v < .52 ? a : v < .82 ? b : c;
      dot(x, i, j, col[0], col[1], col[2]);
    }
    /* 少量缝隙透光，但不至于把树冠打成筛子 */
    for (let i = 2; i < 14; i += 4) for (let j = 2; j < 14; j += 5)
      if (T.hash2(i, j, 31) < .35) { const hi = C('#66bb46'); dot(x, i, j, hi[0], hi[1], hi[2]); }
  },
  ore(x, rng, t) {
    builders.stone(x, rng);
    const o = C(t.ore), o2 = C(t.ore2);
    for (let i = 0; i < 5; i++) {
      const cx = 1 + rng() * 13 | 0, cy = 1 + rng() * 13 | 0, s = 2 + (rng() * 2 | 0);
      for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) {
        if (rng() < .15) continue;
        dot(x, cx + dx, cy + dy, o[0], o[1], o[2]);
      }
      dot(x, cx, cy, o2[0], o2[1], o2[2]);
    }
  },
  gem(x, rng, t) {
    builders.stone(x, rng);
    const o = C(t.ore), o2 = C(t.ore2);
    const pts = [[4, 6], [8, 4], [11, 8], [6, 10], [9, 12], [3, 11]];
    for (let i = 0; i < 4; i++) {
      const p = pts[(rng() * pts.length) | 0];
      const cx = p[0] + (rng() * 2 | 0), cy = p[1] + (rng() * 2 | 0);
      rect(x, cx, cy, 2, 2, t.ore);
      dot(x, cx, cy, o2[0], o2[1], o2[2]);
      dot(x, cx + 1, cy + 1, o[0] * .7, o[1] * .7, o[2] * .7);
    }
  },
  hellstone(x, rng) {
    noiseFill(x, 16, 16, '#8c3220', .24, rng);
    for (let i = 0; i < 5; i++) {
      let cx = rng() * 16 | 0, cy = rng() * 16 | 0;
      for (let j = 0; j < 6; j++) { dot(x, cx, cy, 236, 128, 48); cx += rng() < .5 ? 1 : (rng() < .5 ? 0 : -1); cy += rng() < .5 ? 1 : 0; }
    }
    blobs(x, 6, '#5c1e12', null, rng, 2);
    blobs(x, 5, '#c2502a', null, rng, 1);
  },
  torch(x, rng) {   /* 16x16，火把只占中下部 */
    for (let y = 6; y < 16; y++) rect(x, 7, y, 2, 1, '#7a4f27');
    rect(x, 7, 6, 2, 1, '#5d3a1c');
    rect(x, 6, 3, 4, 3, '#ff9b2f');
    rect(x, 7, 2, 2, 2, '#ffd964');
    rect(x, 7, 4, 2, 1, '#e8641c');
  },
  lantern(x, rng) {
    rect(x, 7, 2, 2, 3, '#6a6a73');
    rect(x, 5, 5, 6, 7, '#9b52d8');
    rect(x, 6, 6, 4, 4, '#d3a4ff');
    rect(x, 5, 12, 6, 1, '#6a6a73');
    rect(x, 7, 5, 2, 1, '#e8d0ff');
  },
  platform(x, rng) {
    rect(x, 0, 0, 16, 5, '#a97842');
    rect(x, 0, 0, 16, 1, '#c08c50');
    rect(x, 0, 5, 16, 2, '#6d4520');
    rect(x, 3, 7, 1, 2, '#5d3a1c');
    rect(x, 8, 7, 1, 2, '#5d3a1c');
    rect(x, 13, 7, 1, 2, '#5d3a1c');
  },
  wallwood(x, rng) {
    const a = C('#7a4f27'), b = C('#5d3a1c');
    for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) {
      const k = .93 + ((i * 13 + j * 7) % 9) * .015;
      dot(x, i, j, a[0] * k, a[1] * k, a[2] * k);
    }
    rect(x, 0, 0, 16, 1, b); rect(x, 0, 7, 16, 1, b); rect(x, 0, 15, 16, 1, b);
    rect(x, 7, 0, 1, 7, b); rect(x, 3, 8, 1, 7, b); rect(x, 11, 8, 1, 7, b);
  },
  wallstone(x, rng) {
    const a = C('#5f5f68'), b = C('#47474f');
    noiseFill(x, 16, 16, '#5f5f68', .12, rng);
    rect(x, 0, 0, 16, 1, b); rect(x, 0, 7, 16, 1, b); rect(x, 0, 15, 16, 1, b);
    rect(x, 0, 0, 1, 8, b); rect(x, 8, 0, 1, 8, b);
    rect(x, 4, 7, 1, 9, b); rect(x, 12, 7, 1, 9, b);
    for (let i = 0; i < 10; i++) { const p = (T.hash2(i, i * 3, 5) * 16) | 0; dot(x, p, (p + 3) % 16, 120, 120, 130); }
  },
  glass(x, rng) {
    for (let i = 0; i < 16; i++) { dot(x, i, 0, 200, 230, 245); dot(x, i, 15, 180, 210, 230); dot(x, 0, i, 200, 230, 245); dot(x, 15, i, 180, 210, 230); }
    x.globalAlpha = .5;
    rect(x, 1, 1, 14, 14, '#bfe4f2');
    x.globalAlpha = 1;
    x.fillStyle = '#ffffff';
    for (let i = 0; i < 6; i++) { x.globalAlpha = .35; x.fillRect(3 + i * 2, 3, 1, 5); }
    x.globalAlpha = 1;
  },
  mushroom(x, rng) {
    rect(x, 7, 9, 2, 6, '#e8dcc0');
    rect(x, 4, 5, 8, 5, '#c8607a');
    rect(x, 5, 4, 6, 1, '#e07a92');
    rect(x, 5, 7, 1, 1, '#fff'); rect(x, 9, 6, 1, 1, '#fff'); rect(x, 7, 5, 1, 1, '#fff');
  },
  moss(x, rng) {
    for (let i = 0; i < 16; i++) {
      const h = 2 + (T.hash2(i, 1, 3) * 4 | 0);
      for (let j = 16 - h; j < 16; j++) {
        const k = .8 + T.hash2(i, j, 9) * .5;
        dot(x, i, j, 79 * k, 224 * k, 160 * k);
      }
    }
    for (let i = 0; i < 5; i++) { const cx = T.hash2(i, 5, 11) * 15 | 0, cy = 12 + (T.hash2(i, 6, 12) * 3 | 0); dot(x, cx, cy, 200, 255, 225); }
  },
  cactus(x, rng) {
    rect(x, 5, 0, 6, 16, '#3f8a3a');
    rect(x, 6, 0, 1, 16, '#5cb04f');
    rect(x, 10, 0, 1, 16, '#2c6629');
    for (let j = 1; j < 16; j += 3) { dot(x, 4, j, 220, 220, 180); dot(x, 11, j + 1, 220, 220, 180); }
  },
  flower(x, rng) {
    rect(x, 7, 8, 2, 8, '#3f8a3a');
    rect(x, 5, 10, 2, 1, '#3f8a3a'); rect(x, 9, 12, 2, 1, '#3f8a3a');
    rect(x, 6, 4, 4, 4, '#e0503f');
    rect(x, 7, 3, 2, 2, '#f5a05a');
    rect(x, 7, 5, 2, 2, '#f5d05a');
  },
  tallgrass(x, rng) {
    for (let i = 0; i < 16; i++) {
      if (T.hash2(i, 2, 4) < .45) continue;
      const h = 5 + (T.hash2(i, 3, 5) * 8 | 0);
      for (let j = 0; j < h; j++) {
        const k = .8 + j / h * .5;
        dot(x, i, 16 - j, 79 * k, 154 * k, 58 * k);
      }
    }
  },
  /* 家具贴图（多格） */
  bench(x, rng) {
    noiseFill(x, 32, 32, '#6b4a2a', .12, rng);
    rect(x, 0, 0, 32, 3, '#9a6a34');
    rect(x, 0, 12, 32, 3, '#7a5027');
    rect(x, 0, 27, 32, 3, '#5d3a1c');
    rect(x, 2, 3, 3, 9, '#8a5a2b'); rect(x, 27, 3, 3, 9, '#8a5a2b');
    rect(x, 2, 15, 3, 12, '#7a4f27'); rect(x, 27, 15, 3, 12, '#7a4f27');
    // 桌面上的工具
    rect(x, 9, 6, 10, 2, '#c0c0c8'); rect(x, 6, 5, 4, 3, '#b8862f');
    rect(x, 18, 5, 2, 8, '#7a4f27'); rect(x, 16, 4, 6, 3, '#c0c0c8');
    rect(x, 24, 8, 2, 6, '#7a4f27');
  },
  furnace(x, rng) {
    noiseFill(x, 48, 32, '#5a5a63', .12, rng);
    rect(x, 0, 0, 48, 2, '#7a7a84');
    rect(x, 0, 2, 48, 1, '#4a4a52');
    // 炉口
    rect(x, 13, 12, 22, 20, '#1a1418');
    rect(x, 15, 15, 18, 15, '#2a1a12');
    for (let i = 0; i < 18; i++) {
      const w = 2 + (T.hash2(i, 1, 8) * 5 | 0);
      rect(x, 16 + i, 24 - (T.hash2(i, 2, 9) * 5 | 0), w, 3 + (T.hash2(i, 3, 10) * 4 | 0), T.hash2(i, 4, 11) < .5 ? '#ff7a18' : '#ffb43f');
    }
    rect(x, 12, 11, 24, 2, '#6a6a74');
    rect(x, 4, 6, 8, 3, '#3a3a42'); rect(x, 4, 10, 8, 1, '#3a3a42');
  },
  chest(x, rng) {
    noiseFill(x, 32, 32, '#000000', 0, rng);
    rect(x, 0, 4, 32, 28, '#8a5a2b');
    rect(x, 0, 4, 32, 4, '#a97842');
    rect(x, 0, 12, 32, 2, '#5d3a1c');
    rect(x, 0, 4, 2, 28, '#6d4520'); rect(x, 30, 4, 2, 28, '#6d4520');
    rect(x, 6, 6, 3, 24, '#c0c0c8'); rect(x, 23, 6, 3, 24, '#c0c0c8');
    rect(x, 13, 11, 6, 6, '#d8b23a');
    rect(x, 15, 13, 2, 3, '#3a2a10');
    for (let i = 0; i < 40; i++) { const p = (T.hash2(i, 2, 4) * 32) | 0, q = (T.hash2(i, 3, 5) * 32) | 0; x.fillStyle = 'rgba(0,0,0,.12)'; x.fillRect(p, q, 1, 1); }
  },
  door(x, rng) {
    noiseFill(x, 32, 48, '#7a4f27', .1, rng);
    rect(x, 0, 0, 32, 2, '#5d3a1c');
    rect(x, 2, 3, 28, 42, '#8a5a2b');
    rect(x, 2, 3, 28, 2, '#a97842');
    rect(x, 2, 3, 2, 42, '#6d4520'); rect(x, 28, 3, 2, 42, '#6d4520');
    rect(x, 2, 22, 28, 2, '#5d3a1c');
    rect(x, 4, 5, 24, 15, '#96632f');
    rect(x, 4, 25, 24, 18, '#96632f');
    rect(x, 24, 24, 3, 3, '#e8c65a');
    rect(x, 15, 0, 2, 3, '#c0c0c8');
  },
  doorOpen(x, rng) {
    x.clearRect(0, 0, 32, 48);
    rect(x, 0, 0, 5, 48, '#5d3a1c');
    rect(x, 0, 0, 1, 48, '#8a5a2b');
  },
  bed(x, rng) {
    rect(x, 0, 4, 32, 12, '#7a3a3a');
    rect(x, 0, 4, 32, 4, '#a04a4a');
    rect(x, 1, 6, 30, 8, '#c85a5a');
    rect(x, 2, 5, 8, 8, '#f0ece0');
    rect(x, 0, 14, 32, 2, '#5d3a1c');
    rect(x, 2, 16, 2, 4, '#6d4520'); rect(x, 28, 16, 2, 4, '#6d4520');
  },
};

function noiseFillTop(x, rng) {
  for (let i = 0; i < 16; i++) for (let j = 0; j < 4; j++) {
    const k = 1 + (rng() - .5) * .22;
    dot(x, i, j, 151 * k, 107 * k, 75 * k);
  }
}

/* 生成所有方块贴图 */
Tex.build = function () {
  const mkVariants = (name, fn, n) => {
    const arr = [];
    for (let v = 0; v < (n || 3); v++) {
      const { c, x } = newTex();
      const rng = T.mulberry32(0x9e37 + name.length * 977 + v * 131);
      fn(x, rng, v);
      c.__name = name;
      arr.push(c);
    }
    Tex.tile[name] = arr;
  };
  mkVariants('dirt', builders.dirt);
  mkVariants('grass', (x, rng) => builders.grass(x, rng, false));
  mkVariants('grastop', (x, rng) => builders.grass(x, rng, true));
  mkVariants('stone', builders.stone);
  mkVariants('slate', builders.slate);
  mkVariants('marble', builders.marble);
  mkVariants('ash', builders.ash);
  mkVariants('bedrock', builders.bedrock);
  mkVariants('sand', builders.sand);
  mkVariants('gravel', builders.gravel);
  mkVariants('wood', builders.wood);
  mkVariants('leaves', builders.leaves);
  mkVariants('hellstone', builders.hellstone);
  mkVariants('torch', builders.torch, 1);
  mkVariants('lantern', builders.lantern, 1);
  mkVariants('platform', builders.platform, 1);
  mkVariants('wallwood', builders.wallwood);
  mkVariants('wallstone', builders.wallstone);
  mkVariants('glass', builders.glass, 1);
  mkVariants('mushroom', builders.mushroom, 1);
  mkVariants('moss', builders.moss, 1);
  mkVariants('cactus', builders.cactus, 1);
  mkVariants('flower', builders.flower, 1);
  mkVariants('tallgrass', builders.tallgrass, 1);
  for (const id of [TID.COPPER, TID.IRON, TID.GOLD]) mkVariants('ore' + id, (x, rng) => builders.ore(x, rng, T.tile(id)));
  for (const id of [TID.AMETHYST, TID.TOPAZ, TID.EMERALD]) mkVariants('gem' + id, (x, rng) => builders.gem(x, rng, T.tile(id)));
  mkVariants('bench', builders.bench, 1);
  mkVariants('furnace', builders.furnace, 1);
  mkVariants('chest', builders.chest, 1);
  mkVariants('door', builders.door, 1);
  mkVariants('doorOpen', builders.doorOpen, 1);
  mkVariants('bed', builders.bed, 1);

  /* 挖掘裂纹 10 阶 */
  Tex.crack = [];
  for (let s = 0; s < 10; s++) {
    const { c, x } = newTex();
    const n = 2 + s * 3;
    const rng = T.mulberry32(1234 + s * 77);
    x.fillStyle = 'rgba(0,0,0,.55)';
    for (let i = 0; i < n; i++) {
      let cx = 2 + rng() * 12 | 0, cy = 2 + rng() * 12 | 0, len = 2 + (rng() * 5 | 0);
      for (let j = 0; j < len; j++) { x.fillRect(cx, cy, 1, 1); if (rng() < .6) cx += rng() < .5 ? 1 : -1; if (rng() < .6) cy += rng() < .5 ? 1 : -1; }
    }
    Tex.crack.push(c);
  }

  buildItemIcons();
};

/* -------------------- 物品图标 -------------------- */
const iconBuilders = {
  bar(x, col) {
    const a = C(col), d = shade(a, .72), l = shade(a, 1.25);
    rect(x, 1, 8, 14, 6, col);
    rect(x, 1, 8, 14, 1, l);
    rect(x, 1, 12, 14, 1, d);
    rect(x, 4, 9, 3, 1, l);
  },
  orePile(x, stone, ore, ore2) {
    builders.stone(x, T.mulberry32(5));
    x.globalAlpha = 0;
    x.clearRect(0, 0, 0, 0);
    x.globalAlpha = 1;
    for (let i = 0; i < 4; i++) {
      const cx = 2 + T.hash2(i, 1, 3) * 11 | 0, cy = 3 + T.hash2(i, 2, 4) * 9 | 0;
      rect(x, cx, cy, 3, 3, ore);
      dot(x, cx, cy, C(ore2)[0], C(ore2)[1], C(ore2)[2]);
      dot(x, cx + 2, cy + 2, C(ore)[0] * .7, C(ore)[1] * .7, C(ore)[2] * .7);
    }
  },
  gemIcon(x, t) {
    rect(x, 0, 0, 16, 16, '#3a3a44');
    builders.stone(x, T.mulberry32(21));
    const cx = 7, cy = 5;
    x.fillStyle = t.ore;
    x.beginPath(); x.moveTo(cx + 1, cy); x.lineTo(cx + 4, cy + 2); x.lineTo(cx + 3, cy + 6); x.lineTo(cx, cy + 4); x.closePath(); x.fill();
    x.fillStyle = t.ore2;
    x.beginPath(); x.moveTo(cx + 1, cy + .5); x.lineTo(cx + 3, cy + 2); x.lineTo(cx + 2, cy + 4); x.closePath(); x.fill();
    x.fillStyle = t.ore;
    x.beginPath(); x.moveTo(cx - 3, cy + 5); x.lineTo(cx - 1, cy + 3); x.lineTo(cx + 1, cy + 6); x.lineTo(cx - 1, cy + 9); x.closePath(); x.fill();
  },
  gel(x) {
    x.fillStyle = '#4aa8e0';
    x.beginPath(); x.moveTo(8, 2); x.lineTo(14, 9); x.quadraticCurveTo(15, 14, 8, 14); x.quadraticCurveTo(1, 14, 2, 9); x.closePath(); x.fill();
    x.fillStyle = '#8fd8f8';
    x.beginPath(); x.ellipse(6, 6, 2.4, 1.6, -.5, 0, 7); x.fill();
  },
  arm(x) {
    x.fillStyle = '#6f9a4a'; x.fillRect(3, 3, 5, 9);
    x.fillStyle = '#87b35c'; x.fillRect(3, 3, 2, 9);
    x.fillStyle = '#5b3a28'; x.fillRect(2, 11, 6, 4);
    x.fillStyle = '#6f9a4a'; x.fillRect(7, 5, 5, 3);
    x.fillStyle = '#87b35c'; x.fillRect(7, 5, 5, 1);
  },
  pick(x, col) {
    const a = C(col), l = shade(a, 1.3), d = shade(a, .7);
    x.fillStyle = '#7a4f27'; x.fillRect(7, 6, 2, 9);
    x.fillStyle = '#5d3a1c'; x.fillRect(7, 6, 1, 9);
    x.strokeStyle = col; x.lineWidth = 2;
    x.beginPath(); x.moveTo(2, 7); x.quadraticCurveTo(8, 1, 14, 7); x.stroke();
    x.fillStyle = l; x.fillRect(2, 6, 3, 1); x.fillRect(12, 6, 3, 1);
    x.fillStyle = d; x.fillRect(4, 4, 2, 1);
  },
  axe(x, col) {
    const a = C(col);
    x.fillStyle = '#7a4f27'; x.fillRect(7, 4, 2, 11);
    x.fillStyle = '#5d3a1c'; x.fillRect(7, 4, 1, 11);
    x.fillStyle = col; x.beginPath(); x.moveTo(8, 3); x.lineTo(14, 4); x.lineTo(15, 9); x.lineTo(8, 10); x.closePath(); x.fill();
    x.fillStyle = shade(a, 1.35); x.fillRect(9, 4, 4, 1);
    x.fillStyle = shade(a, .7); x.fillRect(9, 8, 5, 1);
  },
  sword(x, col) {
    const a = C(col);
    x.save(); x.translate(8, 8); x.rotate(-Math.PI / 4); x.translate(-8, -8);
    x.fillStyle = col; x.fillRect(7, 1, 3, 10);
    x.fillStyle = shade(a, 1.35); x.fillRect(7, 1, 1, 10);
    x.fillStyle = shade(a, .68); x.fillRect(9, 1, 1, 10);
    x.fillStyle = '#c0c0c8'; x.fillRect(4, 11, 9, 2);
    x.fillStyle = '#7a4f27'; x.fillRect(7, 13, 3, 3);
    x.fillStyle = '#d8b23a'; x.fillRect(7, 15, 3, 1);
    x.restore();
  },
};

function buildItemIcons() {
  const I = (id, fn) => { const { c, x } = newTex(); fn(x); c.__name = 'item' + id; Tex.item[id] = c; };
  const T2 = T.TID;
  /* 方块类：直接用方块贴图 */
  const blockMap = {
    [IID.DIRT]: T2.DIRT, [IID.STONE]: T2.STONE, [IID.SAND]: T2.SAND, [IID.GRAVEL]: T2.GRAVEL,
    [IID.WOOD]: T2.WOOD, [IID.GLASS]: T2.GLASS, [IID.TORCH]: T2.TORCH, [IID.PLATFORM]: T2.PLATFORM,
    [IID.WALL_WOOD]: T2.WALL_WOOD, [IID.WALL_STONE]: T2.WALL_STONE, [IID.MUSHROOM]: T2.MUSHROOM,
  };
  for (const iid in blockMap) {
    const t = T.tile(+blockMap[iid]);
    const name = t.tex;
    let arr = Tex.tile[name];
    if (name === 'grass') arr = Tex.tile.grastop;
    Tex.item[iid] = arr ? arr[0] : null;
  }
  ['BENCH', 'FURNACE', 'CHEST', 'DOOR', 'BED', 'LANTERN'].forEach(k => { const c = Tex.tile[k.toLowerCase()]; if (c && c[0]) c[0].__name = 'item' + k; });
  Tex.item[IID.BENCH] = Tex.tile.bench[0];
  Tex.item[IID.FURNACE] = Tex.tile.furnace[0];
  Tex.item[IID.CHEST] = Tex.tile.chest[0];
  Tex.item[IID.DOOR] = Tex.tile.door[0];
  Tex.item[IID.BED] = Tex.tile.bed[0];
  Tex.item[IID.LANTERN] = Tex.tile.lantern[0];

  I(IID.COPPER_ORE, (x) => iconBuilders.orePile(x, 0, '#c9743a', '#f0a262'));
  I(IID.IRON_ORE, (x) => iconBuilders.orePile(x, 0, '#b6b6c2', '#e2e2ea'));
  I(IID.GOLD_ORE, (x) => iconBuilders.orePile(x, 0, '#e8be35', '#fff08a'));
  I(IID.AMETHYST, (x) => iconBuilders.gemIcon(x, T.tile(T2.AMETHYST)));
  I(IID.TOPAZ, (x) => iconBuilders.gemIcon(x, T.tile(T2.TOPAZ)));
  I(IID.EMERALD, (x) => iconBuilders.gemIcon(x, T.tile(T2.EMERALD)));
  I(IID.COPPER_BAR, (x) => iconBuilders.bar(x, '#c9743a'));
  I(IID.IRON_BAR, (x) => iconBuilders.bar(x, '#d6d6de'));
  I(IID.GOLD_BAR, (x) => iconBuilders.bar(x, '#e8be35'));
  I(IID.GEL, iconBuilders.gel);
  I(IID.ZOMBIE_ARM, iconBuilders.arm);
  I(IID.COPPER_PICK, (x) => iconBuilders.pick(x, '#c9743a'));
  I(IID.IRON_PICK, (x) => iconBuilders.pick(x, '#d6d6de'));
  I(IID.GOLD_PICK, (x) => iconBuilders.pick(x, '#e8be35'));
  I(IID.COPPER_AXE, (x) => iconBuilders.axe(x, '#c9743a'));
  I(IID.IRON_AXE, (x) => iconBuilders.axe(x, '#d6d6de'));
  I(IID.GOLD_AXE, (x) => iconBuilders.axe(x, '#e8be35'));
  I(IID.COPPER_SWORD, (x) => iconBuilders.sword(x, '#c9743a'));
  I(IID.IRON_SWORD, (x) => iconBuilders.sword(x, '#d6d6de'));
  I(IID.GOLD_SWORD, (x) => iconBuilders.sword(x, '#e8be35'));
}

})(window.T);
