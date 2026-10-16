import { AudioBus } from "./audio";
import { statBlock } from "./content";
import type { Input } from "./input";
import { blankProgress } from "./save";
import type {
  Enemy,
  Floater,
  Mode,
  Particle,
  Pickup,
  Player,
  Projectile,
  SpellId,
  World,
} from "./types";
import { generateWorld } from "./world";

export interface Runtime {
  mode: Mode;
  dim: number;
  world: World;
  player: Player;
  enemies: Enemy[];
  projectiles: Projectile[];
  pickups: Pickup[];
  particles: Particle[];
  floaters: Floater[];
  camera: { x: number; y: number };
  time: number;
  shake: number;
  bossLock: boolean;
  gold: number;
  spells: SpellId[];
  upgrades: Record<string, number>;
  restored: boolean[];
  unlocked: boolean[];
  wardens: boolean[];
  visited: boolean[];
  seenIntro: boolean;
  introPage: number;
  whip: { angle: number; life: number } | null;
  banner: { text: string; sub: string; life: number } | null;
  toast: { text: string; life: number } | null;
  shopIndex: number;
  travelIndex: number;
  panel: "none" | "travel";
  deathText: string;
  uidN: number;
  spawnTimer: number;
  saveTimer: number;
  nearName: string;
  hazardCd: number;
  met: boolean[];
  objective: { x: number; y: number; title: string; detail: string; side: string };
  minimap: HTMLCanvasElement | null;
  input: Input;
  audio: AudioBus;
  viewW: number;
  viewH: number;
  zoom: number;
}

export function makePlayer(x: number, y: number, upgrades: Record<string, number>, hp?: number): Player {
  const stats = statBlock(upgrades);
  return {
    x,
    y,
    vx: 0,
    vy: 0,
    hp: hp ?? stats.maxHp,
    maxHp: stats.maxHp,
    mana: stats.maxMana,
    maxMana: stats.maxMana,
    aim: 0,
    radius: 8,
    hurt: 0,
    poison: 0,
    slow: 0,
    spell: 0,
    cooldowns: { bolt: 0, whip: 0, nova: 0, mote: 0, lance: 0 },
    trail: [],
    blink: 0,
    facingFlip: 1,
  };
}

export function uid(rt: Runtime): number {
  rt.uidN += 1;
  return rt.uidN;
}

export function toast(rt: Runtime, text: string): void {
  rt.toast = { text, life: 2.2 };
}

export function burst(rt: Runtime, x: number, y: number, color: string, n = 8, speed = 40): void {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.random();
    const s = speed * (0.4 + Math.random());
    rt.particles.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: 0.35 + Math.random() * 0.3,
      max: 0.6,
      color,
      size: 2 + (i % 2),
      gravity: 0,
    });
  }
  if (rt.particles.length > 280) rt.particles.splice(0, rt.particles.length - 280);
}

export function floater(rt: Runtime, x: number, y: number, text: string, color: string): void {
  rt.floaters.push({ x, y, text, life: 0.7, color });
  if (rt.floaters.length > 40) rt.floaters.shift();
}

export function enterDimension(rt: Runtime, index: number, x?: number, y?: number, heal = false): void {
  rt.dim = index;
  rt.world = generateWorld(index, rt.restored[index]);
  rt.enemies = [];
  rt.projectiles = [];
  rt.pickups = [];
  rt.bossLock = false;
  rt.panel = "none";
  rt.visited[index] = true;
  const px = x ?? rt.world.spawnX;
  const py = y ?? rt.world.spawnY;
  const prevHp = rt.player?.hp;
  rt.player = makePlayer(px, py, rt.upgrades, heal ? undefined : prevHp);
  rt.player.hp = Math.max(1, Math.min(rt.player.hp, rt.player.maxHp));
  rt.banner = { text: rt.world.def.name, sub: rt.world.def.epithet, life: 2.8 };
  rt.minimap = null;
  rt.camera.x = px - rt.viewW / (2 * rt.zoom);
  rt.camera.y = py - rt.viewH / (2 * rt.zoom);
}

export function freshRuntime(input: Input, audio: AudioBus): Runtime {
  const blank = blankProgress();
  const rt: Runtime = {
    mode: "title",
    dim: 0,
    world: generateWorld(0, false),
    player: makePlayer(0, 0, {}),
    enemies: [],
    projectiles: [],
    pickups: [],
    particles: [],
    floaters: [],
    camera: { x: 0, y: 0 },
    time: 0,
    shake: 0,
    bossLock: false,
    gold: blank.gold,
    spells: blank.spells,
    upgrades: blank.upgrades,
    restored: blank.restored,
    unlocked: blank.unlocked,
    wardens: blank.wardens,
    visited: blank.visited,
    seenIntro: false,
    introPage: 0,
    whip: null,
    banner: null,
    toast: null,
    shopIndex: 0,
    travelIndex: 0,
    panel: "none",
    deathText: "",
    uidN: 1,
    spawnTimer: 0.2,
    saveTimer: 8,
    nearName: "",
    hazardCd: 0,
    met: [false, false, false, false],
    objective: { x: 0, y: 0, title: "", detail: "", side: "" },
    minimap: null,
    input,
    audio,
    viewW: 800,
    viewH: 600,
    zoom: 2,
  };
  rt.player = makePlayer(rt.world.spawnX, rt.world.spawnY, {});
  return rt;
}
