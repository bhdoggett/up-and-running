import { useState } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { openUrl, openPath } from "@tauri-apps/plugin-opener";
import type { Resource, Task } from "../../types";
import { newId } from "../../types";
import MarkdownView from "../MarkdownView/MarkdownView";
import MarkdownEditor from "../MarkdownEditor/MarkdownEditor";
import { resolveAppImage, openLink } from "../../appLinks";
import styles from "./TaskItem.module.css";

interface Props {
  task: Task;
  onToggleDone: () => void;
  onUpdate: (task: Task) => void;
  onDelete: () => void;
}

export default function TaskItem({
  task,
  onToggleDone,
  onUpdate,
  onDelete,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [newLinkLabel, setNewLinkLabel] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");

  const hasBody = task.details.trim() !== "" || task.resources.length > 0;

  async function openResource(r: Resource) {
    try {
      if (r.kind === "web") {
        await openUrl(r.target);
      } else {
        await openPath(r.target);
      }
    } catch (e) {
      console.error("Failed to open resource", e);
    }
  }

  function patch(changes: Partial<Task>) {
    onUpdate({ ...task, ...changes });
  }

  function addWebLink() {
    const url = newLinkUrl.trim();
    if (!url) return;
    const label = newLinkLabel.trim() || url;
    patch({
      resources: [
        ...task.resources,
        { id: newId(), label, kind: "web", target: url },
      ],
    });
    setNewLinkLabel("");
    setNewLinkUrl("");
  }

  async function addFileLink() {
    const selected = await openDialog({
      title: "Choose a tutorial video or file",
      multiple: false,
      filters: [
        {
          name: "Media & documents",
          extensions: ["mp4", "mov", "m4v", "avi", "mkv", "webm", "pdf", "png", "jpg", "jpeg"],
        },
      ],
    });
    if (typeof selected !== "string") return; // cancelled
    const fallbackName = selected.split(/[\\/]/).pop() || selected;
    patch({
      resources: [
        ...task.resources,
        {
          id: newId(),
          label: newLinkLabel.trim() || fallbackName,
          kind: "file",
          target: selected,
        },
      ],
    });
    setNewLinkLabel("");
  }

  function updateResource(id: string, changes: Partial<Resource>) {
    patch({
      resources: task.resources.map((r) =>
        r.id === id ? { ...r, ...changes } : r,
      ),
    });
  }

  function removeResource(id: string) {
    patch({ resources: task.resources.filter((r) => r.id !== id) });
  }

  return (
    <li className={`${styles.item} ${task.done ? styles.done : ""}`}>
      <div className={styles.head}>
        <input
          type="checkbox"
          className={styles.check}
          checked={task.done}
          onChange={onToggleDone}
          aria-label={`Mark "${task.title}" done`}
        />
        <button
          className={styles.titleBtn}
          onClick={() => hasBody && setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          {hasBody && (
            <svg
              className={`${styles.chevron} ${expanded ? styles.open : ""}`}
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              aria-hidden="true"
            >
              <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
          <span className={`${styles.title} ${task.done ? styles.done : ""}`}>
            {task.title}
          </span>
          {task.resources.length > 0 && (
            <span className={styles.count}>
              {task.resources.length} link{task.resources.length === 1 ? "" : "s"}
            </span>
          )}
        </button>

        <button
          className={styles.iconBtn}
          onClick={() => {
            setEditing((v) => !v);
            setExpanded(true);
          }}
          title="Edit step"
          aria-label="Edit step"
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
            <path d="M11.5 2.5l2 2L6 12l-2.5.5L4 10l7.5-7.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          className={`${styles.iconBtn} ${styles.danger}`}
          onClick={onDelete}
          title="Delete step"
          aria-label="Delete step"
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
            <path d="M3 4h10M6.5 4V3h3v1M4.5 4l.5 9h6l.5-9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* Read view */}
      {!editing && expanded && hasBody && (
        <div className={styles.body}>
          {task.details.trim() !== "" && (
            <div className={styles.details}>
              <MarkdownView
                content={task.details}
                resolveImage={resolveAppImage}
                onLinkClick={openLink}
              />
            </div>
          )}
          {task.resources.length > 0 && (
            <ul className={styles.resources}>
              {task.resources.map((r) => (
                <li key={r.id} className={styles.resource}>
                  <button className={styles.resLink} onClick={() => openResource(r)}>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      {r.kind === "web" ? (
                        <path d="M8 1a7 7 0 100 14A7 7 0 008 1zM1.5 8h13M8 1.5c1.7 1.6 2.6 3.9 2.6 6.5S9.7 12.9 8 14.5C6.3 12.9 5.4 10.6 5.4 8S6.3 3.1 8 1.5z" stroke="currentColor" strokeWidth="1.1" />
                      ) : (
                        <path d="M4.5 2.5h4l3 3v8h-7v-11zM8.5 2.5v3h3" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
                      )}
                    </svg>
                    {r.label}
                    <span className={styles.resKind}>
                      {r.kind === "web" ? "↗" : "· file"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Edit view */}
      {editing && (
        <div className={styles.editBody}>
          <div>
            <div className={styles.label}>Step title</div>
            <input
              className={styles.input}
              value={task.title}
              onChange={(e) => patch({ title: e.target.value })}
              placeholder="What needs to be done?"
            />
          </div>
          <div>
            <div className={styles.label}>Explanation</div>
            <MarkdownEditor
              value={task.details}
              onChange={(details) => patch({ details })}
              placeholder="Add more detail volunteers might need… (supports Markdown: headings, bullets, bold, links, images)"
            />
          </div>

          <div>
            <div className={styles.label}>Links & tutorials</div>
            <ul className={styles.resources}>
              {task.resources.map((r) => (
                <li key={r.id} className={styles.resEditRow}>
                  <input
                    className={styles.input}
                    value={r.label}
                    onChange={(e) => updateResource(r.id, { label: e.target.value })}
                    placeholder="Label"
                  />
                  <span className={styles.resKind}>
                    {r.kind === "web" ? "web" : "file"}
                  </span>
                  <button
                    className={`${styles.iconBtn} ${styles.danger}`}
                    onClick={() => removeResource(r.id)}
                    title="Remove link"
                    aria-label="Remove link"
                  >
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>

            <div className={styles.addRow} style={{ marginTop: "0.5rem" }}>
              <input
                className={styles.input}
                style={{ flex: "1 1 8rem" }}
                value={newLinkLabel}
                onChange={(e) => setNewLinkLabel(e.target.value)}
                placeholder="Link label (optional)"
              />
              <input
                className={styles.input}
                style={{ flex: "2 1 12rem" }}
                value={newLinkUrl}
                onChange={(e) => setNewLinkUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addWebLink()}
                placeholder="https://… (web link)"
              />
              <button className={styles.smallBtn} onClick={addWebLink}>
                + Web link
              </button>
              <button className={styles.smallBtn} onClick={addFileLink}>
                + Local file
              </button>
            </div>
          </div>

          <div className={styles.editActions}>
            <button className={styles.primaryBtn} onClick={() => setEditing(false)}>
              Done editing
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
