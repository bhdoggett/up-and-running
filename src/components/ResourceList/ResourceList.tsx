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

  return (
    <div className={styles.wrap}>
      {resources.length > 0 && (
        <ul className={styles.list}>
          {resources.map((r) => (
            <li key={r.id} className={styles.chip}>
              <button className={styles.chipLink} onClick={() => openLink(r.target)}>
                <svg className={styles.chipIcon} width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  {r.kind === "web" ? (
                    <path d="M8 1a7 7 0 100 14A7 7 0 008 1zM1.5 8h13M8 1.5c1.7 1.6 2.6 3.9 2.6 6.5S9.7 12.9 8 14.5C6.3 12.9 5.4 10.6 5.4 8S6.3 3.1 8 1.5z" stroke="currentColor" strokeWidth="1.1" />
                  ) : (
                    <path d="M4.5 2.5h4l3 3v8h-7v-11zM8.5 2.5v3h3" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
                  )}
                </svg>
                {r.label}
              </button>
              <button className={styles.remove} onClick={() => remove(r.id)} title="Remove" aria-label="Remove">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                  <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}
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
            placeholder="https://… (web link)"
          />
          <button className={styles.smallBtn} onClick={addWebLink}>Add</button>
          <button className={styles.smallBtn} onClick={cancelLink}>Cancel</button>
        </div>
      ) : (
        <div className={styles.addRow}>
          <button className={styles.smallBtn} onClick={() => setAddingLink(true)}>+ Link</button>
          <button className={styles.smallBtn} onClick={addFile}>+ File</button>
        </div>
      )}
    </div>
  );
}
