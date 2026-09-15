import { useState } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import type { Resource, ResourceKind } from "../../types";
import { newId } from "../../types";
import { openLink, normalizeTarget } from "../../appLinks";
import { useLibrary, useResourceLabel, isInternal } from "../../library";
import styles from "./ResourceList.module.css";

interface Props {
  resources: Resource[];
  onChange: (resources: Resource[]) => void;
  /** Hide the internal-links row (used where linking items doesn't apply). */
  showLinkedItems?: boolean;
}

type RowKind = "web" | "file" | "item";

const ROWS: { key: RowKind; label: string; addLabel: string }[] = [
  { key: "web", label: "Links:", addLabel: "+ Link" },
  { key: "file", label: "Files:", addLabel: "+ File" },
  { key: "item", label: "In app:", addLabel: "+ Doc or checklist" },
];

function rowOf(kind: ResourceKind): RowKind {
  return kind === "web" ? "web" : kind === "file" ? "file" : "item";
}

export default function ResourceList({
  resources,
  onChange,
  showLinkedItems = true,
}: Props) {
  const { checklists, docs, navigate } = useLibrary();
  const labelFor = useResourceLabel();
  const [editingRow, setEditingRow] = useState<RowKind | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  function update(id: string, changes: Partial<Resource>) {
    onChange(resources.map((r) => (r.id === id ? { ...r, ...changes } : r)));
  }
  function remove(id: string, rowKind: RowKind) {
    onChange(resources.filter((r) => r.id !== id));
    if (resources.filter((r) => rowOf(r.kind) === rowKind).length <= 1) {
      setEditingRow(null);
    }
  }

  function open(r: Resource) {
    if (r.kind === "doc" || r.kind === "checklist") {
      navigate({ kind: r.kind, id: r.target });
    } else {
      openLink(r.target);
    }
  }

  function addLink() {
    onChange([...resources, { id: newId(), label: "", kind: "web", target: "" }]);
    setEditingRow("web");
  }

  async function addFile() {
    const selected = await openDialog({
      title: "Choose a file",
      multiple: false,
    });
    if (typeof selected !== "string") return;
    const fallback = selected.split(/[\\/]/).pop() || selected;
    onChange([
      ...resources,
      { id: newId(), label: fallback, kind: "file", target: selected },
    ]);
  }

  function addItem(kind: "doc" | "checklist", id: string) {
    setPickerOpen(false);
    // Label stays empty so the link follows the item's current name.
    onChange([...resources, { id: newId(), label: "", kind, target: id }]);
  }

  function renderRow(row: (typeof ROWS)[number]) {
    const items = resources.filter((r) => rowOf(r.kind) === row.key);
    const editing = editingRow === row.key;
    const add =
      row.key === "web" ? addLink : row.key === "file" ? addFile : () => setPickerOpen(true);

    return (
      <div className={styles.row} key={row.key}>
        <span className={styles.rowLabel}>{row.label}</span>
        <div
          className={styles.rowBody}
          onKeyDown={(e) => {
            if (editing && e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              setEditingRow(null);
            }
          }}
        >
          {!editing && items.length > 0 && (
            <ul className={styles.list}>
              {items.map((r) => (
                <li key={r.id} className={styles.chip}>
                  <button
                    className={`${styles.chipLink} ${isInternal(r.kind) ? styles.internal : ""}`}
                    onClick={() => open(r)}
                    title={isInternal(r.kind) ? `Open ${r.kind}` : r.target}
                  >
                    {labelFor(r)}
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
                    onChange={(e) => update(r.id, { label: e.target.value })}
                    placeholder={isInternal(r.kind) ? labelFor(r) : "Label"}
                  />
                  {r.kind === "web" ? (
                    <input
                      className={styles.input}
                      value={r.target}
                      onChange={(e) => update(r.id, { target: e.target.value })}
                      onBlur={(e) => update(r.id, { target: normalizeTarget(e.target.value) })}
                      placeholder="https://…"
                    />
                  ) : (
                    <span className={styles.path} title={r.target}>
                      {isInternal(r.kind) ? `${r.kind}: ${labelFor(r)}` : r.target}
                    </span>
                  )}
                  <button
                    className={styles.remove}
                    onClick={() => remove(r.id, row.key)}
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
              <button className={styles.smallBtn} onClick={add}>
                {row.addLabel}
              </button>
              <button className={styles.smallBtn} onClick={() => setEditingRow(null)}>
                Done
              </button>
            </div>
          ) : items.length === 0 ? (
            <button className={styles.addEmpty} onClick={add}>
              {row.addLabel}
            </button>
          ) : (
            <button
              className={styles.pencil}
              onClick={() => setEditingRow(row.key)}
              title={`Edit ${row.label.replace(":", "").toLowerCase()}`}
              aria-label={`Edit ${row.label.replace(":", "").toLowerCase()}`}
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                <path d="M11.5 2.5l2 2L6 12l-2.5.5L4 10l7.5-7.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
              </svg>
            </button>
          )}

          {row.key === "item" && pickerOpen && (
            <>
              <div className={styles.menuBackdrop} onClick={() => setPickerOpen(false)} />
              <div className={styles.picker}>
                <div className={styles.pickerLabel}>Docs</div>
                {docs.length === 0 && <div className={styles.pickerEmpty}>No docs yet</div>}
                {docs.map((d) => (
                  <button key={d.id} className={styles.pickerItem} onClick={() => addItem("doc", d.id)}>
                    {d.name}
                  </button>
                ))}
                <div className={styles.pickerLabel}>Checklists</div>
                {checklists.length === 0 && (
                  <div className={styles.pickerEmpty}>No checklists yet</div>
                )}
                {checklists.map((c) => (
                  <button
                    key={c.id}
                    className={styles.pickerItem}
                    onClick={() => addItem("checklist", c.id)}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      {ROWS.filter((r) => r.key !== "item" || showLinkedItems).map(renderRow)}
    </div>
  );
}
