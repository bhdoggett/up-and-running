import { useState } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import type { Resource, ResourceKind } from "../../types";
import { newId } from "../../types";
import { openLink, normalizeTarget } from "../../appLinks";
import { hashBytes } from "../../attachments";
import { readFile } from "@tauri-apps/plugin-fs";
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
  { key: "item", label: "Docs:", addLabel: "+ Doc" },
];

function rowOf(kind: ResourceKind): RowKind {
  return kind === "web" ? "web" : kind === "file" ? "file" : "item";
}

export default function ResourceList({
  resources,
  onChange,
  showLinkedItems = true,
}: Props) {
  const { docs, currentId, navigate, fileDrag, attachFiles } = useLibrary();
  const [over, setOver] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  /** Say something briefly in the row itself, rather than in a dialog. */
  function say(text: string) {
    setNotice(text);
    window.setTimeout(() => setNotice(null), 2500);
  }
  const labelFor = useResourceLabel();
  const [editingRow, setEditingRow] = useState<RowKind | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  // Collapsed by default so the header stays quiet; the count says what's here.
  const [expanded, setExpanded] = useState(false);

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

  /** Is this exact target already linked here? Keeps the list free of dupes. */
  function alreadyLinked(kind: ResourceKind, target: string): boolean {
    return resources.some((r) => r.kind === kind && r.target === target);
  }

  /** Same path, or the same contents arrived at by a different route. */
  function alreadyAttached(target: string, hash?: string): boolean {
    return resources.some(
      (r) => r.kind === "file" && (r.target === target || (!!hash && r.hash === hash)),
    );
  }

  async function addFile() {
    const selected = await openDialog({
      title: "Choose a file",
      multiple: false,
    });
    if (typeof selected !== "string") return;

    // Identify it by contents, not path: the same file dropped in earlier was
    // copied into the app and so carries a different path entirely.
    let hash: string | undefined;
    try {
      hash = await hashBytes(await readFile(selected));
    } catch (e) {
      console.error("Could not read the chosen file", e);
    }

    if (alreadyAttached(selected, hash)) {
      // Silently doing nothing reads as a broken button; say why.
      say("That file is already here");
      setEditingRow("file");
      return;
    }

    const fallback = selected.split(/[\\/]/).pop() || selected;
    onChange([
      ...resources,
      { id: newId(), label: fallback, kind: "file", target: selected, hash },
    ]);
  }

  function addItem(kind: "doc" | "checklist", id: string) {
    setPickerOpen(false);
    if (alreadyLinked(kind, id)) return;
    // Label stays empty so the link follows the item's current name.
    onChange([...resources, { id: newId(), label: "", kind, target: id }]);
  }

  // Only offer docs that are neither this one nor already linked.
  const linkableDocs = docs.filter(
    (d) => d.id !== currentId && !alreadyLinked("doc", d.id),
  );

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
                      onBlur={(e) => {
                        const target = normalizeTarget(e.target.value);
                        // Typing a URL that's already in the list drops this row
                        // rather than leaving two entries pointing at one page.
                        const dupe = resources.some(
                          (o) => o.id !== r.id && o.kind === "web" && o.target === target,
                        );
                        if (dupe && target) {
                          onChange(resources.filter((o) => o.id !== r.id));
                          return;
                        }
                        update(r.id, { target });
                      }}
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

          {notice && row.key === "file" && (
            <span className={styles.notice}>{notice}</span>
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
                {linkableDocs.length === 0 && (
                  <div className={styles.pickerEmpty}>No docs to link</div>
                )}
                {linkableDocs.map((d) => (
                  <button key={d.id} className={styles.pickerItem} onClick={() => addItem("doc", d.id)}>
                    {d.name}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // While files are dragged over the window this whole area becomes the target,
  // so a file lands in the resources of whatever it was dropped on.
  if (fileDrag) {
    return (
      <div className={styles.wrap}>
        <div
          className={`${styles.dropZone} ${over ? styles.dropZoneOver : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={async (e) => {
            e.preventDefault();
            // Deliberately not stopping propagation: the window listener is
            // what clears the drag state, so swallowing the event here left
            // every drop zone on screen afterwards.
            setOver(false);
            const added = await attachFiles(e.dataTransfer.files);
            // The same file dropped here twice is one attachment, not two.
            const fresh = added.filter((r) => !alreadyAttached(r.target, r.hash));
            if (fresh.length) {
              onChange([...resources, ...fresh]);
            } else if (added.length) {
              say(
                added.length === 1
                  ? "That file is already here"
                  : "Those files are already here",
              );
            }
          }}
        >
          Drop files here
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <button
        className={styles.toggle}
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <svg
          className={`${styles.toggleChevron} ${expanded ? styles.open : ""}`}
          width="10"
          height="10"
          viewBox="0 0 12 12"
          fill="none"
          aria-hidden="true"
        >
          <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Resources ({resources.length})
      </button>
      {expanded && (
        <div className={styles.rows}>
          {ROWS.filter((r) => r.key !== "item" || showLinkedItems).map(renderRow)}
        </div>
      )}
    </div>
  );
}
