import { load, type Store } from "@tauri-apps/plugin-store";
import type { AppState } from "./types";
import { seedState } from "./seed";

// Persist the whole app state as a single JSON blob in the app's data dir.
// The file lives at <appDataDir>/up-and-running.json, managed by plugin-store.
const STORE_FILE = "up-and-running.json";
const STATE_KEY = "state";

let storePromise: Promise<Store> | null = null;

function getStore(): Promise<Store> {
  if (!storePromise) {
    storePromise = load(STORE_FILE, { autoSave: false });
  }
  return storePromise;
}

export async function loadState(): Promise<AppState> {
  const store = await getStore();
  const saved = await store.get<AppState>(STATE_KEY);
  if (saved && Array.isArray(saved.checklists)) {
    return saved;
  }
  // First run: seed with an example and persist it.
  const initial = seedState();
  await saveState(initial);
  return initial;
}

export async function saveState(state: AppState): Promise<void> {
  const store = await getStore();
  await store.set(STATE_KEY, state);
  await store.save();
}
