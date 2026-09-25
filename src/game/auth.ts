import { GUNS, MISSIONS } from "./data";
import {
  createDefaultSave,
  loadSave,
  profileStorageKey,
  resetSave,
  writeSave,
  type SaveData,
} from "./save";

export interface AuthSession {
  email: string;
  admin: boolean;
  displayName: string;
}

export type AuthMode = "signin" | "signup";

export type AuthResult =
  | { ok: true; session: AuthSession }
  | { ok: false; error: string };

interface LocalAccount {
  passwordHash: string;
  createdAt: number;
}

const ACCOUNTS_KEY = "duskline-local-accounts-v1";
const SESSION_KEY = "duskline-local-session-v1";
const LEGACY_MIGRATION_KEY = "duskline-legacy-profile-migrated-v1";

// This client-only admin account is a convenience for a local game prototype,
// not secure production authentication. A real deployment needs a server.
const ADMIN_EMAIL = "atiwari73874@gmail.com";
const ADMIN_PASSWORD = "black@123";

function readAccounts(): Record<string, LocalAccount> {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, LocalAccount>) : {};
  } catch {
    return {};
  }
}

function writeAccounts(accounts: Record<string, LocalAccount>) {
  try {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch {
    // The game can still be played for this tab if browser storage is disabled.
  }
}

async function hashPassword(password: string) {
  const bytes = new TextEncoder().encode(password);
  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest), (n) => n.toString(16).padStart(2, "0")).join("");
  }

  // Fallback for non-secure local previews. SHA-256 is used when WebCrypto exists.
  let a = 0x811c9dc5;
  for (const byte of bytes) {
    a ^= byte;
    a = Math.imul(a, 0x01000193);
  }
  return `local-${(a >>> 0).toString(16).padStart(8, "0")}`;
}

function makeSession(email: string, admin: boolean): AuthSession {
  const name = email.split("@")[0] || "Operative";
  return { email, admin, displayName: admin ? "COMMANDER" : name.toUpperCase() };
}

export function readSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { email?: string };
    if (!parsed.email) return null;
    const email = parsed.email.trim().toLowerCase();
    return makeSession(email, email === ADMIN_EMAIL);
  } catch {
    return null;
  }
}

function writeSession(session: AuthSession) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ email: session.email }));
  } catch {
    // Authentication lasts for the current React session when storage is blocked.
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // Ignore unavailable storage.
  }
}

export async function authenticate(emailInput: string, password: string, mode: AuthMode): Promise<AuthResult> {
  const email = emailInput.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Enter a valid email address." };
  }
  if (password.length < 6) return { ok: false, error: "Password must be at least 6 characters." };

  if (email === ADMIN_EMAIL) {
    if (mode === "signup") return { ok: false, error: "This reserved account can only sign in." };
    if (password !== ADMIN_PASSWORD) return { ok: false, error: "Email or password is incorrect." };
    const session = makeSession(email, true);
    writeSession(session);
    return { ok: true, session };
  }

  const accounts = readAccounts();
  const existing = accounts[email];
  if (mode === "signup") {
    if (existing) return { ok: false, error: "An account with this email already exists." };
    accounts[email] = { passwordHash: await hashPassword(password), createdAt: Date.now() };
    writeAccounts(accounts);
  } else {
    if (!existing || existing.passwordHash !== (await hashPassword(password))) {
      return { ok: false, error: "Email or password is incorrect." };
    }
  }

  const session = makeSession(email, false);
  writeSession(session);
  return { ok: true, session };
}

function adminSave(save: SaveData): SaveData {
  const ownedGuns = GUNS.map((gun) => gun.id);
  return {
    ...save,
    coins: Number.MAX_SAFE_INTEGER,
    ownedGuns,
    equipped: ownedGuns.includes(save.equipped) ? save.equipped : "warden",
    items: { medkit: 999, adrenaline: 999, thermal: 999, ammo: 999 },
    upgrades: { armor: 3, steady: 3, reload: 3, lungs: 3, bounty: 3 },
    unlocked: MISSIONS.length - 1,
  };
}

export function loadAccountSave(session: AuthSession): SaveData {
  const key = profileStorageKey(session.email);
  let hasProfile = false;
  try {
    hasProfile = localStorage.getItem(key) !== null;
  } catch {
    // Continue with in-memory defaults.
  }

  if (!hasProfile && !session.admin) {
    // Preserve a pre-login campaign on the first account created in this browser.
    try {
      if (localStorage.getItem(LEGACY_MIGRATION_KEY) !== "1") {
        const previous = loadSave();
        writeSave(previous, key);
        localStorage.setItem(LEGACY_MIGRATION_KEY, "1");
      }
    } catch {
      // Continue with defaults if localStorage is unavailable.
    }
  }

  const profile = hasProfile || !session.admin ? loadSave(key) : createDefaultSave();
  return session.admin ? adminSave(profile) : profile;
}

export function persistAccountSave(data: SaveData, session: AuthSession) {
  writeSave(session.admin ? adminSave(data) : data, profileStorageKey(session.email));
}

export function resetAccountSave(session: AuthSession) {
  const clean = resetSave(profileStorageKey(session.email));
  return session.admin ? adminSave(clean) : clean;
}