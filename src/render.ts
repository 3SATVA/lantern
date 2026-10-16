import { DIMENSIONS, SHOP, SPELLS, priceOf } from "./content";
import { drawText, drawTextShadow, textWidth } from "./font";
import {
  drawCore,
  drawEnemy,
  drawLantern,
  drawMerchant,
  drawPickup,
  drawProjectile,
  drawTile,
} from "./sprites";
import type { Runtime } from "./state";
import { TILE, Tile } from "./types";
import { stackButtons, touchButtons, type Rect } from "./ui";

function panel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string, edge: string): void {
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = edge;
  ctx.fillRect(x, y, w, 2);
  ctx.fillRect(x, y + h - 2, w, 2);
  ctx.fillRect(x, y, 2, h);
  ctx.fillRect(x + w - 2, y, 2, h);
}

function bar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, ratio: number, fill: string, back: string): void {
  ctx.fillStyle = back;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = fill;
  ctx.fillRect(x + 1, y + 1, Math.max(0, (w - 2) * ratio), h - 2);
}

function button(ctx: CanvasRenderingContext2D, r: Rect, accent: string, hot = false): void {
  panel(ctx, r.x, r.y, r.w, r.h, hot ? "#3a241c" : "#1a1218", hot ? accent : "#6b5344");
  drawText(ctx, r.label, r.x + r.w / 2, r.y + Math.floor((r.h - 14) / 2), hot ? "#fff4d8" : "#f0ddc0", 2, "center");
}

function ensureMinimap(rt: Runtime): void {
  if (rt.minimap) return;
  const canvas = document.createElement("canvas");
  canvas.width = rt.world.w;
  canvas.height = rt.world.h;
  const g = canvas.getContext("2d");
  if (!g) return;
  const pal = rt.world.def.palette;
  for (let y = 0; y < rt.world.h; y++) {
    for (let x = 0; x < rt.world.w; x++) {
      const tile = rt.world.tiles[y * rt.world.w + x] as Tile;
      g.fillStyle =
        tile === Tile.Wall || tile === Tile.Block
          ? pal.wall
          : tile === Tile.Hazard
            ? pal.hazard
            : tile === Tile.Arena
              ? pal.arena
              : tile === Tile.Path
                ? pal.path
                : pal.floor;
      g.fillRect(x, y, 1, 1);
    }
  }
  rt.minimap = canvas;
}

function drawWorld(ctx: CanvasRenderingContext2D, rt: Runtime): void {
  const pal = rt.world.def.palette;
  const z = rt.zoom;
  const shake = rt.shake > 0 ? (Math.random() - 0.5) * rt.shake * 2 : 0;
  ctx.setTransform(z, 0, 0, z, -rt.camera.x * z + shake, -rt.camera.y * z);
  const x0 = Math.max(0, Math.floor(rt.camera.x / TILE) - 1);
  const y0 = Math.max(0, Math.floor(rt.camera.y / TILE) - 1);
  const x1 = Math.min(rt.world.w - 1, Math.ceil((rt.camera.x + rt.viewW / z) / TILE) + 1);
  const y1 = Math.min(rt.world.h - 1, Math.ceil((rt.camera.y + rt.viewH / z) / TILE) + 1);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) drawTile(ctx, rt.world, tx, ty, tx * TILE, ty * TILE);
  }
  drawMerchant(ctx, rt.world.shopX, rt.world.shopY, pal, rt.time);
  drawCore(ctx, rt.world.coreX, rt.world.coreY, pal, rt.world.restored, rt.time);
  for (const c of rt.pickups) drawPickup(ctx, c.x, c.y, rt.time);
  for (const pr of rt.projectiles) {
    if (pr.delay > 0) {
      ctx.globalAlpha = 0.35 + Math.sin(rt.time * 12) * 0.1;
      ctx.strokeStyle = pr.color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(pr.x, pr.y, pr.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else {
      drawProjectile(ctx, pr.x, pr.y, pr.radius, pr.color, pr.kind);
    }
  }
  if (rt.whip && rt.whip.life > 0) {
    const reach = 48 * (1 + 0.15 * (rt.upgrades.rng ?? 0));
    ctx.fillStyle = pal.scarf;
    for (let i = 0; i < 8; i++) {
      const a = rt.whip.angle - 0.65 + (i / 7) * 1.3;
      const dist = reach * (0.45 + (i % 3) * 0.15);
      ctx.fillRect(rt.player.x + Math.cos(a) * dist, rt.player.y + Math.sin(a) * dist, 4, 4);
    }
  }
  const boss = rt.enemies.find((e) => e.kind === "boss" && e.boss?.pattern === "slam" && e.boss.cast === 0);
  if (boss) {
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = boss.accent;
    ctx.beginPath();
    ctx.arc(boss.x, boss.y, 36 + (1.2 - (boss.boss?.timer ?? 0)) * 20, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  const cone = rt.enemies.find((e) => e.kind === "boss" && e.boss?.pattern === "cone");
  if (cone?.boss) {
    ctx.save();
    ctx.translate(cone.x, cone.y);
    ctx.rotate(cone.boss.data[4] || 0);
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = "#e7f8ff";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, 210, -0.4, 0.4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;
  }
  for (const e of rt.enemies) drawEnemy(ctx, e, rt.time);
  for (const particle of rt.particles) {
    ctx.globalAlpha = Math.max(0, particle.life / particle.max);
    ctx.fillStyle = particle.color;
    ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
  }
  ctx.globalAlpha = 1;
  drawLantern(ctx, rt.player, pal, rt.time, rt.player.cooldowns[rt.spells[rt.player.spell]] > 0.02, rt.player.hurt > 0);
  if (rt.guard > 0) {
    ctx.globalAlpha = 0.45 + Math.sin(rt.time * 8) * 0.2;
    ctx.strokeStyle = pal.glow;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(rt.player.x, rt.player.y, 18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  for (const f of rt.floaters) drawText(ctx, f.text, f.x, f.y, f.color, 1, "center");
  if (rt.bossLock) {
    const a = rt.world.arena;
    ctx.strokeStyle = pal.accent;
    ctx.lineWidth = 2;
    ctx.strokeRect(a.x + 1, a.y + 1, a.w - 2, a.h - 2);
  }
}

function drawPointer(ctx: CanvasRenderingContext2D, rt: Runtime): void {
  const z = rt.zoom;
  const sx = (rt.objective.x - rt.camera.x) * z;
  const sy = (rt.objective.y - rt.camera.y) * z;
  const pad = 48;
  const on = sx > pad && sy > 80 && sx < rt.viewW - pad && sy < rt.viewH - 70;
  const tag = rt.objective.tag || "CORE";
  if (on) {
    const bob = Math.sin(rt.time * 6) * 6;
    ctx.fillStyle = "#1a100c";
    ctx.fillRect(sx - 18, sy - 46 + bob, 36, 16);
    ctx.fillStyle = "#ffe566";
    ctx.fillRect(sx - 3, sy - 42 + bob, 6, 6);
    ctx.fillRect(sx - 8, sy - 34 + bob, 16, 5);
    ctx.fillRect(sx - 5, sy - 28 + bob, 10, 5);
    drawText(ctx, tag, sx, sy - 44 + bob, "#ffe566", 1, "center");
    return;
  }
  const ang = Math.atan2(sy - rt.viewH / 2, sx - rt.viewW / 2);
  let ex = Math.max(70, Math.min(rt.viewW - 70, rt.viewW / 2 + Math.cos(ang) * (rt.viewW / 2 - 64)));
  let ey = Math.max(100, Math.min(rt.viewH - 80, rt.viewH / 2 + Math.sin(ang) * (rt.viewH / 2 - 64)));
  if (ex > rt.viewW - 190 && ey < 200) ey = 210;
  ctx.fillStyle = "rgba(12,8,10,0.85)";
  ctx.fillRect(ex - 28, ey - 18, 56, 36);
  ctx.fillStyle = "#ffe566";
  ctx.fillRect(ex - 26, ey - 16, 52, 2);
  ctx.save();
  ctx.translate(ex, ey - 2);
  ctx.rotate(ang);
  ctx.fillStyle = "#ffe566";
  ctx.fillRect(0, -4, 16, 8);
  ctx.fillRect(12, -8, 6, 4);
  ctx.fillRect(12, 4, 6, 4);
  ctx.restore();
  drawText(ctx, tag, ex, ey + 8, "#ffe566", 1, "center");
}

function drawHud(ctx: CanvasRenderingContext2D, rt: Runtime): void {
  const pal = rt.world.def.palette;
  const p = rt.player;
  panel(ctx, 12, 12, 280, 92, "rgba(12,8,10,0.88)", pal.accent);
  drawText(ctx, "HP", 24, 22, "#ff8fa3", 2);
  bar(ctx, 64, 24, 150, 14, p.hp / p.maxHp, "#ff5d73", "#3a1c24");
  drawText(ctx, `${Math.ceil(p.hp)}`, 224, 22, "#ffd0d8", 2);
  drawText(ctx, "MP", 24, 46, "#9ad7ff", 2);
  bar(ctx, 64, 48, 150, 14, p.mana / p.maxMana, "#5ec8ff", "#102433");
  drawText(ctx, `${Math.ceil(p.mana)}`, 224, 46, "#d7f3ff", 2);
  const spell = SPELLS[rt.spells[p.spell]];
  drawText(ctx, `${rt.gold} G`, 24, 74, "#ffd166", 2);
  drawText(ctx, spell.name, 110, 74, "#fff6e4", 2);

  const questH = rt.objective.side ? 96 : 74;
  panel(ctx, 12, 112, 340, questH, "rgba(12,8,10,0.88)", "#6b5344");
  drawText(ctx, "QUEST", 24, 122, pal.accent, 2);
  drawText(ctx, rt.objective.title, 24, 146, "#fff6e4", 2);
  drawText(ctx, rt.objective.detail, 24, 168, "#d9cbb8", 2);
  if (rt.objective.side) drawText(ctx, rt.objective.side, 24, 190, "#e7c27a", 2);

  ensureMinimap(rt);
  const mw = 128;
  const mh = 96;
  const mx = rt.viewW - mw - 16;
  const my = rt.input.touch ? 52 : 16;
  panel(ctx, mx - 6, my - 6, mw + 12, mh + 28, "rgba(12,8,10,0.82)", pal.accent);
  if (rt.minimap) ctx.drawImage(rt.minimap, mx, my, mw, mh);
  const dot = (wx: number, wy: number, color: string, s = 3) => {
    const dx = mx + (wx / (rt.world.w * TILE)) * mw;
    const dy = my + (wy / (rt.world.h * TILE)) * mh;
    ctx.fillStyle = color;
    ctx.fillRect(dx - s / 2, dy - s / 2, s, s);
  };
  dot(rt.world.shopX, rt.world.shopY, "#ffd166", 4);
  dot(rt.objective.x, rt.objective.y, "#ffe566", 5);
  dot(rt.world.coreX, rt.world.coreY, rt.world.restored ? pal.glow : "#ffffff", 4);
  dot(p.x, p.y, "#fff", 4);
  ctx.strokeStyle = "#ffe566";
  ctx.beginPath();
  ctx.moveTo(mx + (p.x / (rt.world.w * TILE)) * mw, my + (p.y / (rt.world.h * TILE)) * mh);
  ctx.lineTo(mx + (rt.objective.x / (rt.world.w * TILE)) * mw, my + (rt.objective.y / (rt.world.h * TILE)) * mh);
  ctx.stroke();
  drawText(ctx, rt.world.def.name, mx + mw / 2, my + mh + 8, pal.scarf, 2, "center");

  const order = ["bolt", "whip", "nova", "mote", "lance"] as const;
  const slot = 36;
  const total = order.length * slot;
  const sx = rt.viewW / 2 - total / 2;
  const sy = rt.viewH - 52;
  order.forEach((id, i) => {
    const owned = rt.spells.indexOf(id);
    const hot = owned === p.spell;
    panel(ctx, sx + i * slot, sy, 32, 32, hot ? "#3a241c" : "rgba(12,8,10,0.8)", hot ? pal.glow : "#6b5344");
    drawText(ctx, String(i + 1), sx + i * slot + 16, sy + 6, owned >= 0 ? "#fff6e4" : "#6a5b52", 2, "center");
    if (owned < 0) drawText(ctx, "X", sx + i * slot + 16, sy + 18, "#6a5b52", 1, "center");
  });

  const boss = rt.enemies.find((e) => e.kind === "boss");
  if (boss && rt.bossLock) {
    const bw = Math.min(360, rt.viewW - 40);
    const bx = rt.viewW / 2 - bw / 2;
    drawTextShadow(ctx, boss.name, rt.viewW / 2, 16, boss.accent, 2, "center");
    bar(ctx, bx, 36, bw, 10, boss.hp / boss.maxHp, boss.color, "#1a1214");
  }

  if (rt.nearName) {
    drawTextShadow(ctx, rt.nearName, rt.viewW / 2, rt.viewH - 78, "#fff6e4", 2, "center");
    drawTextShadow(ctx, "E  interact", rt.viewW / 2, rt.viewH - 60, pal.accent, 1, "center");
  }

  if (rt.banner && rt.banner.life > 0) {
    const alpha = Math.min(1, rt.banner.life);
    ctx.globalAlpha = alpha;
    drawTextShadow(ctx, rt.banner.text, rt.viewW / 2, rt.viewH * 0.28, "#fff8ea", 4, "center");
    drawTextShadow(ctx, rt.banner.sub, rt.viewW / 2, rt.viewH * 0.28 + 40, pal.scarf, 2, "center");
    ctx.globalAlpha = 1;
  }
  if (rt.toast && rt.toast.life > 0) {
    drawTextShadow(ctx, rt.toast.text, rt.viewW / 2, rt.viewH - 96, "#fff1c2", 2, "center");
  }

  drawPointer(ctx, rt);

  if (rt.input.touch) {
    for (const b of touchButtons(rt.viewW, rt.viewH)) button(ctx, b, pal.accent);
    if (rt.input.stick.active) {
      ctx.globalAlpha = 0.45;
      ctx.strokeStyle = "#fff";
      ctx.beginPath();
      ctx.arc(rt.input.stick.ox, rt.input.stick.oy, 48, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = pal.glow;
      ctx.beginPath();
      ctx.arc(rt.input.stick.ox + rt.input.stick.dx * 48, rt.input.stick.oy + rt.input.stick.dy * 48, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    drawText(ctx, "move", 24, rt.viewH - 28, "#f0ddc088", 1);
    drawText(ctx, "aim + cast", rt.viewW - 150, rt.viewH - 86, "#f0ddc088", 1);
  }
}

function drawModal(ctx: CanvasRenderingContext2D, rt: Runtime, title: string, lines: string[], rects: Rect[]): void {
  ctx.fillStyle = "rgba(4,2,6,0.55)";
  ctx.fillRect(0, 0, rt.viewW, rt.viewH);
  const w = Math.min(460, rt.viewW - 32);
  const h = Math.min(420, rt.viewH - 32);
  const x = rt.viewW / 2 - w / 2;
  const y = rt.viewH / 2 - h / 2;
  panel(ctx, x, y, w, h, "#160f14", rt.world.def.palette.accent);
  drawText(ctx, title, rt.viewW / 2, y + 16, "#fff6e4", 2, "center");
  let ly = y + 44;
  for (const line of lines) {
    drawText(ctx, line, rt.viewW / 2, ly, "#e6d5c3", 1, "center");
    ly += 14;
  }
  for (const r of rects) button(ctx, r, rt.world.def.palette.glow, false);
}

export function drawFrame(ctx: CanvasRenderingContext2D, rt: Runtime): void {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = rt.mode === "title" ? "#10080c" : rt.world.def.palette.sky;
  ctx.fillRect(0, 0, rt.viewW, rt.viewH);

  if (rt.mode === "title") {
    drawTitle(ctx, rt);
    return;
  }

  drawWorld(ctx, rt);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const vg = ctx.createRadialGradient(rt.viewW / 2, rt.viewH / 2, rt.viewW * 0.25, rt.viewW / 2, rt.viewH / 2, rt.viewW * 0.72);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,0.45)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, rt.viewW, rt.viewH);

  if (rt.mode === "intro") {
    drawIntro(ctx, rt);
    return;
  }
  if (rt.mode !== "dead" && rt.mode !== "victory") drawHud(ctx, rt);
  if (rt.mode === "pause") drawPause(ctx, rt);
  if (rt.mode === "shop") drawShop(ctx, rt);
  if (rt.mode === "play" && rt.panel === "travel") drawTravel(ctx, rt);
  if (rt.mode === "dead") drawDead(ctx, rt);
  if (rt.mode === "victory") drawVictory(ctx, rt);
}

function drawTitle(ctx: CanvasRenderingContext2D, rt: Runtime): void {
  const fake = rt.player;
  fake.x = rt.viewW / 2;
  fake.y = rt.viewH * 0.42;
  fake.trail = [];
  for (let i = 0; i < 18; i++) {
    const a = rt.time * 1.4 - i * 0.28;
    fake.trail.push({
      x: fake.x - 20 - i * 7 + Math.sin(a) * 10,
      y: fake.y + 10 + Math.cos(a * 0.8) * 8 + i * 0.4,
    });
  }
  drawLantern(ctx, fake, DIMENSIONS[0].palette, rt.time, false, false);
  drawTextShadow(ctx, "LUMEN", rt.viewW / 2, rt.viewH * 0.42 + 48, "#fff4d2", 6, "center");
  drawTextShadow(ctx, "a scarf between shattered worlds", rt.viewW / 2, rt.viewH * 0.42 + 100, "#ffb703", 2, "center");
  const rects = titleButtons(rt);
  for (const r of rects) button(ctx, r, "#ffb703");
  const hint = "WASD move   mouse aim   click cast   1-5 spells   E interact";
  if (textWidth(hint, 1) < rt.viewW - 20) {
    drawText(ctx, hint, rt.viewW / 2, rt.viewH - 28, "#cbb59a", 1, "center");
  }
}

export function titleButtons(rt: Runtime): Rect[] {
  const labels = [{ id: "new", label: "Begin" }];
  if (hasContinue()) labels.unshift({ id: "continue", label: "Continue" });
  const width = 220;
  const height = 36;
  const gap = 10;
  let y = Math.min(rt.viewH - 80, rt.viewH * 0.42 + 150);
  const x = rt.viewW / 2 - width / 2;
  return labels.map((item) => {
    const rect = { id: item.id, x, y, w: width, h: height, label: item.label };
    y += height + gap;
    return rect;
  });
}

function hasContinue(): boolean {
  return localStorage.getItem("lumen-save-v1") !== null;
}

function drawIntro(ctx: CanvasRenderingContext2D, rt: Runtime): void {
  ctx.fillStyle = "rgba(6,3,8,0.72)";
  ctx.fillRect(0, 0, rt.viewW, rt.viewH);
  const pages = [
    "The sky cracked like blown glass.",
    "Stars fell upward.",
    "You were a lantern on a gatepost",
    "until the shatter poured a soul",
    "into your flame.",
    "A scarf caught on your hook.",
    "It remembers a wind from before.",
    "Four cores went dark.",
    "Carry the light back.",
  ];
  const chunks = [pages.slice(0, 2), pages.slice(2, 7), pages.slice(7)];
  const lines = chunks[Math.min(rt.introPage, chunks.length - 1)];
  let y = rt.viewH / 2 - lines.length * 16;
  for (const line of lines) {
    drawTextShadow(ctx, line, rt.viewW / 2, y, "#fff6e8", 2, "center");
    y += 28;
  }
  drawText(ctx, "Enter or tap", rt.viewW / 2, y + 24, "#ffb703", 1, "center");
}

function drawPause(ctx: CanvasRenderingContext2D, rt: Runtime): void {
  const rects = stackButtons(rt.viewW, rt.viewH, [
    { id: "resume", label: "Resume" },
    { id: "save", label: "Save" },
    { id: "mute", label: rt.audio.muted ? "Sound off" : "Sound on" },
    { id: "title", label: "Title" },
  ]);
  drawModal(ctx, rt, "Paused", ["The flame waits."], rects);
}

export function pauseButtons(rt: Runtime): Rect[] {
  return stackButtons(rt.viewW, rt.viewH, [
    { id: "resume", label: "Resume" },
    { id: "save", label: "Save" },
    { id: "mute", label: rt.audio.muted ? "Sound off" : "Sound on" },
    { id: "title", label: "Title" },
  ]);
}

function drawShop(ctx: CanvasRenderingContext2D, rt: Runtime): void {
  ctx.fillStyle = "rgba(4,2,6,0.55)";
  ctx.fillRect(0, 0, rt.viewW, rt.viewH);
  const w = Math.min(520, rt.viewW - 24);
  const h = Math.min(460, rt.viewH - 24);
  const x = rt.viewW / 2 - w / 2;
  const y = rt.viewH / 2 - h / 2;
  panel(ctx, x, y, w, h, "#160f14", "#ffd166");
  drawText(ctx, rt.world.def.merchant, x + 16, y + 14, "#fff6e4", 2);
  drawText(ctx, `${rt.gold} G`, x + w - 16, y + 16, "#ffd166", 2, "right");
  SHOP.forEach((offer, i) => {
    const rowY = y + 46 + i * 42;
    const hot = i === rt.shopIndex;
    panel(ctx, x + 12, rowY, w - 24, 38, hot ? "#3a241c" : "#120c10", hot ? "#ffd166" : "#4a3b32");
    const level = rt.upgrades[offer.id] ?? 0;
    const owned = offer.spell ? rt.spells.includes(offer.spell) : level >= offer.maxLevel;
    const cost = owned ? "owned" : `${priceOf(offer, level)} G`;
    drawText(ctx, offer.name, x + 22, rowY + 6, "#fff6e4", 1);
    drawText(ctx, offer.desc, x + 22, rowY + 20, "#cbb59a", 1);
    drawText(ctx, cost, x + w - 24, rowY + 12, owned ? "#88c98a" : "#ffd166", 1, "right");
  });
}

export function shopRowAt(rt: Runtime, px: number, py: number): number {
  const w = Math.min(520, rt.viewW - 24);
  const h = Math.min(460, rt.viewH - 24);
  const x = rt.viewW / 2 - w / 2;
  const y = rt.viewH / 2 - h / 2;
  for (let i = 0; i < SHOP.length; i++) {
    const rowY = y + 46 + i * 42;
    if (px >= x + 12 && px <= x + w - 12 && py >= rowY && py <= rowY + 38) return i;
  }
  return -1;
}

function drawTravel(ctx: CanvasRenderingContext2D, rt: Runtime): void {
  const labels = DIMENSIONS.map((d, i) => ({
    id: `dim-${i}`,
    label: rt.unlocked[i] ? (rt.restored[i] ? `${d.name} lit` : d.name) : `${d.name} shut`,
  }));
  labels.push({ id: "close", label: "Stay" });
  drawModal(ctx, rt, "Rifts", ["Choose a dimension."], stackButtons(rt.viewW, rt.viewH, labels, 260));
}

export function travelButtons(rt: Runtime): Rect[] {
  const labels = DIMENSIONS.map((d, i) => ({
    id: `dim-${i}`,
    label: rt.unlocked[i] ? d.name : `${d.name} shut`,
  }));
  labels.push({ id: "close", label: "Stay" });
  return stackButtons(rt.viewW, rt.viewH, labels, 260);
}

function drawDead(ctx: CanvasRenderingContext2D, rt: Runtime): void {
  const rects = stackButtons(rt.viewW, rt.viewH, [
    { id: "retry", label: "Rekindle" },
    { id: "title", label: "Title" },
  ]);
  drawModal(ctx, rt, "The flame goes out", [rt.deathText || "The dark got in.", "The scarf settles on the ground."], rects);
}

export function deadButtons(rt: Runtime): Rect[] {
  return stackButtons(rt.viewW, rt.viewH, [
    { id: "retry", label: "Rekindle" },
    { id: "title", label: "Title" },
  ]);
}

function drawVictory(ctx: CanvasRenderingContext2D, rt: Runtime): void {
  const rects = stackButtons(rt.viewW, rt.viewH, [
    { id: "wander", label: "Keep wandering" },
    { id: "title", label: "Title" },
  ]);
  drawModal(
    ctx,
    rt,
    "Four cores burn",
    ["The shatter slows.", "Your scarf tugs once toward a mended sky."],
    rects,
  );
}

export function victoryButtons(rt: Runtime): Rect[] {
  return stackButtons(rt.viewW, rt.viewH, [
    { id: "wander", label: "Keep wandering" },
    { id: "title", label: "Title" },
  ]);
}
