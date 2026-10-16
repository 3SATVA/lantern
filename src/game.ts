import { DIMENSIONS, SHOP, SPELLS, priceOf, statBlock } from "./content";
import { castCurrent, damagePlayer, screenToWorld, statsOf, updatePickups, updateProjectiles } from "./combat";
import { SPAWN_CAP, seedEnemies, trySpawn, updateEnemies } from "./enemies";
import { spawnBoss, updateBosses } from "./bosses";
import { beginFrame, endFrame, type Input } from "./input";
import { AudioBus } from "./audio";
import { deadButtons, drawFrame, pauseButtons, shopRowAt, titleButtons, travelButtons, victoryButtons } from "./render";
import { blankProgress, loadSave, writeSave } from "./save";
import { burst, enterDimension, freshRuntime, toast, type Runtime } from "./state";
import type { SaveData, SpellId } from "./types";
import { hit, touchButtons } from "./ui";
import { hazardUnder, moveBody, nearestHazard } from "./world";

const ORDER: SpellId[] = ["bolt", "whip", "nova", "mote", "lance"];

function snapshot(rt: Runtime): SaveData {
  return {
    v: 1,
    gold: rt.gold,
    hp: rt.player.hp,
    spells: rt.spells,
    upgrades: rt.upgrades,
    dim: rt.dim,
    x: rt.player.x,
    y: rt.player.y,
    restored: rt.restored,
    unlocked: rt.unlocked,
    wardens: rt.wardens,
    seenIntro: true,
    visited: rt.visited,
  };
}

function persist(rt: Runtime): void {
  writeSave(snapshot(rt));
  rt.seenIntro = true;
}

function applyLoaded(rt: Runtime, data: SaveData): void {
  const blank = blankProgress();
  rt.gold = data.gold ?? 0;
  rt.spells = data.spells?.length ? data.spells : blank.spells;
  rt.upgrades = data.upgrades ?? {};
  rt.restored = data.restored?.length === 4 ? data.restored : blank.restored;
  rt.unlocked = data.unlocked?.length === 4 ? data.unlocked : blank.unlocked;
  rt.wardens = data.wardens?.length === 4 ? data.wardens : rt.restored.map((lit) => lit);
  rt.visited = data.visited?.length === 4 ? data.visited : blank.visited;
  rt.seenIntro = true;
  enterDimension(rt, data.dim ?? 0, data.x, data.y, false);
  rt.player.hp = Math.max(1, Math.min(data.hp ?? rt.player.maxHp, rt.player.maxHp));
  rt.player.mana = rt.player.maxMana;
  seedEnemies(rt, 12);
  rt.mode = "play";
}

function newGame(rt: Runtime): void {
  const blank = blankProgress();
  rt.gold = blank.gold;
  rt.spells = [...blank.spells];
  rt.upgrades = {};
  rt.restored = [...blank.restored];
  rt.unlocked = [...blank.unlocked];
  rt.wardens = [...blank.wardens];
  rt.visited = [...blank.visited];
  rt.met = [false, false, false, false];
  rt.seenIntro = false;
  rt.introPage = 0;
  enterDimension(rt, 0, undefined, undefined, true);
  seedEnemies(rt, 12);
  rt.mode = "intro";
}

function refreshObjective(rt: Runtime): void {
  const w = rt.world;
  const boss = rt.enemies.find((e) => e.kind === "boss");
  if (rt.bossLock && boss) {
    rt.objective = { x: boss.x, y: boss.y, title: `Defeat ${boss.name}`, detail: "The arena is sealed", side: "", tag: "BOSS" };
    return;
  }
  if (rt.wardens[rt.dim] && !rt.restored[rt.dim]) {
    rt.objective = { x: w.coreX, y: w.coreY, title: "Restore the core", detail: "Press E beside the core", side: "", tag: "CORE" };
    return;
  }
  if (!rt.restored[rt.dim]) {
    const paces = Math.max(0, Math.round(Math.hypot(w.coreX - rt.player.x, w.coreY - rt.player.y) / 16));
    rt.objective = {
      x: w.coreX,
      y: w.coreY,
      title: "Find the core",
      detail: `${paces} paces`,
      side: rt.met[rt.dim] ? "" : "Merchant on the road",
      tag: "CORE",
    };
    return;
  }
  if (rt.restored.every(Boolean)) {
    rt.objective = { x: w.coreX, y: w.coreY, title: "Every core burns", detail: "Wander, or rest", side: "", tag: "CORE" };
    return;
  }
  const next = rt.restored.findIndex((lit) => !lit);
  const name = next >= 0 ? DIMENSIONS[next].name : "home";
  rt.objective = { x: w.coreX, y: w.coreY, title: `Rift toward ${name}`, detail: "Press E at the core", side: "", tag: "RIFT" };
}

function tryInteract(rt: Runtime): void {
  const p = rt.player;
  const w = rt.world;
  if (Math.hypot(p.x - w.shopX, p.y - w.shopY) < 42) {
    rt.met[rt.dim] = true;
    rt.shopIndex = 0;
    rt.mode = "shop";
    rt.audio.sfx("ui");
    return;
  }
  if (Math.hypot(p.x - w.coreX, p.y - w.coreY) < 42) {
    if (!rt.wardens[rt.dim] && !rt.restored[rt.dim]) {
      toast(rt, "The warden still dreams inside the arena.");
      return;
    }
    if (rt.wardens[rt.dim] && !rt.restored[rt.dim]) {
      rt.restored[rt.dim] = true;
      rt.world.restored = true;
      rt.audio.sfx("core");
      rt.player.hp = rt.player.maxHp;
      rt.player.mana = rt.player.maxMana;
      burst(rt, w.coreX, w.coreY, w.def.palette.glow, 30, 90);
      rt.shake = 5;
      if (rt.dim < 3) {
        rt.unlocked[rt.dim + 1] = true;
        toast(rt, `${DIMENSIONS[rt.dim + 1].name} rift is open`);
      }
      persist(rt);
      if (rt.restored.every(Boolean)) rt.mode = "victory";
      return;
    }
    rt.panel = "travel";
    rt.audio.sfx("ui");
    return;
  }
  if (Math.hypot(p.x - w.spawnX, p.y - w.spawnY) < 48) {
    rt.panel = "travel";
    rt.audio.sfx("ui");
  }
}

function buy(rt: Runtime): void {
  const offer = SHOP[rt.shopIndex];
  if (!offer) return;
  const level = rt.upgrades[offer.id] ?? 0;
  if (offer.spell && rt.spells.includes(offer.spell)) {
    rt.audio.sfx("deny");
    return;
  }
  if (level >= offer.maxLevel) {
    rt.audio.sfx("deny");
    return;
  }
  const cost = priceOf(offer, level);
  if (rt.gold < cost) {
    toast(rt, "Not enough coin");
    rt.audio.sfx("deny");
    return;
  }
  rt.gold -= cost;
  if (offer.kind === "spell" && offer.spell) {
    rt.spells.push(offer.spell);
    rt.upgrades[offer.id] = 1;
  } else {
    rt.upgrades[offer.id] = level + 1;
  }
  const stats = statBlock(rt.upgrades);
  const hpGain = stats.maxHp - rt.player.maxHp;
  rt.player.maxHp = stats.maxHp;
  rt.player.hp = Math.min(stats.maxHp, rt.player.hp + Math.max(0, hpGain));
  const manaGain = stats.maxMana - rt.player.maxMana;
  rt.player.maxMana = stats.maxMana;
  rt.player.mana = Math.min(stats.maxMana, rt.player.mana + Math.max(0, manaGain));
  rt.audio.sfx("buy");
  toast(rt, offer.name);
  persist(rt);
}

function updatePlay(rt: Runtime, dt: number): void {
  const input = rt.input;
  const p = rt.player;
  if (input.wheel) p.spell = (p.spell + input.wheel + rt.spells.length) % rt.spells.length;
  if (input.spellSlot >= 0) {
    const id = ORDER[input.spellSlot];
    const idx = id ? rt.spells.indexOf(id) : -1;
    if (idx >= 0) p.spell = idx;
  }
  const buttons = rt.input.touch ? touchButtons(rt.viewW, rt.viewH) : [];
  const overButton = buttons.some((b) => input.aimX >= b.x && input.aimY >= b.y && input.aimX < b.x + b.w && input.aimY < b.y + b.h);
  if (input.uiClick && rt.input.touch) {
    const hitBtn = hit(buttons, input.uiClick.x, input.uiClick.y);
    if (hitBtn?.id === "pause") rt.mode = "pause";
    if (hitBtn?.id === "use") tryInteract(rt);
    if (hitBtn?.id === "spell") p.spell = (p.spell + 1) % rt.spells.length;
  }
  const aim = screenToWorld(rt, input.aimX, input.aimY);
  if (!rt.input.touch || !overButton) p.aim = Math.atan2(aim.y - p.y, aim.x - p.x);

  const slow = p.slow > 0 ? 0.62 : 1;
  const speed = statsOf(rt).speed * slow;
  const a = rt.world.arena;
  const lock = rt.bossLock ? { x: a.x, y: a.y, w: a.w, h: a.h } : null;
  const moved = moveBody(rt.world, p.x, p.y, p.radius, input.ax * speed * dt, input.ay * speed * dt, lock);
  p.x = moved.x;
  p.y = moved.y;
  p.trail.unshift({ x: p.x - input.ax * 8, y: p.y + 8 - input.ay * 4 });
  if (p.trail.length > 14) p.trail.pop();

  for (const key of ORDER) p.cooldowns[key] = Math.max(0, p.cooldowns[key] - dt);
  p.mana = Math.min(p.maxMana, p.mana + 16 * dt);
  p.hurt = Math.max(0, p.hurt - dt);
  rt.guard = Math.max(0, rt.guard - dt);
  p.slow = Math.max(0, p.slow - dt);
  if (p.poison > 0) {
    p.poison -= dt;
    p.hp -= 4 * dt;
    if (p.hp <= 0) {
      p.hp = 0;
      rt.mode = "dead";
      rt.deathText = "spore-rot";
      rt.bossLock = false;
    }
  }
  if (rt.whip) {
    rt.whip.life -= dt;
    if (rt.whip.life <= 0) rt.whip = null;
  }
  const casting = (input.pointerDown && !overButton) || input.keys.has(" ");
  if (casting && rt.mode === "play") {
    const id = rt.spells[p.spell];
    if (p.cooldowns[id] <= 0 && p.mana < SPELLS[id].mana) {
      if (input.castPressed) rt.audio.sfx("deny");
    } else castCurrent(rt);
  }
  if (input.interact) tryInteract(rt);
  if (input.keys.has("m") && input.justPressed.has("m")) rt.audio.setMuted(!rt.audio.muted);

  if (!rt.bossLock && !rt.wardens[rt.dim] && !rt.restored[rt.dim]) {
    const inset = 28;
    if (p.x > a.x + inset && p.x < a.x + a.w - inset && p.y > a.y + inset && p.y < a.y + a.h - inset) {
      rt.bossLock = true;
      spawnBoss(rt);
    }
  }
  if (rt.bossLock) {
    const m = p.radius + 6;
    p.x = Math.max(a.x + m, Math.min(a.x + a.w - m, p.x));
    p.y = Math.max(a.y + m, Math.min(a.y + a.h - m, p.y));
  }

  rt.hazardCd -= dt;
  if (hazardUnder(rt.world, p.x, p.y) && rt.hazardCd <= 0) {
    rt.hazardCd = 0.45;
    const kind = rt.world.def.hazard;
    if (kind === "burn") damagePlayer(rt, 6, rt.world.def.hazardLabel);
    else if (kind === "chill") {
      damagePlayer(rt, 4, rt.world.def.hazardLabel);
      p.slow = Math.max(p.slow, 0.7);
    } else if (kind === "poison") {
      p.poison = 2.4;
      damagePlayer(rt, 4, rt.world.def.hazardLabel);
    } else damagePlayer(rt, 5, rt.world.def.hazardLabel);
  }
  const well = nearestHazard(rt.world, p.x, p.y);
  if (well && rt.world.def.hazard === "pull") {
    const d = Math.hypot(well.x - p.x, well.y - p.y) || 1;
    const pull = moveBody(rt.world, p.x, p.y, p.radius, ((well.x - p.x) / d) * 50 * dt, ((well.y - p.y) / d) * 50 * dt, lock);
    p.x = pull.x;
    p.y = pull.y;
  }

  if (!rt.bossLock) {
    rt.spawnTimer -= dt;
    const alive = rt.enemies.length;
    const nearby = rt.enemies.filter((e) => Math.hypot(e.x - p.x, e.y - p.y) < 760).length;
    if (alive < SPAWN_CAP && nearby < 10 && rt.spawnTimer <= 0) {
      if (trySpawn(rt)) rt.spawnTimer = 1.1;
      else rt.spawnTimer = 0.35;
    }
  }

  updateBosses(rt, dt);
  updateEnemies(rt, dt);
  updateProjectiles(rt, dt);
  rt.enemies = rt.enemies.filter((e) => !e.dead);
  updatePickups(rt, dt);

  for (const particle of rt.particles) {
    particle.life -= dt;
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vy += particle.gravity * dt;
  }
  rt.particles = rt.particles.filter((particle) => particle.life > 0);
  if (rt.particles.length < 70 && Math.random() < 0.6) {
    const rise = rt.dim === 0 ? -18 : rt.dim === 1 ? 22 : rt.dim === 2 ? -8 : 0;
    rt.particles.push({
      x: rt.camera.x + Math.random() * (rt.viewW / rt.zoom),
      y: rt.camera.y + Math.random() * (rt.viewH / rt.zoom),
      vx: (Math.random() - 0.5) * 8,
      vy: rise + (Math.random() - 0.5) * 6,
      life: 1.4,
      max: 1.4,
      color: rt.world.def.palette.accent,
      size: 2,
      gravity: rt.dim === 1 ? 8 : -2,
    });
  }
  for (const f of rt.floaters) {
    f.life -= dt;
    f.y -= 18 * dt;
  }
  rt.floaters = rt.floaters.filter((f) => f.life > 0);

  const viewW = rt.viewW / rt.zoom;
  const viewH = rt.viewH / rt.zoom;
  const destX = p.x - viewW / 2;
  const destY = p.y - viewH / 2;
  rt.camera.x += (destX - rt.camera.x) * Math.min(1, dt * 6);
  rt.camera.y += (destY - rt.camera.y) * Math.min(1, dt * 6);
  rt.camera.x = Math.max(0, Math.min(rt.world.w * 16 - viewW, rt.camera.x));
  rt.camera.y = Math.max(0, Math.min(rt.world.h * 16 - viewH, rt.camera.y));
  rt.shake = Math.max(0, rt.shake - dt * 10);

  rt.nearName = "";
  if (Math.hypot(p.x - wShop(rt), p.y - rt.world.shopY) < 48) rt.nearName = rt.world.def.merchant;
  else if (Math.hypot(p.x - rt.world.coreX, p.y - rt.world.coreY) < 48) rt.nearName = rt.world.restored ? "Open rift" : "Shattered core";
  else if (Math.hypot(p.x - rt.world.spawnX, p.y - rt.world.spawnY) < 48) rt.nearName = "Waygate";
  else {
    for (const mark of rt.world.landmarks) {
      if (Math.hypot(p.x - mark.x, p.y - mark.y) < 56) {
        rt.nearName = mark.name;
        break;
      }
    }
  }
  refreshObjective(rt);
  if (rt.banner) {
    rt.banner.life -= dt;
    if (rt.banner.life <= 0) rt.banner = null;
  }
  if (rt.toast) {
    rt.toast.life -= dt;
    if (rt.toast.life <= 0) rt.toast = null;
  }
  rt.saveTimer -= dt;
  if (rt.saveTimer <= 0 && rt.mode === "play") {
    rt.saveTimer = 12;
    persist(rt);
  }
}

function wShop(rt: Runtime): number {
  return rt.world.shopX;
}

function updateTravel(rt: Runtime): void {
  const click = rt.input.uiClick;
  if (!click) return;
  const rect = hit(travelButtons(rt), click.x, click.y);
  if (!rect) return;
  if (rect.id === "close") {
    rt.panel = "none";
    return;
  }
  const index = Number(rect.id.replace("dim-", ""));
  if (!rt.unlocked[index]) {
    toast(rt, "That rift is still shut");
    rt.audio.sfx("deny");
    return;
  }
  if (index === rt.dim) {
    rt.panel = "none";
    return;
  }
  enterDimension(rt, index, undefined, undefined, false);
  seedEnemies(rt, 12);
  rt.panel = "none";
  persist(rt);
}

export function createGame(input: Input, audio: AudioBus) {
  const rt = freshRuntime(input, audio);
  const saved = loadSave();
  if (saved) rt.seenIntro = true;

  const update = (dt: number) => {
    beginFrame(input);
    rt.time += dt;
    if (input.justPressed.size > 0 || input.uiClick || input.pointerDown) audio.unlock();
    const click = input.uiClick;

    if (input.pause) {
      if (rt.panel === "travel") rt.panel = "none";
      else if (rt.mode === "shop") rt.mode = "play";
      else if (rt.mode === "pause") rt.mode = "play";
      else if (rt.mode === "play") rt.mode = "pause";
      else if (rt.mode === "dead" || rt.mode === "victory") rt.mode = "title";
    }

    if (rt.mode === "title") {
      if (click) {
        const rect = hit(titleButtons(rt), click.x, click.y);
        if (rect?.id === "new") newGame(rt);
        if (rect?.id === "continue") {
          const data = loadSave();
          if (data) applyLoaded(rt, data);
        }
      }
      if (input.justPressed.has("c")) {
        const data = loadSave();
        if (data) applyLoaded(rt, data);
      } else if (input.interact || input.justPressed.has(" ")) {
        newGame(rt);
      }
    } else if (rt.mode === "intro") {
      if (input.interact || click || input.justPressed.has(" ")) {
        rt.introPage += 1;
        rt.audio.sfx("ui");
        if (rt.introPage >= 3) {
          rt.mode = "play";
          rt.seenIntro = true;
          persist(rt);
        }
      }
    } else if (rt.mode === "pause") {
      if (input.interact) rt.mode = "play";
      if (click) {
        const rect = hit(pauseButtons(rt), click.x, click.y);
        if (rect?.id === "resume") rt.mode = "play";
        if (rect?.id === "save") {
          persist(rt);
          toast(rt, "Saved");
          rt.mode = "play";
        }
        if (rect?.id === "mute") rt.audio.setMuted(!rt.audio.muted);
        if (rect?.id === "title") {
          persist(rt);
          rt.mode = "title";
        }
      }
    } else if (rt.mode === "shop") {
      if (input.justPressed.has("arrowup") || input.justPressed.has("w")) rt.shopIndex = Math.max(0, rt.shopIndex - 1);
      if (input.justPressed.has("arrowdown") || input.justPressed.has("s")) rt.shopIndex = Math.min(SHOP.length - 1, rt.shopIndex + 1);
      if (click) {
        const row = shopRowAt(rt, click.x, click.y);
        if (row >= 0) {
          if (row === rt.shopIndex) buy(rt);
          else rt.shopIndex = row;
        }
      }
      if (input.interact) buy(rt);
    } else if (rt.mode === "dead") {
      if (click) {
        const rect = hit(deadButtons(rt), click.x, click.y);
        if (rect?.id === "retry") {
          enterDimension(rt, rt.dim, undefined, undefined, true);
          seedEnemies(rt, 12);
          rt.mode = "play";
        }
        if (rect?.id === "title") rt.mode = "title";
      }
      if (input.interact) {
        enterDimension(rt, rt.dim, undefined, undefined, true);
        seedEnemies(rt, 12);
        rt.mode = "play";
      }
    } else if (rt.mode === "victory") {
      if (click) {
        const rect = hit(victoryButtons(rt), click.x, click.y);
        if (rect?.id === "wander") rt.mode = "play";
        if (rect?.id === "title") rt.mode = "title";
      }
    } else if (rt.panel === "travel") {
      updateTravel(rt);
    } else {
      updatePlay(rt, dt);
    }

    const vibe = rt.mode === "title" || rt.mode === "intro" ? "title" : rt.bossLock ? "boss" : "explore";
    audio.update(dt, rt.world.def.music, vibe);
    endFrame(input);
  };

  return {
    update,
    draw(ctx: CanvasRenderingContext2D) {
      drawFrame(ctx, rt);
    },
    resize(w: number, h: number) {
      rt.viewW = w;
      rt.viewH = h;
      rt.zoom = w < 760 ? 1 : 2;
    },
  };
}

export type { Runtime };
