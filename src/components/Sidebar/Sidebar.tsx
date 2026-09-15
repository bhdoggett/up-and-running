import { useState } from "react";
import { confirm } from "@tauri-apps/plugin-dialog";
import type { Checklist } from "../../types";
import styles from "./Sidebar.module.css";

interface Props {
  checklists: Checklist[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onImport: () => void;
  /** Current width in px (set by the draggable divider in App). */
  width: number;
}

function progressLabel(c: Checklist): string {
  if (c.tasks.length === 0) return "";
  const done = c.tasks.filter((t) => t.done).length;
  return `${done}/${c.tasks.length}`;
}

export default function Sidebar({
  checklists,
  activeId,
  onSelect,
  onAdd,
  onRename,
  onDelete,
  onImport,
  width,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  function startRename(c: Checklist) {
    setEditingId(c.id);
    setDraft(c.name);
  }
  function commitRename() {
    if (editingId) {
      onRename(editingId, draft.trim() || "Untitled checklist");
    }
    setEditingId(null);
  }

  // Warn before deleting a checklist that has steps in it; delete empty ones immediately.
  async function requestDelete(c: Checklist) {
    if (c.tasks.length > 0) {
      const ok = await confirm(
        `“${c.name}” has ${c.tasks.length} step${c.tasks.length === 1 ? "" : "s"}. Delete it permanently?`,
        { title: "Delete checklist", kind: "warning", okLabel: "Delete", cancelLabel: "Cancel" },
      );
      if (!ok) return;
    }
    onDelete(c.id);
  }

  return (
    <aside className={styles.sidebar} style={{ width }}>
      <div className={styles.brand}>
        <div className={styles.brandName}>Up and Running</div>
        <div className={styles.brandSub}>Event setup guides</div>
      </div>

      <div className={styles.listHead}>
        <span className={styles.listLabel}>Checklists</span>
        <div className={styles.headBtns}>
          <button className={styles.addBtn} onClick={onImport} title="Import a checklist (.uar or .html)" aria-label="Import checklist">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M8 2v7M5 6.5L8 9.5l3-3M3 12v1.5h10V12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button className={styles.addBtn} onClick={onAdd} title="New checklist" aria-label="New checklist">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      <ul className={styles.list}>
        {checklists.length === 0 && (
          <li className={styles.empty}>No checklists yet.<br />Click + to add one.</li>
        )}
        {checklists.map((c) => (
          <li
            key={c.id}
            className={`${styles.row} ${c.id === activeId ? styles.active : ""}`}
          >
            {editingId === c.id ? (
              <input
                className={styles.nameInput}
                value={draft}
                autoFocus
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitRename();
                  if (e.key === "Escape") setEditingId(null);
                }}
              />
            ) : (
              <>
                <button
                  className={styles.itemBtn}
                  onClick={() => onSelect(c.id)}
                  onDoubleClick={() => startRename(c)}
                  title="Click to open · double-click to rename"
                >
                  {c.name}
                </button>
                <span className={styles.progress}>{progressLabel(c)}</span>
                <button
                  className={styles.rowDelete}
                  onClick={() => requestDelete(c)}
                  title="Delete checklist"
                  aria-label="Delete checklist"
                >
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                    <path d="M3 4h10M6.5 4V3h3v1M4.5 4l.5 9h6l.5-9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
    </aside>
  );
}
