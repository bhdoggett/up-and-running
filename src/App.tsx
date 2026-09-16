import { useEffect, useRef, useState } from "react";
import type {
  AppState,
  Checklist,
  Doc,
  ItemKind,
  Project,
  Resource,
  Selection,
} from "./types";
import { newId, allFiles } from "./types";
import { loadState, saveState } from "./storage";
import { importItemFromFile, type ImportedItem } from "./importFile";
import { openLink } from "./appLinks";
import { exportProjectToUar } from "./exportHtml";
import { LibraryProvider } from "./library";
import { message, open as openDialog, confirm } from "@tauri-apps/plugin-dialog";
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
  const [aiImportKind, setAiImportKind] = useState<ItemKind | null>(null);

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

  const project =
    state.projects.find((p) => p.id === state.activeProjectId) ?? state.projects[0];

  const activeChecklist =
    state.active?.kind === "checklist"
      ? (project?.checklists.find((c) => c.id === state.active!.id) ?? null)
      : null;
  const activeDoc =
    state.active?.kind === "doc"
      ? (project?.docs.find((d) => d.id === state.active!.id) ?? null)
      : null;

  /** Apply a change to the active project, leaving the rest of state alone. */
  function patchProject(fn: (p: Project) => Project, active?: Selection | null) {
    setState((s) => {
      if (!s) return s;
      return {
        ...s,
        projects: s.projects.map((p) => (p.id === project?.id ? fn(p) : p)),
        active: active === undefined ? s.active : active,
      };
    });
  }

  function select(sel: Selection) {
    setState((s) => (s ? { ...s, active: sel } : s));
  }

  // --- projects ---------------------------------------------------------
  function selectProject(id: string) {
    setState((s) => {
      if (!s) return s;
      const next = s.projects.find((p) => p.id === id);
      // Land on something sensible in the project being opened.
      const active: Selection | null = next?.checklists[0]
        ? { kind: "checklist", id: next.checklists[0].id }
        : next?.docs[0]
          ? { kind: "doc", id: next.docs[0].id }
          : null;
      return { ...s, activeProjectId: id, active };
    });
  }

  function addProject() {
    const p: Project = { id: newId(), name: "New project", checklists: [], docs: [], files: [] };
    setState((s) =>
      s ? { ...s, projects: [...s.projects, p], activeProjectId: p.id, active: null } : s,
    );
  }

  function renameProject(id: string, name: string) {
    setState((s) =>
      s
        ? {
            ...s,
            projects: s.projects.map((p) => (p.id === id ? { ...p, name } : p)),
          }
        : s,
    );
  }

  async function deleteProject(id: string) {
    const target = state!.projects.find((p) => p.id === id);
    if (!target) return;
    const count =
      target.checklists.length + target.docs.length + target.files.length;
    if (count > 0) {
      const ok = await confirm(
        `“${target.name}” holds ${count} item${count === 1 ? "" : "s"}. Delete the project and everything in it?`,
        { title: "Delete project", kind: "warning", okLabel: "Delete", cancelLabel: "Cancel" },
      );
      if (!ok) return;
    }
    setState((s) => {
      if (!s) return s;
      const projects = s.projects.filter((p) => p.id !== id);
      // Always keep at least one project so the app has somewhere to put things.
      const remaining = projects.length
        ? projects
        : [{ id: newId(), name: "My library", checklists: [], docs: [], files: [] }];
      return {
        ...s,
        projects: remaining,
        activeProjectId:
          s.activeProjectId === id ? remaining[0].id : s.activeProjectId,
        active: s.activeProjectId === id ? null : s.active,
      };
    });
  }

  // --- items ------------------------------------------------------------
  function addChecklist() {
    const checklist: Checklist = {
      id: newId(),
      name: "New checklist",
      description: "",
      resources: [],
      sections: [{ id: newId(), name: "", collapsed: false, tasks: [] }],
    };
    patchProject((p) => ({ ...p, checklists: [...p.checklists, checklist] }), {
      kind: "checklist",
      id: checklist.id,
    });
  }

  function addDoc() {
    const doc: Doc = { id: newId(), name: "New doc", body: "", resources: [] };
    patchProject((p) => ({ ...p, docs: [...p.docs, doc] }), {
      kind: "doc",
      id: doc.id,
    });
  }

  function rename(kind: ItemKind, id: string, name: string) {
    patchProject((p) =>
      kind === "checklist"
        ? { ...p, checklists: p.checklists.map((c) => (c.id === id ? { ...c, name } : c)) }
        : { ...p, docs: p.docs.map((d) => (d.id === id ? { ...d, name } : d)) },
    );
  }

  // After deleting, fall back to another item of the same kind, then anything.
  function remove(kind: ItemKind, id: string) {
    if (!project) return;
    const checklists =
      kind === "checklist" ? project.checklists.filter((c) => c.id !== id) : project.checklists;
    const docs = kind === "doc" ? project.docs.filter((d) => d.id !== id) : project.docs;

    let active = state!.active;
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
    patchProject((p) => ({ ...p, checklists, docs }), active);
  }

  function updateChecklist(updated: Checklist) {
    patchProject((p) => ({
      ...p,
      checklists: p.checklists.map((c) => (c.id === updated.id ? updated : c)),
    }));
  }

  function updateDoc(updated: Doc) {
    patchProject((p) => ({
      ...p,
      docs: p.docs.map((d) => (d.id === updated.id ? updated : d)),
    }));
  }

  // --- files ------------------------------------------------------------
  async function addFile() {
    const selected = await openDialog({
      title: "Add a file to this project",
      multiple: true,
    });
    const paths = Array.isArray(selected)
      ? selected
      : typeof selected === "string"
        ? [selected]
        : [];
    if (paths.length === 0) return;
    const added: Resource[] = paths.map((path) => ({
      id: newId(),
      label: path.split(/[\\/]/).pop() || path,
      kind: "file",
      target: path,
    }));
    patchProject((p) => ({ ...p, files: [...p.files, ...added] }));
  }

  function removeFile(id: string) {
    patchProject((p) => ({ ...p, files: p.files.filter((f) => f.id !== id) }));
  }

  // --- import -----------------------------------------------------------
  function addImportedItem(item: ImportedItem) {
    if (item.kind === "project") {
      const imported = item.project;
      setState((s) =>
        s
          ? {
              ...s,
              projects: [...s.projects, imported],
              activeProjectId: imported.id,
              active: imported.checklists[0]
                ? { kind: "checklist", id: imported.checklists[0].id }
                : imported.docs[0]
                  ? { kind: "doc", id: imported.docs[0].id }
                  : null,
            }
          : s,
      );
      return;
    }
    if (item.kind === "doc") {
      const doc = item.doc;
      patchProject((p) => ({ ...p, docs: [...p.docs, doc] }), {
        kind: "doc",
        id: doc.id,
      });
      return;
    }
    const checklist = item.checklist;
    patchProject((p) => ({ ...p, checklists: [...p.checklists, checklist] }), {
      kind: "checklist",
      id: checklist.id,
    });
  }

  async function exportProject() {
    if (!project) return;
    try {
      const path = await exportProjectToUar(project);
      if (path) {
        await message(`Exported to ${path}`, { title: "Project exported" });
      }
    } catch (e) {
      console.error("Export failed", e);
      await message(String(e instanceof Error ? e.message : e), {
        title: "Couldn't export the project",
        kind: "error",
      });
    }
  }

  async function importFromFile() {
    try {
      const imported = await importItemFromFile();
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

  return (
    <LibraryProvider
      value={{
        checklists: project?.checklists ?? [],
        docs: project?.docs ?? [],
        currentId: state.active?.id ?? null,
        navigate: select,
      }}
    >
      <div className={styles.app}>
        <Sidebar
          projects={state.projects}
          activeProjectId={project?.id ?? null}
          onSelectProject={selectProject}
          onAddProject={addProject}
          onRenameProject={renameProject}
          onDeleteProject={deleteProject}
          onExportProject={exportProject}
          checklists={project?.checklists ?? []}
          docs={project?.docs ?? []}
          active={state.active}
          onSelect={select}
          onAddChecklist={addChecklist}
          onAddDoc={addDoc}
          onRename={rename}
          onDelete={remove}
          files={project ? allFiles(project) : []}
          onAddFile={addFile}
          onRemoveFile={removeFile}
          onOpenFile={openLink}
          onImport={importFromFile}
          onAiImport={(kind) => setAiImportKind(kind)}
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

        {aiImportKind && (
          <AiImportDialog
            kind={aiImportKind}
            onClose={() => setAiImportKind(null)}
            onImported={(item) => {
              addImportedItem(item);
              setAiImportKind(null);
            }}
          />
        )}
      </div>
    </LibraryProvider>
  );
}
