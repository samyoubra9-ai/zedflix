import { promises as fs } from "fs";
import path from "path";

export type TelegramContact = {
  id: string;
  name: string;
  username: string;
  lastText: string;
  at: number;
};

type TelegramState = {
  /** Admin chat id currently talking to this user chat id. */
  activeTarget: string | null;
  contacts: TelegramContact[];
};

const MAX_CONTACTS = 40;
const FILE = path.join(process.cwd(), ".data", "telegram-state.json");

const globalStore = globalThis as typeof globalThis & {
  __minuitTelegramState?: TelegramState;
};

function empty(): TelegramState {
  return { activeTarget: null, contacts: [] };
}

function memory() {
  if (!globalStore.__minuitTelegramState) {
    globalStore.__minuitTelegramState = empty();
  }
  return globalStore.__minuitTelegramState;
}

async function load(): Promise<TelegramState> {
  const current = memory();
  try {
    const raw = await fs.readFile(FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<TelegramState>;
    current.activeTarget = typeof parsed.activeTarget === "string" ? parsed.activeTarget : null;
    current.contacts = Array.isArray(parsed.contacts)
      ? parsed.contacts
          .filter((item) => item && typeof item.id === "string")
          .map((item) => ({
            id: String(item.id),
            name: String(item.name || ""),
            username: String(item.username || ""),
            lastText: String(item.lastText || "").slice(0, 200),
            at: Number(item.at) || Date.now(),
          }))
          .slice(0, MAX_CONTACTS)
      : [];
  } catch {
    // first run / no file yet
  }
  return current;
}

async function save(state: TelegramState) {
  globalStore.__minuitTelegramState = state;
  try {
    await fs.mkdir(path.dirname(FILE), { recursive: true });
    await fs.writeFile(FILE, JSON.stringify(state), "utf8");
  } catch {
    // ephemeral hosts may not allow writes — memory still works
  }
}

export async function getTelegramState() {
  return load();
}

export async function setActiveTarget(targetId: string | null) {
  const state = await load();
  state.activeTarget = targetId;
  await save(state);
  return state;
}

export async function rememberContact(contact: Omit<TelegramContact, "at"> & { at?: number }) {
  const state = await load();
  const next: TelegramContact = {
    id: contact.id,
    name: contact.name,
    username: contact.username,
    lastText: contact.lastText.slice(0, 200),
    at: contact.at || Date.now(),
  };
  state.contacts = [next, ...state.contacts.filter((item) => item.id !== next.id)].slice(
    0,
    MAX_CONTACTS,
  );
  await save(state);
  return state;
}

export async function findContact(id: string) {
  const state = await load();
  return state.contacts.find((item) => item.id === id) || null;
}
