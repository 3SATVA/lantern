import type { SaveData, SpellId } from "./types";

const KEY = "lumen-save-v1";

export function loadSave(): SaveData | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as SaveData;
    if (data.v !== 1 || !Array.isArray(data.spells) || !Array.isArray(data.restored)) return null;
    return data;
  } catch {
    return null;
  }
}

export function writeSave(data: SaveData): void {
  localStorage.setItem(KEY, JSON.stringify(data));
}

export function clearSave(): void {
  localStorage.removeItem(KEY);
}

export function blankProgress(): Pick<
  SaveData,
  "spells" | "upgrades" | "restored" | "unlocked" | "visited" | "gold" | "wardens"
> {
  return {
    gold: 0,
    spells: ["bolt", "whip"] as SpellId[],
    upgrades: {},
    restored: [false, false, false, false],
    unlocked: [true, false, false, false],
    visited: [false, false, false, false],
    wardens: [false, false, false, false],
  };
}
