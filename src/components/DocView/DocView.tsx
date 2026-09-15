import { useState } from "react";
import type { Doc } from "../../types";
import MarkdownView from "../MarkdownView/MarkdownView";
import MarkdownEditor from "../MarkdownEditor/MarkdownEditor";
import ResourceList from "../ResourceList/ResourceList";
import { resolveAppImage, openLink } from "../../appLinks";
import { exportDocToHtml } from "../../exportHtml";
import styles from "./DocView.module.css";

interface Props {
  doc: Doc;
  onChange: (doc: Doc) => void;
}

// A reference page: Markdown body (diagrams via images), plus links and files.
export default function DocView({ doc, onChange }: Props) {
  const [editing, setEditing] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  function startRename() {
    setNameDraft(doc.name);
    setEditingName(true);
  }
  function commitRename() {
    onChange({ ...doc, name: nameDraft.trim() || "Untitled doc" });
    setEditingName(false);
  }

  async function handleExport() {
    try {
      const path = await exportDocToHtml(doc);
      if (path) {
        setToast(`Exported to ${path}`);
        setTimeout(() => setToast(null), 4000);
      }
    } catch (e) {
      console.error(e);
      setToast("Export failed — see console for details.");
      setTimeout(() => setToast(null), 4000);
    }
  }

  return (
    <section className={styles.view}>
      <div className={styles.inner}>
        <div className={styles.header}>
          <div className={styles.headMain}>
            <div className={styles.kind}>Reference doc</div>
            {editingName ? (
              <input
                className={styles.titleInput}
                value={nameDraft}
                autoFocus
                onChange={(e) => setNameDraft(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitRename();
                  if (e.key === "Escape") setEditingName(false);
                }}
              />
            ) : (
              <button className={styles.titleBtn} onClick={startRename} title="Click to rename">
                <h1 className={styles.title}>{doc.name}</h1>
                <svg className={styles.titlePencil} width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M11.5 2.5l2 2L6 12l-2.5.5L4 10l7.5-7.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
                </svg>
              </button>
            )}
            <ResourceList
              resources={doc.resources}
              onChange={(resources) => onChange({ ...doc, resources })}
            />
          </div>

          <div className={styles.actions}>
            <button
              className={`${styles.btn} ${editing ? styles.active : ""}`}
              onClick={() => setEditing((v) => !v)}
            >
              {editing ? "Done" : "Edit"}
            </button>
            <button className={styles.btn} onClick={handleExport} title="Export as a web page">
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M8 10V2M5 5l3-3 3 3M3 11v2a1 1 0 001 1h8a1 1 0 001-1v-2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Export
            </button>
          </div>
        </div>

        {editing ? (
          <MarkdownEditor
            value={doc.body}
            onChange={(body) => onChange({ ...doc, body })}
            placeholder="Explain how it works… (Markdown: headings, bullets, images, links)"
          />
        ) : (
          <div className={styles.body}>
            {doc.body.trim() ? (
              <MarkdownView
                content={doc.body}
                resolveImage={resolveAppImage}
                onLinkClick={openLink}
              />
            ) : (
              <p className={styles.empty}>
                Nothing written yet — click Edit to start.
              </p>
            )}
          </div>
        )}
      </div>

      {toast && <div className={styles.toast}>{toast}</div>}
    </section>
  );
}
