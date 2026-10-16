import { damagePlayer, spawnProjectile } from "./combat";
import { makeEnemy } from "./enemies";
import { burst, type Runtime } from "./state";
import type { Enemy } from "./types";
import { moveBody } from "./world";

function arenaLock(rt: Runtime) {
  const a = rt.world.arena;
  return { x: a.x, y: a.y, w: a.w, h: a.h };
}

function insideArena(rt: Runtime, x: number, y: number, pad = 36): { x: number; y: number } {
  const a = rt.world.arena;
  return {
    x: Math.max(a.x + pad, Math.min(a.x + a.w - pad, x)),
    y: Math.max(a.y + pad, Math.min(a.y + a.h - pad, y)),
  };
}

function begin(b: Enemy, pattern: string, time: number): void {
  const mind = b.boss!;
  mind.pattern = pattern;
  mind.timer = time;
  mind.cast = 0;
}

function hold(b: Enemy, tx: number, ty: number, speed: number, dt: number, rt: Runtime): void {
  const d = Math.hypot(tx - b.x, ty - b.y) || 1;
  const moved = moveBody(rt.world, b.x, b.y, b.radius, ((tx - b.x) / d) * speed * dt, ((ty - b.y) / d) * speed * dt, arenaLock(rt));
  b.x = moved.x;
  b.y = moved.y;
}

function volley(
  rt: Runtime,
  x: number,
  y: number,
  count: number,
  speed: number,
  damage: number,
  color: string,
  spin: number,
  life = 1.5,
): void {
  for (let i = 0; i < count; i++) {
    const a = spin + (i / count) * Math.PI * 2;
    spawnProjectile(rt, {
      x,
      y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      radius: 5,
      damage,
      life,
      delay: 0,
      friendly: false,
      pierce: 1,
      homing: 0,
      color,
      kind: "ring",
      slow: 0,
      pull: 0,
    });
  }
}

function updatePyre(rt: Runtime, b: Enemy, dt: number): void {
  const mind = b.boss!;
  const p = rt.player;
  mind.phase = b.hp < b.maxHp * 0.5 ? 2 : 1;
  if (mind.pattern === "intro") {
    mind.timer -= dt;
    if (mind.timer <= 0) begin(b, "chase", 1.5);
    return;
  }
  mind.timer -= dt;
  if (mind.pattern === "chase") {
    hold(b, p.x, p.y, b.speed, dt, rt);
    if (mind.timer <= 0) begin(b, "slam", 1.2);
  } else if (mind.pattern === "slam") {
    b.vx = 0;
    if (mind.cast === 0 && mind.timer <= 0.45) {
      volley(rt, b.x, b.y, 14, 110, 7, b.accent, rt.time);
      burst(rt, b.x, b.y, b.color, 16, 90);
      rt.shake = 6;
      mind.cast = 1;
    }
    if (mind.timer <= 0) begin(b, mind.phase === 2 ? "dash" : "spokes", mind.phase === 2 ? 0.8 : 1.55);
  } else if (mind.pattern === "spokes") {
    mind.data[2] -= dt;
    if (mind.data[2] <= 0) {
      mind.data[3] += 0.35;
      volley(rt, b.x, b.y, 8, 120, 6, b.color, mind.data[3], 1.3);
      mind.data[2] = 0.38;
      mind.cast += 1;
    }
    if (mind.timer <= 0 || mind.cast >= 4) begin(b, mind.phase === 2 ? "chase" : "chase", 1.35);
  } else if (mind.pattern === "dash") {
    if (mind.cast === 0) {
      const d = Math.hypot(p.x - b.x, p.y - b.y) || 1;
      mind.data[4] = (p.x - b.x) / d;
      mind.data[5] = (p.y - b.y) / d;
      mind.cast = 1;
      mind.data[2] = 0;
    }
    const moved = moveBody(rt.world, b.x, b.y, b.radius, mind.data[4] * 240 * dt, mind.data[5] * 240 * dt, arenaLock(rt));
    b.x = moved.x;
    b.y = moved.y;
    mind.data[2] -= dt;
    if (mind.data[2] <= 0) {
      spawnProjectile(rt, {
        x: b.x,
        y: b.y,
        vx: 0,
        vy: 0,
        radius: 12,
        damage: 7,
        life: 1.6,
        delay: 0,
        friendly: false,
        pierce: 1,
        homing: 0,
        color: "#ff6b2c",
        kind: "pool",
        slow: 0,
        pull: 0,
      });
      mind.data[2] = 0.07;
    }
    if (mind.timer <= 0) begin(b, "spokes", 1.45);
  }
}

function updateRime(rt: Runtime, b: Enemy, dt: number): void {
  const mind = b.boss!;
  const p = rt.player;
  const a = rt.world.arena;
  if (mind.pattern === "intro") {
    mind.timer -= dt;
    if (mind.timer <= 0) begin(b, "wall", 0.9);
    return;
  }
  mind.timer -= dt;
  hold(b, a.x + a.w * 0.5, a.y + a.h * 0.45, b.speed * 0.45, dt, rt);
  if (mind.pattern === "wall") {
    if (mind.cast === 0) {
      const horizontal = mind.data[1] % 2 === 0;
      mind.data[1] += 1;
      if (horizontal) {
        const y = Math.random() < 0.5 ? p.y : a.y + 50 + Math.random() * (a.h - 100);
        const dir = Math.random() < 0.5 ? 1 : -1;
        const start = dir > 0 ? a.x + 20 : a.x + a.w - 20;
        for (let i = 0; i < 5; i++) {
          spawnProjectile(rt, {
            x: start,
            y: y + (i - 2) * 16,
            vx: dir * 78,
            vy: 0,
            radius: 8,
            damage: 9,
            life: 4,
            delay: 0.25,
            friendly: false,
            pierce: 1,
            homing: 0,
            color: "#e7f8ff",
            kind: "wall",
            slow: 0.4,
            pull: 0,
          });
        }
      } else {
        const x = p.x;
        const dir = Math.random() < 0.5 ? 1 : -1;
        const start = dir > 0 ? a.y + 20 : a.y + a.h - 20;
        for (let i = 0; i < 5; i++) {
          spawnProjectile(rt, {
            x: x + (i - 2) * 16,
            y: start,
            vx: 0,
            vy: dir * 78,
            radius: 8,
            damage: 9,
            life: 4,
            delay: 0.25,
            friendly: false,
            pierce: 1,
            homing: 0,
            color: "#e7f8ff",
            kind: "wall",
            slow: 0.4,
            pull: 0,
          });
        }
      }
      mind.cast = 1;
    }
    if (mind.timer <= 0) begin(b, "mines", 1.45);
  } else if (mind.pattern === "mines") {
    if (mind.cast === 0) {
      for (let i = 0; i < 6; i++) {
        const spot = insideArena(rt, p.x + (Math.random() - 0.5) * 160, p.y + (Math.random() - 0.5) * 120, 40);
        spawnProjectile(rt, {
          x: spot.x,
          y: spot.y,
          vx: 0,
          vy: 0,
          radius: 16,
          damage: 10,
          life: 0.55,
          delay: 0.7,
          friendly: false,
          pierce: 1,
          homing: 0,
          color: "#bde0fe",
          kind: "mine",
          slow: 0.8,
          pull: 0,
        });
      }
      mind.cast = 1;
    }
    if (mind.timer <= 0) begin(b, "cone", 1.25);
  } else if (mind.pattern === "cone") {
    if (mind.cast === 0) {
      mind.data[4] = Math.atan2(p.y - b.y, p.x - b.x);
      mind.cast = 1;
    }
    const ang = Math.atan2(p.y - b.y, p.x - b.x);
    let diff = ang - mind.data[4];
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const dist = Math.hypot(p.x - b.x, p.y - b.y);
    if (dist < 210 && Math.abs(diff) < 0.4) {
      damagePlayer(rt, 7, "Rimecrown");
      p.slow = Math.max(p.slow, 0.45);
    }
    if (mind.timer <= 0) begin(b, "wall", 0.9);
  }
}

function updateBloom(rt: Runtime, b: Enemy, dt: number): void {
  const mind = b.boss!;
  const p = rt.player;
  mind.phase = b.hp < b.maxHp * 0.55 ? 2 : 1;
  if (mind.phase === 2 && !mind.split) {
    mind.split = true;
    rt.enemies.push(makeEnemy(rt, "pod", b.x - 30, b.y));
    rt.enemies.push(makeEnemy(rt, "pod", b.x + 30, b.y));
    burst(rt, b.x, b.y, "#d8f3dc", 14, 60);
  }
  if (mind.pattern === "intro") {
    mind.timer -= dt;
    if (mind.timer <= 0) begin(b, "roots", 1.15);
    return;
  }
  mind.timer -= dt;
  if (mind.pattern !== "pull") hold(b, p.x, p.y, b.speed * 0.55, dt, rt);
  if (mind.pattern === "roots") {
    if (mind.cast === 0) {
      for (let line = 0; line < 3; line++) {
        const ang = Math.atan2(p.y - b.y, p.x - b.x) + (line - 1) * 0.28;
        for (let i = 1; i <= 7; i++) {
          const spot = insideArena(rt, b.x + Math.cos(ang) * i * 28, b.y + Math.sin(ang) * i * 28, 28);
          spawnProjectile(rt, {
            x: spot.x,
            y: spot.y,
            vx: 0,
            vy: 0,
            radius: 9,
            damage: 9,
            life: 0.32,
            delay: 0.28 + i * 0.07,
            friendly: false,
            pierce: 1,
            homing: 0,
            color: "#95d5b2",
            kind: "root",
            slow: 0,
            pull: 0,
          });
        }
      }
      mind.cast = 1;
    }
    if (mind.timer <= 0) begin(b, "spit", 1.2);
  } else if (mind.pattern === "spit") {
    if (mind.cast === 0) {
      for (let i = 0; i < 4; i++) {
        const spot = insideArena(rt, p.x + (Math.random() - 0.5) * 90, p.y + (Math.random() - 0.5) * 90, 30);
        spawnProjectile(rt, {
          x: spot.x,
          y: spot.y,
          vx: 0,
          vy: 0,
          radius: 14,
          damage: 6,
          life: 2.4,
          delay: 0.45,
          friendly: false,
          pierce: 1,
          homing: 0,
          color: "#b5179e",
          kind: "pool",
          slow: 0,
          pull: 0,
        });
      }
      mind.cast = 1;
    }
    if (mind.timer <= 0) begin(b, "pull", 1.15);
  } else if (mind.pattern === "pull") {
    if (mind.cast === 0 && mind.timer < 0.7) {
      const d = Math.hypot(p.x - b.x, p.y - b.y);
      if (d < 230 && d > 8) {
        p.x += ((b.x - p.x) / d) * 220 * dt;
        p.y += ((b.y - p.y) / d) * 220 * dt;
        if (d < b.radius + p.radius + 6) damagePlayer(rt, 12, "Bloomrot");
      }
    }
    if (mind.timer <= 0) begin(b, "roots", 1.05);
  }
}

function updateUnmade(rt: Runtime, b: Enemy, dt: number): void {
  const mind = b.boss!;
  const p = rt.player;
  const a = rt.world.arena;
  mind.phase = b.hp < b.maxHp * 0.5 ? 2 : 1;
  if (mind.phase === 2 && !mind.split) {
    mind.split = true;
    const left = insideArena(rt, b.x - 40, b.y, 40);
    const right = insideArena(rt, b.x + 40, b.y, 40);
    rt.enemies.push(makeEnemy(rt, "clone", left.x, left.y));
    rt.enemies.push(makeEnemy(rt, "clone", right.x, right.y));
  }
  if (mind.pattern === "intro") {
    mind.timer -= dt;
    if (mind.timer <= 0) begin(b, "blink", 0.85);
    return;
  }
  mind.timer -= dt;
  if (mind.pattern === "blink") {
    if (mind.cast === 0) {
      volley(rt, b.x, b.y, 10, 120, 8, b.accent, rt.time, 1.2);
      const spot = insideArena(
        rt,
        a.x + 50 + Math.random() * (a.w - 100),
        a.y + 50 + Math.random() * (a.h - 100),
        40,
      );
      burst(rt, b.x, b.y, b.color, 10, 40);
      b.x = spot.x;
      b.y = spot.y;
      burst(rt, b.x, b.y, b.accent, 10, 40);
      mind.cast = 1;
    }
    if (mind.timer <= 0) begin(b, "singularity", 1.7);
  } else if (mind.pattern === "singularity") {
    const d = Math.hypot(p.x - b.x, p.y - b.y) || 1;
    p.x += ((b.x - p.x) / d) * 78 * dt;
    p.y += ((b.y - p.y) / d) * 78 * dt;
    mind.data[2] -= dt;
    if (mind.data[2] <= 0) {
      const ang = mind.data[3];
      mind.data[3] += 0.55;
      spawnProjectile(rt, {
        x: b.x,
        y: b.y,
        vx: Math.cos(ang) * 100,
        vy: Math.sin(ang) * 100,
        radius: 5,
        damage: 8,
        life: 1.6,
        delay: 0,
        friendly: false,
        pierce: 1,
        homing: 0,
        color: b.accent,
        kind: "ring",
        slow: 0,
        pull: 0,
      });
      spawnProjectile(rt, {
        x: b.x,
        y: b.y,
        vx: Math.cos(ang + Math.PI) * 100,
        vy: Math.sin(ang + Math.PI) * 100,
        radius: 5,
        damage: 8,
        life: 1.6,
        delay: 0,
        friendly: false,
        pierce: 1,
        homing: 0,
        color: b.color,
        kind: "ring",
        slow: 0,
        pull: 0,
      });
      mind.data[2] = 0.16;
    }
    if (mind.timer <= 0) begin(b, "tears", 1.7);
  } else if (mind.pattern === "tears") {
    if (mind.cast === 0) {
      const y = p.y;
      const x = p.x;
      for (let px = a.x + 24; px < a.x + a.w - 24; px += 22) {
        spawnProjectile(rt, {
          x: px,
          y,
          vx: 0,
          vy: 0,
          radius: 8,
          damage: 10,
          life: 0.28,
          delay: 0.55,
          friendly: false,
          pierce: 1,
          homing: 0,
          color: "#ff4dcc",
          kind: "tear",
          slow: 0,
          pull: 0,
        });
      }
      for (let py = a.y + 24; py < a.y + a.h - 24; py += 22) {
        spawnProjectile(rt, {
          x,
          y: py,
          vx: 0,
          vy: 0,
          radius: 8,
          damage: 10,
          life: 0.28,
          delay: 1.15,
          friendly: false,
          pierce: 1,
          homing: 0,
          color: "#e0aaff",
          kind: "tear",
          slow: 0,
          pull: 0,
        });
      }
      mind.cast = 1;
    }
    if (mind.timer <= 0) begin(b, "blink", 0.7);
  }
}

export function spawnBoss(rt: Runtime): void {
  const a = rt.world.arena;
  const boss = makeEnemy(rt, "boss", a.x + a.w / 2, a.y + a.h * 0.62);
  rt.enemies.push(boss);
  rt.audio.sfx("boss");
  rt.banner = { text: boss.name, sub: rt.world.def.boss.title, life: 2.4 };
}

export function updateBosses(rt: Runtime, dt: number): void {
  for (const e of rt.enemies) {
    if (e.kind !== "boss" || e.dead || !e.boss) continue;
    e.anim += dt;
    e.touchCd = Math.max(0, e.touchCd - dt);
    const dist = Math.hypot(rt.player.x - e.x, rt.player.y - e.y);
    if (dist < e.radius + rt.player.radius && e.touchCd <= 0) {
      damagePlayer(rt, e.damage, e.name);
      e.touchCd = 0.85;
    }
    if (rt.dim === 0) updatePyre(rt, e, dt);
    else if (rt.dim === 1) updateRime(rt, e, dt);
    else if (rt.dim === 2) updateBloom(rt, e, dt);
    else updateUnmade(rt, e, dt);
    const spot = insideArena(rt, e.x, e.y, e.radius + 8);
    e.x = spot.x;
    e.y = spot.y;
  }
}
