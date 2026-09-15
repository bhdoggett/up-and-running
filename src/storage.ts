import { load, type Store } from "@tauri-apps/plugin-store";
import type { AppState } from "./types";
import { withSections } from "./types";
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
    // Migrate data saved before sections/docs existed, and backfill any missing
    // fields, so older state stays valid.
    const checklists = saved.checklists.map(withSections);
    const docs = Array.isArray(saved.docs) ? saved.docs : [];
    const files = Array.isArray(saved.files) ? saved.files : [];
    const active =
      saved.active ??
      (saved.activeChecklistId
        ? { kind: "checklist" as const, id: saved.activeChecklistId }
        : null);
    return { checklists, docs, files, active };
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
