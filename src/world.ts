import { hash2, irand, mulberry32 } from "./rng";
import { DIMENSIONS } from "./content";
import { MAP_H, MAP_W, TILE, Tile, type DimensionDef, type HazardSpot, type Landmark, type World } from "./types";

function idx(x: number, y: number): number {
  return y * MAP_W + x;
}

function inBounds(x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < MAP_W && y < MAP_H;
}

function setDisk(tiles: Uint8Array, cx: number, cy: number, r: number, tile: Tile): void {
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      if (!inBounds(x, y)) continue;
      if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r) tiles[idx(x, y)] = tile;
    }
  }
}

function carveLine(tiles: Uint8Array, x0: number, y0: number, x1: number, y1: number, r: number): void {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let i = 0; i <= steps; i++) {
    const t = steps === 0 ? 0 : i / steps;
    const x = Math.round(x0 + (x1 - x0) * t);
    const y = Math.round(y0 + (y1 - y0) * t);
    setDisk(tiles, x, y, r, Tile.Path);
  }
}

export function tileAt(world: World, tx: number, ty: number): Tile {
  if (!inBounds(tx, ty)) return Tile.Wall;
  return world.tiles[idx(tx, ty)] as Tile;
}

export function isSolid(tile: Tile): boolean {
  return tile === Tile.Wall || tile === Tile.Block || tile === Tile.Door;
}

export function blocked(world: World, x: number, y: number, r: number, lock: { x: number; y: number; w: number; h: number } | null): boolean {
  const minX = Math.floor((x - r) / TILE);
  const maxX = Math.floor((x + r) / TILE);
  const minY = Math.floor((y - r) / TILE);
  const maxY = Math.floor((y + r) / TILE);
  for (let ty = minY; ty <= maxY; ty++) {
    for (let tx = minX; tx <= maxX; tx++) {
      if (isSolid(tileAt(world, tx, ty))) return true;
    }
  }
  if (lock) {
    const pad = r + 2;
    if (x < lock.x + pad || y < lock.y + pad || x > lock.x + lock.w - pad || y > lock.y + lock.h - pad) {
      return true;
    }
  }
  return false;
}

export function moveBody(
  world: World,
  x: number,
  y: number,
  r: number,
  dx: number,
  dy: number,
  lock: { x: number; y: number; w: number; h: number } | null,
): { x: number; y: number } {
  let nx = x + dx;
  if (blocked(world, nx, y, r, lock)) nx = x;
  let ny = y + dy;
  if (blocked(world, nx, ny, r, lock)) ny = y;
  return { x: nx, y: ny };
}

export function hazardUnder(world: World, x: number, y: number): boolean {
  return tileAt(world, Math.floor(x / TILE), Math.floor(y / TILE)) === Tile.Hazard;
}

export function nearestHazard(world: World, x: number, y: number): HazardSpot | null {
  let best: HazardSpot | null = null;
  let bestD = Infinity;
  for (const h of world.hazards) {
    const d = Math.hypot(h.x - x, h.y - y);
    if (d < h.r && d < bestD) {
      best = h;
      bestD = d;
    }
  }
  return best;
}

export function generateWorld(dimIndex: number, restored: boolean): World {
  const def = DIMENSIONS[dimIndex];
  const rng = mulberry32(def.seed);
  const tiles = new Uint8Array(MAP_W * MAP_H);
  tiles.fill(Tile.Floor);

  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      if (x === 0 || y === 0 || x === MAP_W - 1 || y === MAP_H - 1) {
        tiles[idx(x, y)] = Tile.Wall;
        continue;
      }
      const n = hash2(x + def.seed, y);
      const noise = (n % 1000) / 1000;
      if (noise > 0.78) tiles[idx(x, y)] = Tile.Wall;
      else if (noise > 0.74) tiles[idx(x, y)] = Tile.Block;
    }
  }

  for (let pass = 0; pass < 3; pass++) {
    const next = new Uint8Array(tiles);
    for (let y = 1; y < MAP_H - 1; y++) {
      for (let x = 1; x < MAP_W - 1; x++) {
        let walls = 0;
        for (let oy = -1; oy <= 1; oy++) {
          for (let ox = -1; ox <= 1; ox++) {
            if (ox === 0 && oy === 0) continue;
            if (tiles[idx(x + ox, y + oy)] === Tile.Wall) walls++;
          }
        }
        if (tiles[idx(x, y)] === Tile.Wall && walls < 3) next[idx(x, y)] = Tile.Floor;
        else if (tiles[idx(x, y)] === Tile.Floor && walls >= 6) next[idx(x, y)] = Tile.Wall;
      }
    }
    tiles.set(next);
  }

  const spawnTx = 24;
  const spawnTy = MAP_H - 24;
  const arenaW = 26;
  const arenaH = 20;
  const arenaX = MAP_W - arenaW - 4;
  const arenaY = 4;
  const doorX = arenaX + Math.floor(arenaW / 2);
  const doorY = arenaY + arenaH - 1;

  const shopTx = 50;
  const shopTy = 54;
  const coreTxEarly = arenaX + Math.floor(arenaW / 2);
  const coreTyEarly = arenaY + 6;

  const waypoints: [number, number][] = [
    [spawnTx, spawnTy],
    [spawnTx + 16, spawnTy - 4],
    [38, 64],
    [shopTx, shopTy],
    [70, 40],
    [doorX - 6, doorY + 8],
    [doorX, doorY + 2],
    [doorX, doorY],
    [coreTxEarly, coreTyEarly],
  ];
  for (let i = 0; i < waypoints.length - 1; i++) {
    carveLine(tiles, waypoints[i][0], waypoints[i][1], waypoints[i + 1][0], waypoints[i + 1][1], 3);
  }
  setDisk(tiles, spawnTx, spawnTy, 8, Tile.Floor);
  setDisk(tiles, shopTx, shopTy, 4, Tile.Floor);

  for (let y = arenaY; y < arenaY + arenaH; y++) {
    for (let x = arenaX; x < arenaX + arenaW; x++) {
      const edge = x === arenaX || y === arenaY || x === arenaX + arenaW - 1 || y === arenaY + arenaH - 1;
      const door = Math.abs(x - doorX) <= 1 && y === doorY;
      tiles[idx(x, y)] = edge && !door ? Tile.Wall : Tile.Arena;
    }
  }

  const hazards: HazardSpot[] = [];
  let placed = 0;
  let guard = 0;
  while (placed < 18 && guard < 400) {
    guard++;
    const x = irand(rng, 6, MAP_W - 7);
    const y = irand(rng, 6, MAP_H - 7);
    if (tiles[idx(x, y)] !== Tile.Floor) continue;
    let clear = true;
    for (let oy = -2; oy <= 2 && clear; oy++) {
      for (let ox = -2; ox <= 2; ox++) {
        const t = tiles[idx(x + ox, y + oy)];
        if (t === Tile.Path || t === Tile.Wall) {
          clear = false;
          break;
        }
      }
    }
    if (!clear) continue;
    const nearPath = Math.hypot(x - shopTx, y - shopTy) < 8;
    const nearSpawn = Math.hypot(x - spawnTx, y - spawnTy) < 14;
    const nearArena = x > arenaX - 3 && y < arenaY + arenaH + 3;
    if (nearPath || nearSpawn || nearArena) continue;
    const rad = irand(rng, 2, 3);
    setDisk(tiles, x, y, rad, Tile.Hazard);
    hazards.push({ x: x * TILE + TILE / 2, y: y * TILE + TILE / 2, r: rad * TILE + 6 });
    placed++;
  }

  const landmarks: Landmark[] = [];
  for (let i = 0; i < def.landmarks.length; i++) {
    let lx = 0;
    let ly = 0;
    for (let attempt = 0; attempt < 40; attempt++) {
      lx = irand(rng, 10, MAP_W - 12);
      ly = irand(rng, 10, MAP_H - 12);
      const t = tiles[idx(lx, ly)];
      if (t === Tile.Floor) break;
    }
    landmarks.push({ x: lx * TILE + TILE / 2, y: ly * TILE + TILE / 2, name: def.landmarks[i], kind: i % 4 });
    if (tiles[idx(lx, ly)] !== Tile.Hazard) tiles[idx(lx, ly)] = Tile.Block;
  }

  const coreTx = arenaX + Math.floor(arenaW / 2);
  const coreTy = arenaY + 6;
  tiles[idx(coreTx, coreTy)] = Tile.Arena;

  return {
    def,
    w: MAP_W,
    h: MAP_H,
    tiles,
    spawnX: spawnTx * TILE + TILE / 2,
    spawnY: spawnTy * TILE + TILE / 2,
    coreX: coreTx * TILE + TILE / 2,
    coreY: coreTy * TILE + TILE / 2,
    shopX: shopTx * TILE + TILE / 2,
    shopY: shopTy * TILE + TILE / 2,
    arena: {
      x: arenaX * TILE,
      y: arenaY * TILE,
      w: arenaW * TILE,
      h: arenaH * TILE,
      doorX: doorX * TILE + TILE / 2,
      doorY: doorY * TILE + TILE,
    },
    landmarks,
    hazards,
    route: waypoints.map(([x, y]) => ({ x: x * TILE + TILE / 2, y: y * TILE + TILE / 2 })),
    restored,
  };
}

export function dimensionCount(): number {
  return DIMENSIONS.length;
}

export function defAt(i: number): DimensionDef {
  return DIMENSIONS[i];
}
