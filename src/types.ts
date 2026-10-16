export const TILE = 16;
export const MAP_W = 128;
export const MAP_H = 96;

export type SpellId = "bolt" | "whip" | "nova" | "mote" | "lance";
export type EnemyKind = "basic" | "tank" | "fast" | "ranged";
export type Mode =
  | "title"
  | "intro"
  | "play"
  | "pause"
  | "shop"
  | "dead"
  | "victory";

export const enum Tile {
  Floor = 0,
  Wall = 1,
  Hazard = 2,
  Block = 3,
  Path = 4,
  Arena = 5,
  Door = 6,
}

export interface Palette {
  sky: string;
  floor: string;
  floorAlt: string;
  path: string;
  wall: string;
  wallLit: string;
  hazard: string;
  hazardCore: string;
  accent: string;
  scarf: string;
  glow: string;
  arena: string;
}

export interface EnemyArchetype {
  name: string;
  hp: number;
  damage: number;
  speed: number;
  gold: number;
  radius: number;
  projSpeed: number;
  color: string;
  accent: string;
}

export interface DimensionDef {
  id: string;
  name: string;
  epithet: string;
  seed: number;
  story: string;
  palette: Palette;
  hazard: "burn" | "chill" | "poison" | "pull";
  hazardLabel: string;
  enemies: Record<EnemyKind, EnemyArchetype>;
  boss: {
    name: string;
    title: string;
    hp: number;
    color: string;
    accent: string;
  };
  landmarks: string[];
  merchant: string;
  music: number[];
}

export interface SpellDef {
  id: SpellId;
  name: string;
  mana: number;
  cooldown: number;
  desc: string;
}

export interface ShopOffer {
  id: string;
  name: string;
  desc: string;
  basePrice: number;
  maxLevel: number;
  kind: "stat" | "spell";
  stat?: "damage" | "fire" | "hp" | "speed" | "range" | "mana";
  spell?: SpellId;
}

export interface Player {
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  aim: number;
  radius: number;
  hurt: number;
  poison: number;
  slow: number;
  spell: number;
  cooldowns: Record<SpellId, number>;
  trail: { x: number; y: number }[];
  blink: number;
  facingFlip: number;
}

export interface Enemy {
  id: number;
  kind: EnemyKind | "boss" | "pod" | "clone";
  name: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  damage: number;
  speed: number;
  gold: number;
  radius: number;
  color: string;
  accent: string;
  touchCd: number;
  attackCd: number;
  stun: number;
  anim: number;
  projSpeed: number;
  boss?: BossMind;
  dead: boolean;
}

export interface BossMind {
  pattern: string;
  timer: number;
  phase: number;
  split: boolean;
  cast: number;
  data: number[];
}

export interface Projectile {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  life: number;
  delay: number;
  friendly: boolean;
  pierce: number;
  homing: number;
  color: string;
  kind: string;
  hit: number[];
  slow: number;
  pull: number;
}

export interface Pickup {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  value: number;
  life: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
  gravity: number;
}

export interface Floater {
  x: number;
  y: number;
  text: string;
  life: number;
  color: string;
}

export interface Landmark {
  x: number;
  y: number;
  name: string;
  kind: number;
}

export interface HazardSpot {
  x: number;
  y: number;
  r: number;
}

export interface World {
  def: DimensionDef;
  w: number;
  h: number;
  tiles: Uint8Array;
  spawnX: number;
  spawnY: number;
  coreX: number;
  coreY: number;
  shopX: number;
  shopY: number;
  arena: { x: number; y: number; w: number; h: number; doorX: number; doorY: number };
  landmarks: Landmark[];
  hazards: HazardSpot[];
  route: { x: number; y: number }[];
  restored: boolean;
}

export interface SaveData {
  v: 1;
  gold: number;
  hp: number;
  spells: SpellId[];
  upgrades: Record<string, number>;
  dim: number;
  x: number;
  y: number;
  restored: boolean[];
  unlocked: boolean[];
  wardens: boolean[];
  seenIntro: boolean;
  visited: boolean[];
}
