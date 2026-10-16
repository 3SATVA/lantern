import { SPELLS, statBlock } from "./content";
import { burst, floater, uid, type Runtime } from "./state";
import type { Enemy, Projectile, SpellId } from "./types";
import { blocked, moveBody } from "./world";

export function statsOf(rt: Runtime) {
  return statBlock(rt.upgrades);
}

export function screenToWorld(rt: Runtime, sx: number, sy: number): { x: number; y: number } {
  return { x: rt.camera.x + sx / rt.zoom, y: rt.camera.y + sy / rt.zoom };
}

function lockOf(rt: Runtime) {
  if (!rt.bossLock) return null;
  const a = rt.world.arena;
  return { x: a.x, y: a.y, w: a.w, h: a.h };
}

export function killEnemy(rt: Runtime, e: Enemy): void {
  if (e.dead) return;
  e.dead = true;
  e.hp = 0;
  burst(rt, e.x, e.y, e.accent, e.kind === "boss" ? 24 : 10, 70);
  rt.audio.sfx("hit");
  const coins = e.gold;
  for (let i = 0; i < coins; i++) {
    const a = Math.random() * Math.PI * 2;
    rt.pickups.push({
      id: uid(rt),
      x: e.x,
      y: e.y,
      vx: Math.cos(a) * 40,
      vy: Math.sin(a) * 40,
      value: 1,
      life: 12,
    });
  }
  if (e.kind === "boss") {
    rt.wardens[rt.dim] = true;
    rt.bossLock = false;
    rt.shake = 8;
    rt.audio.sfx("boss");
    floater(rt, e.x, e.y - 20, "WARDEN FALLS", e.accent);
  }
}

export function damageEnemy(rt: Runtime, e: Enemy, amount: number, kx = 0, ky = 0): void {
  if (e.dead) return;
  e.hp -= amount;
  e.stun = Math.max(e.stun, 0.08);
  e.vx += kx;
  e.vy += ky;
  floater(rt, e.x, e.y - e.radius, String(Math.round(amount)), "#fff1c9");
  burst(rt, e.x, e.y, "#fff6d8", 4, 30);
  if (e.hp <= 0) killEnemy(rt, e);
}

export function damagePlayer(rt: Runtime, amount: number, cause: string): void {
  const p = rt.player;
  if (p.hurt > 0 || rt.mode !== "play") return;
  p.hp -= amount;
  p.hurt = 0.7;
  rt.shake = Math.min(9, 2 + amount * 0.25);
  rt.audio.sfx("hurt");
  floater(rt, p.x, p.y - 16, String(Math.round(amount)), "#ff8fa3");
  if (p.hp <= 0) {
    p.hp = 0;
    rt.mode = "dead";
    rt.deathText = cause;
    rt.bossLock = false;
    rt.audio.sfx("die");
  }
}

export function spawnProjectile(rt: Runtime, partial: Omit<Projectile, "id" | "hit"> & { hit?: number[] }): void {
  rt.projectiles.push({ hit: [], ...partial, id: uid(rt) });
  if (rt.projectiles.length > 120) rt.projectiles.splice(0, rt.projectiles.length - 120);
}

function boltDamage(rt: Runtime): number {
  return 11 * statsOf(rt).damage;
}

export function castCurrent(rt: Runtime): void {
  const id = rt.spells[rt.player.spell];
  if (!id) return;
  castSpell(rt, id);
}

export function castSpell(rt: Runtime, id: SpellId): void {
  const def = SPELLS[id];
  const p = rt.player;
  const stats = statsOf(rt);
  if (p.cooldowns[id] > 0) return;
  if (p.mana < def.mana) return;
  p.mana -= def.mana;
  p.cooldowns[id] = def.cooldown / stats.fire;
  const aim = p.aim;
  const range = stats.range;
  rt.audio.sfx(id);
  if (id === "bolt") {
    spawnProjectile(rt, {
      x: p.x + Math.cos(aim) * 12,
      y: p.y + Math.sin(aim) * 12,
      vx: Math.cos(aim) * 290,
      vy: Math.sin(aim) * 290,
      radius: 4,
      damage: boltDamage(rt),
      life: 0.62 * range,
      delay: 0,
      friendly: true,
      pierce: 1,
      homing: 0,
      color: rt.world.def.palette.glow,
      kind: "bolt",
      slow: 0,
      pull: 0,
    });
  } else if (id === "whip") {
    const reach = 48 * range;
    rt.whip = { angle: aim, life: 0.14 };
    for (const e of rt.enemies) {
      if (e.dead) continue;
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      const dist = Math.hypot(dx, dy);
      if (dist > reach + e.radius) continue;
      let d = Math.atan2(dy, dx) - aim;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      if (Math.abs(d) < 0.7) {
        const k = 180 / (dist || 1);
        damageEnemy(rt, e, boltDamage(rt) * 1.25, Math.cos(aim) * k, Math.sin(aim) * k);
      }
    }
  } else if (id === "nova") {
    const count = 12;
    for (let i = 0; i < count; i++) {
      const a = aim + (i / count) * Math.PI * 2;
      spawnProjectile(rt, {
        x: p.x,
        y: p.y,
        vx: Math.cos(a) * 170,
        vy: Math.sin(a) * 170,
        radius: 4,
        damage: boltDamage(rt) * 0.72,
        life: 0.42 * range,
        delay: 0,
        friendly: true,
        pierce: 1,
        homing: 0,
        color: rt.world.def.palette.accent,
        kind: "nova",
        slow: 0,
        pull: 0,
      });
    }
  } else if (id === "mote") {
    spawnProjectile(rt, {
      x: p.x + Math.cos(aim) * 10,
      y: p.y + Math.sin(aim) * 10,
      vx: Math.cos(aim) * 90,
      vy: Math.sin(aim) * 90,
      radius: 5,
      damage: boltDamage(rt) * 1.35,
      life: 1.5 * range,
      delay: 0,
      friendly: true,
      pierce: 1,
      homing: 3.2,
      color: "#fff4c8",
      kind: "mote",
      slow: 0,
      pull: 0,
    });
  } else if (id === "lance") {
    spawnProjectile(rt, {
      x: p.x + Math.cos(aim) * 14,
      y: p.y + Math.sin(aim) * 14,
      vx: Math.cos(aim) * 460,
      vy: Math.sin(aim) * 460,
      radius: 5,
      damage: boltDamage(rt) * 1.5,
      life: 0.38 * range,
      delay: 0,
      friendly: true,
      pierce: 4,
      homing: 0,
      color: "#f8f7ff",
      kind: "lance",
      slow: 0,
      pull: 0,
    });
  }
}

export function updateProjectiles(rt: Runtime, dt: number): void {
  const lock = lockOf(rt);
  for (const pr of rt.projectiles) {
    if (pr.delay > 0) {
      pr.delay -= dt;
      continue;
    }
    pr.life -= dt;
    if (pr.homing > 0 && pr.friendly) {
      let best: Enemy | null = null;
      let bestD = 280;
      for (const e of rt.enemies) {
        if (e.dead) continue;
        const d = Math.hypot(e.x - pr.x, e.y - pr.y);
        if (d < bestD) {
          best = e;
          bestD = d;
        }
      }
      if (best) {
        const desired = Math.atan2(best.y - pr.y, best.x - pr.x);
        const current = Math.atan2(pr.vy, pr.vx);
        let diff = desired - current;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const speed = Math.hypot(pr.vx, pr.vy) || 90;
        const next = current + Math.max(-pr.homing * dt, Math.min(pr.homing * dt, diff));
        pr.vx = Math.cos(next) * speed;
        pr.vy = Math.sin(next) * speed;
      }
    }
    if (pr.kind !== "pool" && pr.kind !== "mine") {
      const step = moveBody(rt.world, pr.x, pr.y, pr.radius * 0.4, pr.vx * dt, pr.vy * dt, pr.friendly ? null : lock);
      if (pr.kind !== "root" && pr.kind !== "tear" && (step.x === pr.x && pr.vx !== 0 || step.y === pr.y && pr.vy !== 0)) {
        if (blocked(rt.world, pr.x + pr.vx * dt, pr.y + pr.vy * dt, 2, null)) pr.life = 0;
      }
      pr.x = step.x;
      pr.y = step.y;
    }
    if (pr.friendly) {
      for (const e of rt.enemies) {
        if (e.dead || pr.hit.includes(e.id)) continue;
        if (Math.hypot(e.x - pr.x, e.y - pr.y) <= e.radius + pr.radius) {
          pr.hit.push(e.id);
          pr.pierce -= 1;
          damageEnemy(rt, e, pr.damage, pr.vx * 0.04, pr.vy * 0.04);
          if (pr.pierce <= 0) pr.life = 0;
        }
      }
    } else if (Math.hypot(rt.player.x - pr.x, rt.player.y - pr.y) <= rt.player.radius + pr.radius) {
      damagePlayer(rt, pr.damage, "a spell from the dark");
      if (pr.slow) rt.player.slow = Math.max(rt.player.slow, pr.slow);
      if (pr.kind !== "pool") pr.life = 0;
    }
  }
  rt.projectiles = rt.projectiles.filter((p) => p.life > 0);
}

export function updatePickups(rt: Runtime, dt: number): void {
  const p = rt.player;
  for (const c of rt.pickups) {
    c.life -= dt;
    const d = Math.hypot(p.x - c.x, p.y - c.y);
    if (d < 72) {
      const m = 220 / (d || 1);
      c.vx += ((p.x - c.x) / (d || 1)) * m * dt * 8;
      c.vy += ((p.y - c.y) / (d || 1)) * m * dt * 8;
    }
    c.vx *= 0.9;
    c.vy *= 0.9;
    c.x += c.vx * dt;
    c.y += c.vy * dt;
    if (d < p.radius + 8) {
      c.life = 0;
      rt.gold += c.value;
      rt.audio.sfx("coin");
    }
  }
  rt.pickups = rt.pickups.filter((c) => c.life > 0);
}

export { lockOf };
