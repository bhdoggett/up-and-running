import { useState } from "react";
import type { Checklist, Task } from "../../types";
import { newId } from "../../types";
import { exportChecklistToHtml, exportChecklistToUar } from "../../exportHtml";
import TaskItem from "../TaskItem/TaskItem";
import styles from "./ChecklistView.module.css";

interface Props {
  checklist: Checklist;
  onChange: (checklist: Checklist) => void;
}

export default function ChecklistView({ checklist, onChange }: Props) {
  const [newTitle, setNewTitle] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");

  const done = checklist.tasks.filter((t) => t.done).length;
  const total = checklist.tasks.length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);

  function startRename() {
    setNameDraft(checklist.name);
    setEditingName(true);
  }
  function commitRename() {
    onChange({ ...checklist, name: nameDraft.trim() || "Untitled checklist" });
    setEditingName(false);
  }

  function updateTask(updated: Task) {
    onChange({
      ...checklist,
      tasks: checklist.tasks.map((t) => (t.id === updated.id ? updated : t)),
    });
  }
  function toggleDone(id: string) {
    onChange({
      ...checklist,
      tasks: checklist.tasks.map((t) =>
        t.id === id ? { ...t, done: !t.done } : t,
      ),
    });
  }
  function deleteTask(id: string) {
    onChange({
      ...checklist,
      tasks: checklist.tasks.filter((t) => t.id !== id),
    });
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
    onChange({ ...checklist, tasks: [...checklist.tasks, task] });
    setNewTitle("");
  }

  const [exportOpen, setExportOpen] = useState(false);

  async function runExport(kind: "html" | "uar") {
    setExportOpen(false);
    try {
      const path =
        kind === "html"
          ? await exportChecklistToHtml(checklist)
          : await exportChecklistToUar(checklist);
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
              <button
                className={styles.titleBtn}
                onClick={startRename}
                title="Click to rename"
              >
                <h1 className={styles.title}>{checklist.name}</h1>
                <svg className={styles.titlePencil} width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M11.5 2.5l2 2L6 12l-2.5.5L4 10l7.5-7.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
                </svg>
              </button>
            )}
            <div className={styles.meta}>
              <span>
                {done} of {total} done
              </span>
              {total > 0 && (
                <span className={styles.bar}>
                  <span className={styles.barFill} style={{ width: `${pct}%` }} />
                </span>
              )}
            </div>
          </div>
          <div className={styles.exportWrap}>
            <button
              className={styles.exportBtn}
              onClick={() => setExportOpen((v) => !v)}
              title="Export this checklist"
            >
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M8 10V2M5 5l3-3 3 3M3 11v2a1 1 0 001 1h8a1 1 0 001-1v-2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Export
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {exportOpen && (
              <>
                <div className={styles.menuBackdrop} onClick={() => setExportOpen(false)} />
                <div className={styles.menu}>
                  <button className={styles.menuItem} onClick={() => runExport("html")}>
                    <strong>Web page (.html)</strong>
                    <span>Read-only, opens in any browser</span>
                  </button>
                  <button className={styles.menuItem} onClick={() => runExport("uar")}>
                    <strong>Checklist file (.uar)</strong>
                    <span>Editable — import into the app elsewhere</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {total === 0 ? (
          <div className={styles.emptyState}>
            <h2>No steps yet</h2>
            <p>Add the first step for this event below.</p>
          </div>
        ) : (
          <ul className={styles.list}>
            {checklist.tasks.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                onToggleDone={() => toggleDone(task.id)}
                onUpdate={updateTask}
                onDelete={() => deleteTask(task.id)}
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
            placeholder="Add a step…"
          />
          <button className={styles.addBtn} onClick={addTask} disabled={!newTitle.trim()}>
            Add
          </button>
        </div>
      </div>

      {toast && <div className={styles.toast}>{toast}</div>}
    </section>
  );
}
