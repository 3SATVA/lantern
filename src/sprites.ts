import { hash2 } from "./rng";
import { TILE, Tile, type Enemy, type Palette, type Player, type World } from "./types";

type Pal = Record<string, string>;

function blit(ctx: CanvasRenderingContext2D, rows: string[], x: number, y: number, pal: Pal, scale = 2): void {
  const h = rows.length;
  const w = rows[0].length;
  const ox = Math.round(x - (w * scale) / 2);
  const oy = Math.round(y - (h * scale) / 2);
  for (let row = 0; row < h; row++) {
    const line = rows[row];
    for (let col = 0; col < line.length; col++) {
      const ch = line[col];
      if (ch === "." || ch === " ") continue;
      const color = pal[ch];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(ox + col * scale, oy + row * scale, scale, scale);
    }
  }
}

const LANTERN = [
  "....gggg....",
  "...gffffg...",
  "..gfwwwwfg..",
  "..gfwEEwfg..",
  "..gfwwwwfg..",
  "..gffbbffg..",
  "...gffffg...",
  "....ghgh....",
  "...gggggg...",
  "..s......s..",
];

export function drawLantern(
  ctx: CanvasRenderingContext2D,
  player: Player,
  palette: Palette,
  time: number,
  casting: boolean,
  hurt: boolean,
): void {
  if (hurt && Math.floor(time * 18) % 2 === 0) return;
  const bob = Math.sin(time * 4 + player.x * 0.01) * 1.4;
  const glowR = 64 + Math.sin(time * 3) * 6;
  const g = ctx.createRadialGradient(player.x, player.y + bob, 4, player.x, player.y + bob, glowR);
  g.addColorStop(0, palette.glow);
  g.addColorStop(0.35, palette.accent + "55");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(player.x, player.y + bob, glowR, 0, Math.PI * 2);
  ctx.fill();

  drawScarf(ctx, player, palette, time);

  const pal: Pal = {
    g: "#3a2a22",
    f: casting ? "#fff4c2" : "#ffe08a",
    w: "#fff7d6",
    E: "#2b2118",
    b: "#e07a3d",
    h: "#6b4a32",
    s: palette.scarf,
  };
  blit(ctx, LANTERN, player.x, player.y + bob, pal, 2);

  const blink = Math.sin(time * 1.3) > 0.97;
  if (blink) {
    ctx.fillStyle = "#ffe08a";
    ctx.fillRect(Math.round(player.x - 4), Math.round(player.y + bob - 2), 3, 2);
    ctx.fillRect(Math.round(player.x + 2), Math.round(player.y + bob - 2), 3, 2);
  }
}

export function drawScarf(ctx: CanvasRenderingContext2D, player: Player, palette: Palette, time: number): void {
  const pts = player.trail;
  if (pts.length < 2) return;
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    const t = i / pts.length;
    const flutter = Math.sin(time * 10 + i * 0.7) * (3.2 * t);
    const w = Math.max(2, Math.round((1 - t) * 5));
    const x = Math.round(p.x + flutter);
    const y = Math.round(p.y + Math.cos(time * 8 + i) * t * 2);
    ctx.fillStyle = t > 0.55 ? palette.scarf : palette.accent;
    ctx.globalAlpha = 0.35 + (1 - t) * 0.65;
    ctx.fillRect(x, y, w, w);
  }
  ctx.globalAlpha = 1;
}

const SPRITE: Record<string, string[]> = {
  basic: ["..aa..", ".awwa.", "aweewa", ".awwa.", "..aa..", ".a..a."],
  tank: ["bbbbbb", "bwwwwb", "bweewb", "bwwwwb", "bbbbbb", "bb..bb"],
  fast: [".ff...", "ffffa.", "feeffa", ".ffff.", "..ff..", "...f.."],
  ranged: ["..rr..", ".rwwr.", "rweewr", ".rwwr.", "..rr..", ".r..r."],
  boss: ["..cccccc..", ".cwwwwwwc.", "cwweccwwec", "cwwwwwwwwc", ".cwwwwwwc.", "..cccccc..", ".cc....cc."],
  pod: [".pp.", "peep", ".pp."],
  clone: ["..vv..", ".vwwv.", "vweewv", ".vwwv.", "..vv.."],
};

export function drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy, time: number): void {
  const bob = Math.sin(time * 5 + e.anim) * (e.kind === "tank" ? 0.4 : 1.2);
  const rows = SPRITE[e.kind] ?? SPRITE.basic;
  const pal: Pal = {
    a: e.color,
    b: e.color,
    f: e.color,
    r: e.color,
    c: e.color,
    p: e.color,
    v: e.color,
    w: e.accent,
    e: "#1a120c",
  };
  const scale = e.kind === "boss" ? 3 : e.kind === "tank" ? 2 : 2;
  if (e.kind === "tank" || e.kind === "boss") {
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.ellipse(e.x, e.y + e.radius, e.radius, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  blit(ctx, rows, e.x, e.y + bob, pal, scale);
  if (e.hp < e.maxHp) {
    const w = e.radius * 2 + 6;
    const x = e.x - w / 2;
    const y = e.y - e.radius - 10;
    ctx.fillStyle = "#1a120c";
    ctx.fillRect(x, y, w, 3);
    ctx.fillStyle = e.accent;
    ctx.fillRect(x, y, w * Math.max(0, e.hp / e.maxHp), 3);
  }
}

export function drawTile(ctx: CanvasRenderingContext2D, world: World, tx: number, ty: number, px: number, py: number): void {
  const tile = world.tiles[ty * world.w + tx] as Tile;
  const p = world.def.palette;
  const n = hash2(tx, ty);
  if (tile === Tile.Wall) {
    ctx.fillStyle = p.wall;
    ctx.fillRect(px, py, TILE, TILE);
    ctx.fillStyle = p.wallLit;
    if (n % 5 === 0) ctx.fillRect(px + 2, py + 3, 4, 3);
    if (n % 7 === 0) ctx.fillRect(px + 9, py + 8, 5, 3);
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(px, py + TILE - 2, TILE, 2);
    return;
  }
  if (tile === Tile.Block) {
    ctx.fillStyle = (n % 2 === 0) ? p.floorAlt : p.floor;
    ctx.fillRect(px, py, TILE, TILE);
    drawProp(ctx, world, px, py, n);
    return;
  }
  const floor = n % 3 === 0 ? p.floorAlt : p.floor;
  ctx.fillStyle = tile === Tile.Path ? p.path : tile === Tile.Arena ? p.arena : floor;
  ctx.fillRect(px, py, TILE, TILE);
  if (tile === Tile.Path) {
    ctx.fillStyle = "#ffe08a";
    ctx.fillRect(px + 6, py + 6, 4, 4);
  }
  if (tile === Tile.Hazard) {
    ctx.fillStyle = p.hazard;
    ctx.fillRect(px, py, TILE, TILE);
    ctx.fillStyle = p.hazardCore;
    const o = (Math.floor(hash2(tx, ty) / 17) + Math.floor(performance.now() / 180)) % 8;
    ctx.fillRect(px + 3 + (o % 3), py + 4 + (o % 2), 4, 3);
    return;
  }
  if (n % 11 === 0 && tile !== Tile.Arena) {
    ctx.fillStyle = p.accent + "66";
    ctx.fillRect(px + (n % 8), py + ((n >> 3) % 8), 2, 2);
  }
  if (tile === Tile.Arena && (tx + ty) % 6 === 0) {
    ctx.fillStyle = p.accent + "33";
    ctx.fillRect(px, py + TILE - 2, TILE, 1);
  }
}

function drawProp(
  ctx: CanvasRenderingContext2D,
  world: World,
  px: number,
  py: number,
  n: number,
): void {
  const p = world.def.palette;
  const id = world.def.id;
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.fillRect(px + 2, py + 12, 12, 3);
  if (id === "ember") {
    ctx.fillStyle = "#2a1812";
    ctx.fillRect(px + 6, py + 4, 4, 10);
    ctx.fillStyle = "#5c3317";
    ctx.fillRect(px + 2, py + 1, 12, 6);
    ctx.fillStyle = p.hazard;
    if (n % 2 === 0) ctx.fillRect(px + 4, py + 2, 2, 2);
  } else if (id === "frost") {
    ctx.fillStyle = "#d7f6ff";
    ctx.fillRect(px + 6, py, 4, 14);
    ctx.fillStyle = "#9fd8ef";
    ctx.fillRect(px + 2, py + 3, 4, 2);
    ctx.fillRect(px + 10, py + 6, 4, 2);
  } else if (id === "verdant") {
    ctx.fillStyle = "#1b4332";
    ctx.fillRect(px + 6, py + 6, 4, 8);
    ctx.fillStyle = p.accent;
    ctx.beginPath();
    ctx.arc(px + 8, py + 5, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = n % 2 ? "#f4e285" : "#d8f3dc";
    ctx.fillRect(px + 6, py + 4, 2, 2);
  } else {
    ctx.fillStyle = p.wallLit;
    ctx.fillRect(px + 3, py + 3, 10, 10);
    ctx.fillStyle = p.sky;
    ctx.fillRect(px + 6, py + 6, 4, 4);
  }
}

export function drawMerchant(ctx: CanvasRenderingContext2D, x: number, y: number, palette: Palette, time: number): void {
  const bob = Math.sin(time * 2) * 1;
  const rows = [
    "..hhhh..",
    ".hwwwhh.",
    "hweewwh.",
    ".hwwwh..",
    "..cccc..",
    ".c.cc.c.",
    "c..cc..c",
  ];
  blit(ctx, rows, x, y + bob, { h: "#6b3a2a", w: "#f3d5b5", e: "#1a120c", c: palette.accent }, 2);
}

export function drawCore(ctx: CanvasRenderingContext2D, x: number, y: number, palette: Palette, restored: boolean, time: number): void {
  const pulse = 0.65 + Math.sin(time * (restored ? 3 : 1.4)) * 0.35;
  ctx.save();
  ctx.globalAlpha = pulse;
  ctx.fillStyle = restored ? palette.glow : "#2a2430";
  ctx.beginPath();
  ctx.arc(x, y, restored ? 16 : 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  const rows = restored
    ? ["..yyyy..", ".ywwwwy.", "ywwwwwwy", "ywwwwwwy", ".ywwwwy.", "..yyyy.."]
    : ["..dddd..", ".d....d.", "d..dd..d", "d..dd..d", ".d....d.", "..dddd.."];
  blit(
    ctx,
    rows,
    x,
    y,
    { y: palette.glow, w: "#fff8e0", d: "#3a3344" },
    2,
  );
}

export function drawPickup(ctx: CanvasRenderingContext2D, x: number, y: number, time: number): void {
  const bob = Math.sin(time * 6 + x) * 2;
  ctx.fillStyle = "#ffd166";
  ctx.fillRect(Math.round(x - 3), Math.round(y + bob - 2), 6, 5);
  ctx.fillStyle = "#fff3c4";
  ctx.fillRect(Math.round(x - 1), Math.round(y + bob - 1), 2, 2);
}

export function drawProjectile(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
  kind: string,
): void {
  ctx.fillStyle = color;
  if (kind === "lance") {
    ctx.fillRect(x - radius * 2, y - 2, radius * 4, 4);
    return;
  }
  if (kind === "root" || kind === "tear") {
    ctx.globalAlpha = 0.85;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    ctx.globalAlpha = 1;
    return;
  }
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.fillRect(x - 1, y - 1, 2, 2);
}
