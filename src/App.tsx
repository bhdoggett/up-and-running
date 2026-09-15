import { useEffect, useRef, useState } from "react";
import type { AppState, Checklist } from "./types";
import { newId } from "./types";
import { loadState, saveState } from "./storage";
import { importChecklistFromFile } from "./importFile";
import { message } from "@tauri-apps/plugin-dialog";
import Sidebar from "./components/Sidebar/Sidebar";
import ChecklistView from "./components/ChecklistView/ChecklistView";
import styles from "./App.module.css";

const SIDEBAR_WIDTH_KEY = "up-and-running:sidebar-width";
const SIDEBAR_MIN = 190;
const SIDEBAR_MAX = 460;

function clampWidth(n: number): number {
  return Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, n));
}

export default function App() {
  const [state, setState] = useState<AppState | null>(null);
  const saveTimer = useRef<number | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    const saved = Number(localStorage.getItem(SIDEBAR_WIDTH_KEY));
    return saved ? clampWidth(saved) : 260;
  });
  const dragging = useRef(false);

  // Drag the divider to resize the sidebar; the width persists across launches.
  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!dragging.current) return;
      e.preventDefault();
      setSidebarWidth(clampWidth(e.clientX));
    }
    function onUp() {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      setSidebarWidth((w) => {
        localStorage.setItem(SIDEBAR_WIDTH_KEY, String(w));
        return w;
      });
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  function startDrag() {
    dragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }

  // Load persisted state once on startup.
  useEffect(() => {
    loadState().then(setState);
  }, []);

  // Debounced persistence: save 400ms after the last change.
  useEffect(() => {
    if (!state) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      saveState(state).catch((e) => console.error("Save failed", e));
    }, 400);
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [state]);

  if (!state) {
    return <div className={styles.loading}>Loading…</div>;
  }

  const active =
    state.checklists.find((c) => c.id === state.activeChecklistId) ?? null;

  function selectChecklist(id: string) {
    setState((s) => (s ? { ...s, activeChecklistId: id } : s));
  }

  function addChecklist() {
    const checklist: Checklist = {
      id: newId(),
      name: "New checklist",
      resources: [],
      tasks: [],
    };
    setState((s) =>
      s
        ? {
            ...s,
            checklists: [...s.checklists, checklist],
            activeChecklistId: checklist.id,
          }
        : s,
    );
  }

  function renameChecklist(id: string, name: string) {
    setState((s) =>
      s
        ? {
            ...s,
            checklists: s.checklists.map((c) =>
              c.id === id ? { ...c, name } : c,
            ),
          }
        : s,
    );
  }

  function deleteChecklist(id: string) {
    setState((s) => {
      if (!s) return s;
      const remaining = s.checklists.filter((c) => c.id !== id);
      const activeChecklistId =
        s.activeChecklistId === id
          ? (remaining[0]?.id ?? null)
          : s.activeChecklistId;
      return { ...s, checklists: remaining, activeChecklistId };
    });
  }

  async function importChecklist() {
    try {
      const imported = await importChecklistFromFile();
      if (!imported) return;
      setState((s) =>
        s
          ? {
              ...s,
              checklists: [...s.checklists, imported],
              activeChecklistId: imported.id,
            }
          : s,
      );
    } catch (e) {
      console.error("Import failed", e);
      await message(String(e instanceof Error ? e.message : e), {
        title: "Couldn't import that file",
        kind: "error",
      });
    }
  }

  function updateChecklist(updated: Checklist) {
    setState((s) =>
      s
        ? {
            ...s,
            checklists: s.checklists.map((c) =>
              c.id === updated.id ? updated : c,
            ),
          }
        : s,
    );
  }

  return (
    <div className={styles.app}>
      <Sidebar
        checklists={state.checklists}
        activeId={state.activeChecklistId}
        onSelect={selectChecklist}
        onAdd={addChecklist}
        onRename={renameChecklist}
        onDelete={deleteChecklist}
        onImport={importChecklist}
        width={sidebarWidth}
      />
      <div
        className={styles.resizer}
        onMouseDown={startDrag}
        onDoubleClick={() => {
          setSidebarWidth(260);
          localStorage.setItem(SIDEBAR_WIDTH_KEY, "260");
        }}
        role="separator"
        aria-orientation="vertical"
        title="Drag to resize · double-click to reset"
      />
      {active ? (
        <ChecklistView checklist={active} onChange={updateChecklist} />
      ) : (
        <div className={styles.blank}>
          <div>
            <h2>No checklist selected</h2>
            <p>Pick one on the left, or create a new checklist to get started.</p>
          </div>
        </div>
      )}
    </div>
  );
}
