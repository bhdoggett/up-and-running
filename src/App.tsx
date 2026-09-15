import { useEffect, useRef, useState } from "react";
import type { AppState, Checklist, Doc, ItemKind, Resource, Selection } from "./types";
import { newId } from "./types";
import { loadState, saveState } from "./storage";
import { importChecklistFromFile, type ImportedItem } from "./importFile";
import { openLink } from "./appLinks";
import { message, open as openDialog } from "@tauri-apps/plugin-dialog";
import Sidebar from "./components/Sidebar/Sidebar";
import AiImportDialog from "./components/AiImportDialog/AiImportDialog";
import ChecklistView from "./components/ChecklistView/ChecklistView";
import DocView from "./components/DocView/DocView";
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
  const [aiImportOpen, setAiImportOpen] = useState(false);

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

  const activeChecklist =
    state.active?.kind === "checklist"
      ? (state.checklists.find((c) => c.id === state.active!.id) ?? null)
      : null;
  const activeDoc =
    state.active?.kind === "doc"
      ? (state.docs.find((d) => d.id === state.active!.id) ?? null)
      : null;

  function select(sel: Selection) {
    setState((s) => (s ? { ...s, active: sel } : s));
  }

  function addChecklist() {
    const checklist: Checklist = {
      id: newId(),
      name: "New checklist",
      resources: [],
      sections: [{ id: newId(), name: "", collapsed: false, tasks: [] }],
    };
    setState((s) =>
      s
        ? {
            ...s,
            checklists: [...s.checklists, checklist],
            active: { kind: "checklist", id: checklist.id },
          }
        : s,
    );
  }

  function addDoc() {
    const doc: Doc = { id: newId(), name: "New doc", body: "", resources: [] };
    setState((s) =>
      s
        ? { ...s, docs: [...s.docs, doc], active: { kind: "doc", id: doc.id } }
        : s,
    );
  }

  function rename(kind: ItemKind, id: string, name: string) {
    setState((s) => {
      if (!s) return s;
      if (kind === "checklist") {
        return {
          ...s,
          checklists: s.checklists.map((c) => (c.id === id ? { ...c, name } : c)),
        };
      }
      return { ...s, docs: s.docs.map((d) => (d.id === id ? { ...d, name } : d)) };
    });
  }

  // After deleting, fall back to another item of the same kind, then anything.
  function remove(kind: ItemKind, id: string) {
    setState((s) => {
      if (!s) return s;
      const checklists =
        kind === "checklist" ? s.checklists.filter((c) => c.id !== id) : s.checklists;
      const docs = kind === "doc" ? s.docs.filter((d) => d.id !== id) : s.docs;
      let active = s.active;
      if (active?.kind === kind && active.id === id) {
        const sameKind = kind === "checklist" ? checklists[0]?.id : docs[0]?.id;
        active = sameKind
          ? { kind, id: sameKind }
          : checklists[0]
            ? { kind: "checklist", id: checklists[0].id }
            : docs[0]
              ? { kind: "doc", id: docs[0].id }
              : null;
      }
      return { ...s, checklists, docs, active };
    });
  }

  function addImported(imported: Checklist) {
    setState((s) =>
      s
        ? {
            ...s,
            checklists: [...s.checklists, imported],
            active: { kind: "checklist", id: imported.id },
          }
        : s,
    );
  }

  async function addFile() {
    const selected = await openDialog({
      title: "Add a file to the library",
      multiple: true,
    });
    const paths = Array.isArray(selected)
      ? selected
      : typeof selected === "string"
        ? [selected]
        : [];
    if (paths.length === 0) return;
    const added: Resource[] = paths.map((p) => ({
      id: newId(),
      label: p.split(/[\\/]/).pop() || p,
      kind: "file",
      target: p,
    }));
    setState((s) => (s ? { ...s, files: [...s.files, ...added] } : s));
  }

  function removeFile(id: string) {
    setState((s) => (s ? { ...s, files: s.files.filter((f) => f.id !== id) } : s));
  }

  function updateDoc(updated: Doc) {
    setState((s) =>
      s
        ? { ...s, docs: s.docs.map((d) => (d.id === updated.id ? updated : d)) }
        : s,
    );
  }

  function addImportedItem(item: ImportedItem) {
    if (item.kind === "doc") {
      const doc = item.doc;
      setState((s) =>
        s ? { ...s, docs: [...s.docs, doc], active: { kind: "doc", id: doc.id } } : s,
      );
      return;
    }
    addImported(item.checklist);
  }

  async function importChecklist() {
    try {
      const imported = await importChecklistFromFile();
      if (!imported) return;
      addImportedItem(imported);
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
        docs={state.docs}
        active={state.active}
        onSelect={select}
        onAddChecklist={addChecklist}
        onAddDoc={addDoc}
        files={state.files}
        onAddFile={addFile}
        onRemoveFile={removeFile}
        onOpenFile={openLink}
        onRename={rename}
        onDelete={remove}
        onImport={importChecklist}
        onAiImport={() => setAiImportOpen(true)}
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
      {activeChecklist ? (
        <ChecklistView checklist={activeChecklist} onChange={updateChecklist} />
      ) : activeDoc ? (
        <DocView doc={activeDoc} onChange={updateDoc} />
      ) : (
        <div className={styles.blank}>
          <div>
            <h2>Nothing selected</h2>
            <p>Pick a checklist or doc on the left, or create a new one.</p>
          </div>
        </div>
      )}

      {aiImportOpen && (
        <AiImportDialog
          onClose={() => setAiImportOpen(false)}
          onImported={(item) => {
            addImportedItem(item);
            setAiImportOpen(false);
          }}
        />
      )}
    </div>
  );
}
