import { useState } from "react";
import { createPortal } from "react-dom";
import { confirm } from "@tauri-apps/plugin-dialog";
import type { Checklist, Doc, FileUse, ItemKind, Project, Selection } from "../../types";
import { allTasks } from "../../types";
import styles from "./Sidebar.module.css";

interface Props {
  projects: Project[];
  activeProjectId: string | null;
  onSelectProject: (id: string) => void;
  onAddProject: () => void;
  onRenameProject: (id: string, name: string) => void;
  onDeleteProject: (id: string) => void;
  onExportProject: () => void;
  checklists: Checklist[];
  docs: Doc[];
  active: Selection | null;
  onSelect: (sel: Selection) => void;
  onAddChecklist: () => void;
  onAddDoc: () => void;
  onRename: (kind: ItemKind, id: string, name: string) => void;
  onDelete: (kind: ItemKind, id: string) => void;
  files: FileUse[];
  onAddFile: () => void;
  onRemoveFile: (id: string) => void;
  onOpenFile: (target: string) => void;
  onImport: () => void;
  onAiImport: (kind: ItemKind) => void;
  /** Current width in px (set by the draggable divider in App). */
  width: number;
}

interface Item {
  id: string;
  name: string;
  /** Right-aligned hint, e.g. "2/5" for checklists. */
  meta?: string;
}

export default function Sidebar({
  projects,
  activeProjectId,
  onSelectProject,
  onAddProject,
  onRenameProject,
  onDeleteProject,
  onExportProject,
  checklists,
  docs,
  active,
  onSelect,
  onAddChecklist,
  onAddDoc,
  onRename,
  onDelete,
  files,
  onAddFile,
  onRemoveFile,
  onOpenFile,
  onImport,
  onAiImport,
  width,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  // The menu is portalled to <body> with fixed coords: the sidebar's scroll
  // container would otherwise clip it as soon as it reaches the edge. It
  // remembers which group opened it, so the options stay scoped to that kind.
  const [menu, setMenu] = useState<{
    kind: ItemKind;
    top: number;
    left: number;
  } | null>(null);

  const [projectMenu, setProjectMenu] = useState<{ top: number; left: number } | null>(
    null,
  );
  const [editingProject, setEditingProject] = useState(false);
  const [projectDraft, setProjectDraft] = useState("");

  const activeProject = projects.find((p) => p.id === activeProjectId) ?? null;

  function commitProjectRename() {
    if (activeProject) {
      onRenameProject(activeProject.id, projectDraft.trim() || "Untitled project");
    }
    setEditingProject(false);
  }

  const MENU_WIDTH = 210;

  function toggleImportMenu(e: React.MouseEvent<HTMLButtonElement>, kind: ItemKind) {
    if (menu?.kind === kind) {
      setMenu(null);
      return;
    }
    const r = e.currentTarget.getBoundingClientRect();
    setMenu({
      kind,
      top: r.bottom + 6,
      // Keep it on screen if the sidebar is narrow or dragged wide.
      left: Math.min(r.left, window.innerWidth - MENU_WIDTH - 12),
    });
  }

  function commitRename(kind: ItemKind) {
    if (editingId) onRename(kind, editingId, draft.trim() || "Untitled");
    setEditingId(null);
  }

  async function requestDelete(kind: ItemKind, item: Item, hasContent: boolean) {
    if (hasContent) {
      const what = kind === "checklist" ? "checklist" : "doc";
      const ok = await confirm(
        `“${item.name}” has content in it. Delete this ${what} permanently?`,
        { title: `Delete ${what}`, kind: "warning", okLabel: "Delete", cancelLabel: "Cancel" },
      );
      if (!ok) return;
    }
    onDelete(kind, item.id);
  }

  function renderGroup(
    label: string,
    kind: ItemKind,
    items: Item[],
    onAdd: () => void,
    hasContent: (id: string) => boolean,
    emptyText: string,
  ) {
    return (
      <>
        <div className={styles.listHead}>
          <span className={styles.listLabel}>{label}</span>
          <div className={styles.headBtns}>
            {/* Checklists arrive as files or from a document; docs only ever
                come from a document, so that button skips the menu. */}
            <button
              className={styles.addBtn}
              onClick={(e) =>
                kind === "doc" ? onAiImport("doc") : toggleImportMenu(e, kind)
              }
              title={
                kind === "doc"
                  ? "Import a doc from a Word file or PDF"
                  : "Import a checklist"
              }
              aria-label={`Import ${kind}`}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M8 2v7M5 6.5L8 9.5l3-3M3 12v1.5h10V12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button className={styles.addBtn} onClick={onAdd} title={`New ${kind}`} aria-label={`New ${kind}`}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        <ul className={styles.list}>
          {items.length === 0 && <li className={styles.empty}>{emptyText}</li>}
          {items.map((item) => {
            const isActive = active?.kind === kind && active.id === item.id;
            return (
              <li key={item.id} className={`${styles.row} ${isActive ? styles.active : ""}`}>
                {editingId === item.id ? (
                  <input
                    className={styles.nameInput}
                    value={draft}
                    autoFocus
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={() => commitRename(kind)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitRename(kind);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                  />
                ) : (
                  <>
                    <button
                      className={styles.itemBtn}
                      onClick={() => onSelect({ kind, id: item.id })}
                      onDoubleClick={() => {
                        setEditingId(item.id);
                        setDraft(item.name);
                      }}
                      title="Click to open · double-click to rename"
                    >
                      {item.name}
                    </button>
                    {item.meta && <span className={styles.progress}>{item.meta}</span>}
                    <button
                      className={styles.rowDelete}
                      onClick={() => requestDelete(kind, item, hasContent(item.id))}
                      title={`Delete ${kind}`}
                      aria-label={`Delete ${kind}`}
                    >
                      <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                        <path d="M3 4h10M6.5 4V3h3v1M4.5 4l.5 9h6l.5-9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      </>
    );
  }

  return (
    <aside className={styles.sidebar} style={{ width }}>
      <div className={styles.brand}>
        <div className={styles.brandRow}>
          {/* The mark is a markdown heading marker — the app's own material. */}
          <span className={styles.mark} aria-hidden="true">
            ##
          </span>
          <span className={styles.brandName}>Up and Running</span>
        </div>
        {editingProject ? (
          <input
            className={styles.projectInput}
            value={projectDraft}
            autoFocus
            onChange={(e) => setProjectDraft(e.target.value)}
            onBlur={commitProjectRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitProjectRename();
              if (e.key === "Escape") setEditingProject(false);
            }}
          />
        ) : (
          <div className={styles.projectRow}>
            <button
              className={styles.projectBtn}
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                setProjectMenu(
                  projectMenu
                    ? null
                    : { top: r.bottom + 6, left: Math.min(r.left, window.innerWidth - 240) },
                );
              }}
              title="Switch project"
            >
              <span className={styles.projectName}>
                {activeProject?.name ?? "No project"}
              </span>
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              className={styles.projectAction}
              onClick={() => {
                setProjectDraft(activeProject?.name ?? "");
                setEditingProject(true);
              }}
              title="Rename project"
              aria-label="Rename project"
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                <path d="M11.5 2.5l2 2L6 12l-2.5.5L4 10l7.5-7.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        )}
      </div>

      <div className={styles.scroll}>
        {renderGroup(
          "Checklists",
          "checklist",
          checklists.map((c) => {
            const tasks = allTasks(c);
            return {
              id: c.id,
              name: c.name,
              meta: tasks.length
                ? `${tasks.filter((t) => t.done).length}/${tasks.length}`
                : undefined,
            };
          }),
          onAddChecklist,
          (id) => {
            const c = checklists.find((x) => x.id === id);
            return !!c && allTasks(c).length > 0;
          },
          "No checklists yet.",
        )}

        {renderGroup(
          "Docs",
          "doc",
          docs.map((d) => ({ id: d.id, name: d.name })),
          onAddDoc,
          (id) => {
            const d = docs.find((x) => x.id === id);
            return !!d && d.body.trim().length > 0;
          },
          "No docs yet.",
        )}

        {/* Loose files: clicking opens them in their default app. */}
        <div className={styles.listHead}>
          <span className={styles.listLabel}>Files</span>
          <div className={styles.headBtns}>
            <button className={styles.addBtn} onClick={onAddFile} title="Add a file" aria-label="Add a file">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>
        <ul className={styles.list}>
          {files.length === 0 && <li className={styles.empty}>No files yet.</li>}
          {files.map(({ resource, where }) => (
            <li key={resource.id} className={styles.row}>
              <button
                className={styles.fileBtn}
                onClick={() => onOpenFile(resource.target)}
                title={`${resource.target}\nUsed in: ${where}`}
              >
                <span className={styles.fileName}>{resource.label}</span>
                <span className={styles.fileWhere}>{where}</span>
              </button>
              {/* Only library-owned files can be removed here; ones attached to a
                  checklist or doc are removed where they're used. */}
              {where === "Library" && (
                <button
                  className={styles.rowDelete}
                  onClick={() => onRemoveFile(resource.id)}
                  title="Remove from list (the file itself stays on disk)"
                  aria-label="Remove file"
                >
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                    <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>

      {projectMenu &&
        createPortal(
          <>
            <div className={styles.menuBackdrop} onClick={() => setProjectMenu(null)} />
            <div
              className={styles.menu}
              style={{ top: projectMenu.top, left: projectMenu.left, width: 230 }}
            >
              {projects.map((p) => (
                <button
                  key={p.id}
                  className={`${styles.projectItem} ${p.id === activeProjectId ? styles.projectCurrent : ""}`}
                  onClick={() => {
                    setProjectMenu(null);
                    onSelectProject(p.id);
                  }}
                >
                  <span className={styles.projectItemName}>{p.name}</span>
                  <span className={styles.projectItemMeta}>
                    {p.checklists.length + p.docs.length} item
                    {p.checklists.length + p.docs.length === 1 ? "" : "s"}
                  </span>
                </button>
              ))}
              <div className={styles.menuSep} />
              <button
                className={styles.menuAction}
                onClick={() => {
                  setProjectMenu(null);
                  onAddProject();
                }}
              >
                + New project
              </button>
              <button
                className={styles.menuAction}
                onClick={() => {
                  setProjectMenu(null);
                  onImport();
                }}
              >
                Import a project or checklist…
              </button>
              {activeProject && (
                <button
                  className={styles.menuAction}
                  onClick={() => {
                    setProjectMenu(null);
                    onExportProject();
                  }}
                >
                  Export this project (.uar)
                </button>
              )}
              {activeProject && projects.length > 0 && (
                <button
                  className={`${styles.menuAction} ${styles.menuDanger}`}
                  onClick={() => {
                    const id = activeProject.id;
                    setProjectMenu(null);
                    onDeleteProject(id);
                  }}
                >
                  Delete “{activeProject.name}”
                </button>
              )}
            </div>
          </>,
          document.body,
        )}

      {menu &&
        createPortal(
          <>
            <div className={styles.menuBackdrop} onClick={() => setMenu(null)} />
            <div
              className={styles.menu}
              style={{ top: menu.top, left: menu.left, width: MENU_WIDTH }}
            >
              <button
                className={styles.menuItem}
                onClick={() => {
                  setMenu(null);
                  onImport();
                }}
              >
                <strong>From an exported page</strong>
                <span>An .html file exported from this app</span>
              </button>
              <button
                className={styles.menuItem}
                onClick={() => {
                  const kind = menu.kind;
                  setMenu(null);
                  onAiImport(kind);
                }}
              >
                <strong>From a document (AI)</strong>
                <span>
                  {menu.kind === "checklist"
                    ? "Word doc or PDF → steps"
                    : "Word doc or PDF → a reference page"}
                </span>
              </button>
            </div>
          </>,
          document.body,
        )}
    </aside>
  );
}
