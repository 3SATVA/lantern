import { damagePlayer, spawnProjectile } from "./combat";
import { irand, mulberry32 } from "./rng";
import { burst, uid, type Runtime } from "./state";
import { TILE, Tile, type Enemy, type EnemyKind } from "./types";
import { moveBody, tileAt } from "./world";

const KINDS: EnemyKind[] = ["basic", "basic", "basic", "tank", "fast", "fast", "ranged"];

function lockOf(rt: Runtime) {
  if (!rt.bossLock) return null;
  const a = rt.world.arena;
  return { x: a.x, y: a.y, w: a.w, h: a.h };
}

export function makeEnemy(rt: Runtime, kind: Enemy["kind"], x: number, y: number): Enemy {
  if (kind === "boss") {
    const b = rt.world.def.boss;
    return {
      id: uid(rt),
      kind,
      name: b.name,
      x,
      y,
      vx: 0,
      vy: 0,
      hp: b.hp,
      maxHp: b.hp,
      damage: 14,
      speed: 46,
      gold: 20,
      radius: 18,
      color: b.color,
      accent: b.accent,
      touchCd: 0,
      attackCd: 1,
      stun: 0,
      anim: Math.random() * 6,
      projSpeed: 150,
      dead: false,
      boss: { pattern: "intro", timer: 1.1, phase: 1, split: false, cast: 0, data: [0, 0, 0, 0, 0, 0] },
    };
  }
  const arch =
    kind === "pod"
      ? { name: "Spore Pod", hp: 16, damage: 12, speed: 70, gold: 1, radius: 7, projSpeed: 0, color: "#c6f05a", accent: "#f4e285" }
      : kind === "clone"
        ? { name: "Echo", hp: 28, damage: 8, speed: 40, gold: 2, radius: 8, projSpeed: 160, color: "#c77dff", accent: "#ffd6ff" }
        : rt.world.def.enemies[kind];
  return {
    id: uid(rt),
    kind,
    name: arch.name,
    x,
    y,
    vx: 0,
    vy: 0,
    hp: arch.hp,
    maxHp: arch.hp,
    damage: arch.damage,
    speed: arch.speed,
    gold: arch.gold,
    radius: arch.radius,
    color: arch.color,
    accent: arch.accent,
    touchCd: 0,
    attackCd: 0.6 + Math.random(),
    stun: 0,
    anim: Math.random() * 10,
    projSpeed: arch.projSpeed,
    dead: false,
  };
}

function occupied(rt: Runtime, x: number, y: number, minDist = 280): boolean {
  if (Math.hypot(rt.player.x - x, rt.player.y - y) < minDist) return true;
  const tx = Math.floor(x / TILE);
  const ty = Math.floor(y / TILE);
  const tile = tileAt(rt.world, tx, ty);
  if (tile === Tile.Wall || tile === Tile.Block || tile === Tile.Door || tile === Tile.Hazard || tile === Tile.Arena) {
    return true;
  }
  const a = rt.world.arena;
  if (x > a.x - 8 && x < a.x + a.w + 8 && y > a.y - 8 && y < a.y + a.h + 8) return true;
  return false;
}

export function trySpawn(rt: Runtime, forced?: EnemyKind): boolean {
  const rng = mulberry32((Math.random() * 1e9) | 0);
  for (let i = 0; i < 12; i++) {
    const ang = rng() * Math.PI * 2;
    const dist = 340 + rng() * 420;
    const x = rt.player.x + Math.cos(ang) * dist;
    const y = rt.player.y + Math.sin(ang) * dist;
    if (x < 32 || y < 32 || x > rt.world.w * TILE - 32 || y > rt.world.h * TILE - 32) continue;
    if (occupied(rt, x, y)) continue;
    const kind = forced ?? KINDS[irand(rng, 0, KINDS.length - 1)];
    rt.enemies.push(makeEnemy(rt, kind, x, y));
    return true;
  }
  return false;
}

export function seedEnemies(rt: Runtime, count: number): void {
  const rng = mulberry32(rt.world.def.seed + 99);
  let made = 0;
  let guard = 0;
  while (made < count && guard < 400) {
    guard++;
    const tx = irand(rng, 3, rt.world.w - 4);
    const ty = irand(rng, 3, rt.world.h - 4);
    const x = tx * TILE + 8;
    const y = ty * TILE + 8;
    if (occupied(rt, x, y, 760)) continue;
    const kind = KINDS[irand(rng, 0, KINDS.length - 1)];
    rt.enemies.push(makeEnemy(rt, kind, x, y));
    made++;
  }
}

function chase(e: Enemy, tx: number, ty: number, speed: number): void {
  const d = Math.hypot(tx - e.x, ty - e.y) || 1;
  e.vx = ((tx - e.x) / d) * speed;
  e.vy = ((ty - e.y) / d) * speed;
}

function shootAt(rt: Runtime, e: Enemy, tx: number, ty: number, speed: number, damage: number, color: string): void {
  const d = Math.hypot(tx - e.x, ty - e.y) || 1;
  spawnProjectile(rt, {
    x: e.x,
    y: e.y,
    vx: ((tx - e.x) / d) * speed,
    vy: ((ty - e.y) / d) * speed,
    radius: 4,
    damage,
    life: 1.8,
    delay: 0,
    friendly: false,
    pierce: 1,
    homing: 0,
    color,
    kind: "enemy",
    slow: 0,
    pull: 0,
  });
}

export function updateEnemies(rt: Runtime, dt: number): void {
  const p = rt.player;
  const lock = lockOf(rt);
  for (const e of rt.enemies) {
    if (e.dead || e.kind === "boss") continue;
    e.anim += dt;
    e.touchCd = Math.max(0, e.touchCd - dt);
    e.attackCd = Math.max(0, e.attackCd - dt);
    if (e.stun > 0) e.stun = Math.max(0, e.stun - dt);
    const dist = Math.hypot(p.x - e.x, p.y - e.y);
    const wander = e.kind !== "pod" && e.kind !== "clone" && dist > 400;
    if (wander) {
      if (Math.hypot(e.vx, e.vy) < 8) {
        const a = e.anim * 1.3 + e.id;
        e.vx = Math.cos(a) * e.speed * 0.35;
        e.vy = Math.sin(a) * e.speed * 0.35;
      }
    } else if (e.stun <= 0) {
      if (e.kind === "basic" || e.kind === "pod") {
        chase(e, p.x, p.y, e.speed);
      } else if (e.kind === "tank") {
        if (e.attackCd <= 0 && dist < 220) {
          chase(e, p.x, p.y, e.speed * 2.6);
          e.attackCd = 2.4;
          e.stun = -0.35;
        } else if (e.stun < 0) {
          e.stun += dt;
          if (e.stun >= 0) e.stun = 0.2;
        } else {
          chase(e, p.x, p.y, e.speed);
        }
      } else if (e.kind === "fast") {
        if (e.attackCd <= 0 && e.stun === 0) {
          chase(e, p.x, p.y, e.speed * 1.85);
          e.attackCd = 1.45;
          e.stun = -0.32;
        } else if (e.stun < 0) {
          e.stun += dt;
          if (e.stun >= 0) e.stun = 0.05;
        } else {
          const side = Math.sin(e.anim * 2) > 0 ? 1 : -1;
          const ang = Math.atan2(p.y - e.y, p.x - e.x) + side * 1.15;
          e.vx = Math.cos(ang) * e.speed;
          e.vy = Math.sin(ang) * e.speed;
        }
      } else if (e.kind === "ranged" || e.kind === "clone") {
        const prefer = e.kind === "clone" ? 150 : 180;
        if (dist < prefer * 0.7) chase(e, e.x - (p.x - e.x), e.y - (p.y - e.y), e.speed);
        else if (dist > prefer) chase(e, p.x, p.y, e.speed);
        else {
          e.vx *= 0.8;
          e.vy *= 0.8;
        }
        if (e.attackCd <= 0 && dist < 340) {
          shootAt(rt, e, p.x, p.y, e.projSpeed || 160, e.damage, e.accent);
          e.attackCd = e.kind === "clone" ? 1.6 : 1.35;
        }
      }
    } else {
      e.vx *= 0.86;
      e.vy *= 0.86;
    }
    if (e.kind === "pod" && dist < e.radius + p.radius + 4) {
      damagePlayer(rt, e.damage, e.name);
      burst(rt, e.x, e.y, e.accent, 12, 80);
      e.dead = true;
      e.hp = 0;
      continue;
    }
    const moved = moveBody(rt.world, e.x, e.y, e.radius, e.vx * dt, e.vy * dt, e.kind === "clone" || e.kind === "pod" ? lock : null);
    e.x = moved.x;
    e.y = moved.y;
    if (dist < e.radius + p.radius && e.touchCd <= 0 && e.kind !== "ranged") {
      damagePlayer(rt, e.damage, e.name);
      e.touchCd = 0.7;
    }
  }
  for (let i = 0; i < rt.enemies.length; i++) {
    for (let j = i + 1; j < rt.enemies.length; j++) {
      const a = rt.enemies[i];
      const b = rt.enemies[j];
      if (a.dead || b.dead) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 0.001;
      const need = a.radius + b.radius;
      if (d < need) {
        const push = (need - d) / 2;
        a.x -= (dx / d) * push;
        a.y -= (dy / d) * push;
        b.x += (dx / d) * push;
        b.y += (dy / d) * push;
      }
    }
  }
  rt.enemies = rt.enemies.filter((e) => !e.dead);
}

export const SPAWN_CAP = 18;
