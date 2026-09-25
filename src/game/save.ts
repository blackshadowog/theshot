import type { ItemDef, UpgradeDef } from "./data";

export interface Settings {
  music: number;
  sfx: number;
  sensitivity: number;
  quality: "low" | "high";
  killcam: boolean;
  invertY: boolean;
}

export interface SaveData {
  coins: number;
  ownedGuns: string[];
  equipped: string;
  items: Record<ItemDef["id"], number>;
  upgrades: Record<UpgradeDef["id"], number>;
  unlocked: number;
  stars: Record<string, number>;
  best: Record<string, number>;
  stats: {
    kills: number;
    headshots: number;
    shots: number;
    hits: number;
    longest: number;
    missions: number;
    earned: number;
    civilians: number;
  };
  settings: Settings;
}

const KEY = "duskline-save-v2";
const PROFILE_PREFIX = "duskline-profile-v1:";

export const DEFAULT_SAVE: SaveData = {
  coins: 500,
  ownedGuns: ["warden"],
  equipped: "warden",
  items: { medkit: 2, adrenaline: 1, thermal: 1, ammo: 1 },
  upgrades: { armor: 0, steady: 0, reload: 0, lungs: 0, bounty: 0 },
  unlocked: 0,
  stars: {},
  best: {},
  stats: { kills: 0, headshots: 0, shots: 0, hits: 0, longest: 0, missions: 0, earned: 0, civilians: 0 },
  settings: { music: 0.6, sfx: 0.8, sensitivity: 1, quality: "high", killcam: true, invertY: false },
};

export function profileStorageKey(email: string) {
  return `${PROFILE_PREFIX}${encodeURIComponent(email.trim().toLowerCase())}`;
}

export function createDefaultSave(): SaveData {
  return structuredClone(DEFAULT_SAVE);
}

export function loadSave(storageKey = KEY): SaveData {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return structuredClone(DEFAULT_SAVE);
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    return {
      ...structuredClone(DEFAULT_SAVE),
      ...parsed,
      items: { ...DEFAULT_SAVE.items, ...(parsed.items ?? {}) },
      upgrades: { ...DEFAULT_SAVE.upgrades, ...(parsed.upgrades ?? {}) },
      stats: { ...DEFAULT_SAVE.stats, ...(parsed.stats ?? {}) },
      settings: { ...DEFAULT_SAVE.settings, ...(parsed.settings ?? {}) },
    };
  } catch {
    return structuredClone(DEFAULT_SAVE);
  }
}

export function writeSave(data: SaveData, storageKey = KEY) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(data));
  } catch {
    // storage may be unavailable (private mode); progress stays in memory
  }
}

export function resetSave(storageKey = KEY): SaveData {
  try {
    localStorage.removeItem(storageKey);
  } catch {
    // ignore
  }
  return structuredClone(DEFAULT_SAVE);
}
