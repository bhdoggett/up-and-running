import { useState } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import type { Resource, ResourceKind } from "../../types";
import { newId } from "../../types";
import { openLink, normalizeTarget, displayLabel } from "../../appLinks";
import styles from "./ResourceList.module.css";

interface Props {
  resources: Resource[];
  onChange: (resources: Resource[]) => void;
}

interface RowProps {
  label: string;
  kind: ResourceKind;
  items: Resource[];
  onAdd: () => void;
  onUpdate: (id: string, changes: Partial<Resource>) => void;
  onRemove: (id: string) => void;
}

// One labeled row ("Links:" or "Files:") that flips between viewing and editing.
function Row({ label, kind, items, onAdd, onUpdate, onRemove }: RowProps) {
  const [editing, setEditing] = useState(false);

  // Adding always lands in edit mode so the new entry can be named right away.
  function handleAdd() {
    onAdd();
    setEditing(true);
  }

  // Removing the last entry leaves nothing to edit, so close edit mode with it.
  function handleRemove(id: string) {
    onRemove(id);
    if (items.length <= 1) setEditing(false);
  }

  return (
    <div className={styles.row}>
      <span className={styles.rowLabel}>{label}</span>
      <div
        className={styles.rowBody}
        onKeyDown={(e) => {
          // Cmd/Ctrl+Enter finishes editing, same as clicking Done.
          if (editing && e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            setEditing(false);
          }
        }}
      >
        {!editing && items.length > 0 && (
          <ul className={styles.list}>
            {items.map((r) => (
              <li key={r.id} className={styles.chip}>
                <button
                  className={styles.chipLink}
                  onClick={() => openLink(r.target)}
                  title={displayLabel(r)}
                >
                  {displayLabel(r)}
                </button>
              </li>
            ))}
          </ul>
        )}

        {editing && (
          <ul className={styles.editList}>
            {items.map((r) => (
              <li key={r.id} className={styles.editRow}>
                <input
                  className={styles.input}
                  value={r.label}
                  onChange={(e) => onUpdate(r.id, { label: e.target.value })}
                  placeholder="Label"
                />
                {kind === "web" ? (
                  <input
                    className={styles.input}
                    value={r.target}
                    onChange={(e) => onUpdate(r.id, { target: e.target.value })}
                    onBlur={(e) =>
                      onUpdate(r.id, { target: normalizeTarget(e.target.value) })
                    }
                    placeholder="https://…"
                  />
                ) : (
                  <span className={styles.path} title={r.target}>
                    {r.target}
                  </span>
                )}
                <button
                  className={styles.remove}
                  onClick={() => handleRemove(r.id)}
                  title="Remove"
                  aria-label="Remove"
                >
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                    <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}

        {editing ? (
          <div className={styles.editActions}>
            <button className={styles.smallBtn} onClick={handleAdd}>
              {kind === "web" ? "+ Link" : "+ File"}
            </button>
            <button className={styles.smallBtn} onClick={() => setEditing(false)}>
              Done
            </button>
          </div>
        ) : items.length === 0 ? (
          // Nothing here yet — invite adding instead of showing a bare pencil.
          <button className={styles.addEmpty} onClick={handleAdd}>
            {kind === "web" ? "+ Link" : "+ File"}
          </button>
        ) : (
          <button
            className={styles.pencil}
            onClick={() => setEditing(true)}
            title={`Edit ${label.replace(":", "").toLowerCase()}`}
            aria-label={`Edit ${label.replace(":", "").toLowerCase()}`}
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <path d="M11.5 2.5l2 2L6 12l-2.5.5L4 10l7.5-7.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

// Checklist-level links and files, split into a "Links:" row and a "Files:" row.
export default function ResourceList({ resources, onChange }: Props) {
  function update(id: string, changes: Partial<Resource>) {
    onChange(resources.map((r) => (r.id === id ? { ...r, ...changes } : r)));
  }
  function remove(id: string) {
    onChange(resources.filter((r) => r.id !== id));
  }
  function addLink() {
    onChange([
      ...resources,
      { id: newId(), label: "", kind: "web", target: "" },
    ]);
  }
  async function addFile() {
    const selected = await openDialog({
      title: "Choose a file for this checklist",
      multiple: false,
    });
    if (typeof selected !== "string") return;
    const fallback = selected.split(/[\\/]/).pop() || selected;
    onChange([
      ...resources,
      { id: newId(), label: fallback, kind: "file", target: selected },
    ]);
  }

  return (
    <div className={styles.wrap}>
      <Row
        label="Links:"
        kind="web"
        items={resources.filter((r) => r.kind === "web")}
        onAdd={addLink}
        onUpdate={update}
        onRemove={remove}
      />
      <Row
        label="Files:"
        kind="file"
        items={resources.filter((r) => r.kind === "file")}
        onAdd={addFile}
        onUpdate={update}
        onRemove={remove}
      />
    </div>
  );
}
