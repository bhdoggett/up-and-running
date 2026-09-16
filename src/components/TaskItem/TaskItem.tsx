import { useState } from "react";
import type { Resource, Task } from "../../types";
import MarkdownView from "../MarkdownView/MarkdownView";
import MarkdownEditor from "../MarkdownEditor/MarkdownEditor";
import ResourceList from "../ResourceList/ResourceList";
import { resolveAppImage, openLink } from "../../appLinks";
import { useLibrary, useResourceLabel, isInternal } from "../../library";
import styles from "./TaskItem.module.css";

interface Props {
  task: Task;
  onToggleDone: () => void;
  onUpdate: (task: Task) => void;
  onDelete: () => void;
  /** Start in edit mode (used for freshly-added steps). */
  autoEdit?: boolean;
  dragging?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
}

export default function TaskItem({
  task,
  onToggleDone,
  onUpdate,
  onDelete,
  autoEdit = false,
  dragging = false,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: Props) {
  const [handleHeld, setHandleHeld] = useState(false);
  const [expanded, setExpanded] = useState(autoEdit);
  const [editing, setEditing] = useState(autoEdit);
  const { navigate } = useLibrary();
  const labelFor = useResourceLabel();

  const hasBody = task.details.trim() !== "" || task.resources.length > 0;

  function openResource(r: Resource) {
    if (isInternal(r.kind)) {
      navigate({ kind: r.kind as "doc" | "checklist", id: r.target });
    } else {
      openLink(r.target);
    }
  }

  function patch(changes: Partial<Task>) {
    onUpdate({ ...task, ...changes });
  }

  return (
    <li
      className={`${styles.item} ${task.done ? styles.done : ""} ${dragging ? styles.dragging : ""}`}
      // Only the grip starts a drag, so text selection inside the card still works.
      draggable={handleHeld}
      onDragStart={() => onDragStart?.()}
      onDragEnd={() => {
        setHandleHeld(false);
        onDragEnd?.();
      }}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div className={styles.head}>
        <span
          className={styles.grip}
          onMouseDown={() => setHandleHeld(true)}
          onMouseUp={() => setHandleHeld(false)}
          title="Drag to reorder step"
          aria-label="Drag to reorder step"
        >
          <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor" aria-hidden="true">
            <circle cx="3" cy="3" r="1.2" /><circle cx="7" cy="3" r="1.2" />
            <circle cx="3" cy="7" r="1.2" /><circle cx="7" cy="7" r="1.2" />
            <circle cx="3" cy="11" r="1.2" /><circle cx="7" cy="11" r="1.2" />
          </svg>
        </span>
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
                  <button
                    className={`${styles.resLink} ${isInternal(r.kind) ? styles.internal : ""}`}
                    onClick={() => openResource(r)}
                    title={isInternal(r.kind) ? `Open ${r.kind}` : r.target}
                  >
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      {r.kind === "web" ? (
                        <path d="M8 1a7 7 0 100 14A7 7 0 008 1zM1.5 8h13M8 1.5c1.7 1.6 2.6 3.9 2.6 6.5S9.7 12.9 8 14.5C6.3 12.9 5.4 10.6 5.4 8S6.3 3.1 8 1.5z" stroke="currentColor" strokeWidth="1.1" />
                      ) : r.kind === "file" ? (
                        <path d="M4.5 2.5h4l3 3v8h-7v-11zM8.5 2.5v3h3" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
                      ) : (
                        <path d="M6.5 9.5l3-3M5 8L3.5 9.5a2.1 2.1 0 003 3L8 11M11 8l1.5-1.5a2.1 2.1 0 00-3-3L8 5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
                      )}
                    </svg>
                    {labelFor(r)}
                    <span className={styles.resKind}>
                      {r.kind === "web" ? "↗" : r.kind === "file" ? "· file" : `· ${r.kind}`}
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
              autoFocus={autoEdit}
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
            <div className={styles.label}>Links, files &amp; related items</div>
            <ResourceList
              resources={task.resources}
              onChange={(resources) => patch({ resources })}
            />
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
