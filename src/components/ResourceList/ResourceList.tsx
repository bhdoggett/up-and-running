import { useState } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import type { Resource } from "../../types";
import { newId } from "../../types";
import { openLink } from "../../appLinks";
import styles from "./ResourceList.module.css";

interface Props {
  resources: Resource[];
  onChange: (resources: Resource[]) => void;
}

// A compact editor for a list of links/files: open, remove, add web link, add file.
export default function ResourceList({ resources, onChange }: Props) {
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [addingLink, setAddingLink] = useState(false);

  function addWebLink() {
    const target = url.trim();
    if (!target) return;
    onChange([
      ...resources,
      { id: newId(), label: label.trim() || target, kind: "web", target },
    ]);
    setLabel("");
    setUrl("");
    setAddingLink(false);
  }

  function cancelLink() {
    setLabel("");
    setUrl("");
    setAddingLink(false);
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
      { id: newId(), label: label.trim() || fallback, kind: "file", target: selected },
    ]);
    setLabel("");
  }

  function remove(id: string) {
    onChange(resources.filter((r) => r.id !== id));
  }

  const links = resources.filter((r) => r.kind === "web");
  const files = resources.filter((r) => r.kind === "file");

  function renderItems(items: Resource[]) {
    return items.map((r) => (
      <li key={r.id} className={styles.chip}>
        <button className={styles.chipLink} onClick={() => openLink(r.target)}>
          {r.label}
        </button>
        <button className={styles.remove} onClick={() => remove(r.id)} title="Remove" aria-label="Remove">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </li>
    ));
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.row}>
        <span className={styles.rowLabel}>Links:</span>
        <div className={styles.rowBody}>
          {links.length > 0 && <ul className={styles.list}>{renderItems(links)}</ul>}
          {addingLink ? (
            <div className={styles.addRow}>
              <input
                className={styles.input}
                style={{ flex: "1 1 7rem" }}
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Label (optional)"
              />
              <input
                className={styles.input}
                style={{ flex: "2 1 11rem" }}
                value={url}
                autoFocus
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addWebLink();
                  if (e.key === "Escape") cancelLink();
                }}
                placeholder="https://…"
              />
              <button className={styles.smallBtn} onClick={addWebLink}>Add</button>
              <button className={styles.smallBtn} onClick={cancelLink}>Cancel</button>
            </div>
          ) : (
            <button className={styles.smallBtn} onClick={() => setAddingLink(true)}>
              + Link
            </button>
          )}
        </div>
      </div>

      <div className={styles.row}>
        <span className={styles.rowLabel}>Files:</span>
        <div className={styles.rowBody}>
          {files.length > 0 && <ul className={styles.list}>{renderItems(files)}</ul>}
          <button className={styles.smallBtn} onClick={addFile}>+ File</button>
        </div>
      </div>
    </div>
  );
}
