import { useState } from "react";
import { confirm } from "@tauri-apps/plugin-dialog";
import type { Checklist, Doc, ItemKind, Selection } from "../../types";
import { allTasks } from "../../types";
import styles from "./Sidebar.module.css";

interface Props {
  checklists: Checklist[];
  docs: Doc[];
  active: Selection | null;
  onSelect: (sel: Selection) => void;
  onAddChecklist: () => void;
  onAddDoc: () => void;
  onRename: (kind: ItemKind, id: string, name: string) => void;
  onDelete: (kind: ItemKind, id: string) => void;
  onImport: () => void;
  onAiImport: () => void;
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
  checklists,
  docs,
  active,
  onSelect,
  onAddChecklist,
  onAddDoc,
  onRename,
  onDelete,
  onImport,
  onAiImport,
  width,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [importOpen, setImportOpen] = useState(false);

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
            {kind === "checklist" && (
              <div className={styles.importWrap}>
                <button
                  className={styles.addBtn}
                  onClick={() => setImportOpen((v) => !v)}
                  title="Import a checklist"
                  aria-label="Import checklist"
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M8 2v7M5 6.5L8 9.5l3-3M3 12v1.5h10V12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                {importOpen && (
                  <>
                    <div className={styles.menuBackdrop} onClick={() => setImportOpen(false)} />
                    <div className={styles.menu}>
                      <button
                        className={styles.menuItem}
                        onClick={() => {
                          setImportOpen(false);
                          onImport();
                        }}
                      >
                        <strong>From a checklist file</strong>
                        <span>.uar or exported .html</span>
                      </button>
                      <button
                        className={styles.menuItem}
                        onClick={() => {
                          setImportOpen(false);
                          onAiImport();
                        }}
                      >
                        <strong>From a document (AI)</strong>
                        <span>Word doc, PDF, or notes</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
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
        <div className={styles.brandName}>Up and Running</div>
        <div className={styles.brandSub}>Event setup guides</div>
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
      </div>
    </aside>
  );
}
