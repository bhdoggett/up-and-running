import { useState } from "react";
import { confirm } from "@tauri-apps/plugin-dialog";
import type { Section, Task } from "../../types";
import { newId } from "../../types";
import TaskItem from "../TaskItem/TaskItem";
import styles from "./SectionBlock.module.css";

interface Props {
  section: Section;
  /** An unnamed lone section renders headerless, like a plain list. */
  showHeader: boolean;
  onChange: (section: Section) => void;
  onDelete: () => void;
}

export default function SectionBlock({
  section,
  showHeader,
  onChange,
  onDelete,
}: Props) {
  const [newTitle, setNewTitle] = useState("");
  const [justAddedId, setJustAddedId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");

  const done = section.tasks.filter((t) => t.done).length;
  const total = section.tasks.length;
  const collapsed = showHeader && section.collapsed;

  function setTasks(tasks: Task[]) {
    onChange({ ...section, tasks });
  }

  function addTask() {
    const title = newTitle.trim();
    if (!title) return;
    const task: Task = {
      id: newId(),
      title,
      details: "",
      done: false,
      resources: [],
    };
    setTasks([...section.tasks, task]);
    setJustAddedId(task.id);
    setNewTitle("");
  }

  function startRename() {
    setNameDraft(section.name);
    setEditingName(true);
  }
  function commitRename() {
    onChange({ ...section, name: nameDraft.trim() || "Untitled section" });
    setEditingName(false);
  }

  async function requestDelete() {
    if (section.tasks.length > 0) {
      const ok = await confirm(
        `“${section.name || "This section"}” has ${section.tasks.length} step${section.tasks.length === 1 ? "" : "s"}. Delete the section and its steps?`,
        { title: "Delete section", kind: "warning", okLabel: "Delete", cancelLabel: "Cancel" },
      );
      if (!ok) return;
    }
    onDelete();
  }

  return (
    <section className={styles.section}>
      {showHeader && (
        <div className={styles.head}>
          {editingName ? (
            <input
              className={styles.nameInput}
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
            <>
              <button
                className={styles.toggle}
                onClick={() => onChange({ ...section, collapsed: !section.collapsed })}
                aria-expanded={!section.collapsed}
                title={section.collapsed ? "Expand section" : "Collapse section"}
              >
                <svg
                  className={`${styles.chevron} ${section.collapsed ? "" : styles.open}`}
                  width="11"
                  height="11"
                  viewBox="0 0 12 12"
                  fill="none"
                  aria-hidden="true"
                >
                  <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className={styles.name}>{section.name}</span>
              </button>
              <span
                className={`${styles.count} ${total > 0 && done === total ? styles.complete : ""}`}
              >
                {done}/{total}
              </span>
              <button
                className={styles.iconBtn}
                onClick={startRename}
                title="Rename section"
                aria-label="Rename section"
              >
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                  <path d="M11.5 2.5l2 2L6 12l-2.5.5L4 10l7.5-7.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
                </svg>
              </button>
              <button
                className={`${styles.iconBtn} ${styles.danger}`}
                onClick={requestDelete}
                title="Delete section"
                aria-label="Delete section"
              >
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                  <path d="M3 4h10M6.5 4V3h3v1M4.5 4l.5 9h6l.5-9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </>
          )}
        </div>
      )}

      {!collapsed && (
        <>
          {total === 0 ? (
            <p className={styles.empty}>No steps in this section yet.</p>
          ) : (
            <ul className={styles.list}>
              {section.tasks.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  autoEdit={task.id === justAddedId}
                  onToggleDone={() =>
                    setTasks(
                      section.tasks.map((t) =>
                        t.id === task.id ? { ...t, done: !t.done } : t,
                      ),
                    )
                  }
                  onUpdate={(updated) =>
                    setTasks(
                      section.tasks.map((t) => (t.id === updated.id ? updated : t)),
                    )
                  }
                  onDelete={() =>
                    setTasks(section.tasks.filter((t) => t.id !== task.id))
                  }
                />
              ))}
            </ul>
          )}

          <div className={styles.addTask}>
            <input
              className={styles.addInput}
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTask()}
              placeholder={showHeader ? `Add a step to ${section.name}…` : "Add a step…"}
            />
            <button className={styles.addBtn} onClick={addTask} disabled={!newTitle.trim()}>
              Add
            </button>
          </div>
        </>
      )}
    </section>
  );
}
