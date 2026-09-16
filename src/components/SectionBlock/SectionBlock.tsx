import { useEffect, useRef, useState } from "react";
import { confirm } from "@tauri-apps/plugin-dialog";
import type { Section, Task } from "../../types";
import { newId } from "../../types";
import TaskItem from "../TaskItem/TaskItem";
import { acceptDrop, type Drag, type DropTarget } from "../../dragState";
import styles from "./SectionBlock.module.css";

interface Props {
  section: Section;
  /** An unnamed lone section renders headerless, like a plain list. */
  showHeader: boolean;
  /** Last section in the checklist — enables the "drop below to append" half. */
  isLast: boolean;
  /** Number of the first step here; steps count on across sections. */
  startNumber: number;
  onChange: (section: Section) => void;
  onDelete: () => void;
  drag: Drag;
  setDrag: (d: Drag) => void;
  dropTarget: DropTarget;
  setDropTarget: (t: DropTarget) => void;
  onMoveTask: (
    taskId: string,
    fromSectionId: string,
    toSectionId: string,
    beforeTaskId: string | null,
  ) => void;
  onMoveSection: (sectionId: string, beforeSectionId: string | null) => void;
}

export default function SectionBlock({
  section,
  showHeader,
  isLast,
  startNumber,
  onChange,
  onDelete,
  drag,
  setDrag,
  dropTarget,
  setDropTarget,
  onMoveTask,
  onMoveSection,
}: Props) {
  const listRef = useRef<HTMLUListElement>(null);
  const [newTitle, setNewTitle] = useState("");
  const [justAddedId, setJustAddedId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");

  const done = section.tasks.filter((t) => t.done).length;
  const total = section.tasks.length;
  const collapsed = showHeader && section.collapsed;
  const allDone = total > 0 && done === total;

  // "Some but not all" has no HTML attribute — it has to be set on the node.
  const checkAll = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (checkAll.current) {
      checkAll.current.indeterminate = done > 0 && done < total;
    }
  }, [done, total]);

  function setAllDone(value: boolean) {
    setTasks(section.tasks.map((t) => ({ ...t, done: value })));
  }

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

  const draggingThisSection = drag?.type === "section" && drag.sectionId === section.id;

  /**
   * Where a section dropped on this header should land. Below the midpoint of
   * the last header means "after it" (null), so dragging downwards past the
   * end does the obvious thing instead of doing nothing.
   */
  function sectionTargetAt(e: React.DragEvent): string | null {
    if (!isLast) return section.id;
    const box = e.currentTarget.getBoundingClientRect();
    return e.clientY > box.top + box.height / 2 ? null : section.id;
  }

  // One handler for the whole list: work out the insertion point from the
  // pointer's position against each card's midpoint. Hit-testing individual
  // cards made the indicator flicker whenever the pointer crossed a gap.
  function listDragOver(e: React.DragEvent) {
    if (drag?.type !== "task") return;
    acceptDrop(e);
    const cards = Array.from(listRef.current?.children ?? []) as HTMLElement[];
    let beforeTaskId: string | null = null;
    for (const card of cards) {
      const box = card.getBoundingClientRect();
      if (e.clientY < box.top + box.height / 2) {
        beforeTaskId = card.dataset.taskId ?? null;
        break;
      }
    }
    setDropTarget({ type: "task", sectionId: section.id, beforeTaskId });
  }

  function listDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (drag?.type === "task") {
      const before =
        dropTarget?.type === "task" && dropTarget.sectionId === section.id
          ? dropTarget.beforeTaskId
          : null;
      onMoveTask(drag.taskId, drag.fromSectionId, section.id, before);
    }
    setDrag(null);
    setDropTarget(null);
  }

  const sectionLine =
    dropTarget?.type === "section" && dropTarget.beforeSectionId === section.id;
  const endLine =
    dropTarget?.type === "task" &&
    dropTarget.sectionId === section.id &&
    dropTarget.beforeTaskId === null;

  return (
    <section
      className={`${styles.section} ${draggingThisSection ? styles.dragging : ""} ${sectionLine ? styles.sectionLine : ""}`}
      onDragOver={(e) => {
        // Outside the list (header, add-step row) means "put it at the end".
        if (drag?.type === "task") {
          acceptDrop(e);
          setDropTarget({ type: "task", sectionId: section.id, beforeTaskId: null });
        }
      }}
      onDrop={listDrop}
    >
      {showHeader && (
        <div
          className={styles.head}
          onDragOver={(e) => {
            if (drag?.type !== "section") return;
            acceptDrop(e);
            setDropTarget({ type: "section", beforeSectionId: sectionTargetAt(e) });
          }}
          onDrop={(e) => {
            if (drag?.type !== "section") return;
            e.preventDefault();
            e.stopPropagation();
            onMoveSection(drag.sectionId, sectionTargetAt(e));
            setDrag(null);
            setDropTarget(null);
          }}
        >
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
              <span
                className={styles.grip}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", section.id);
                  setDrag({ type: "section", sectionId: section.id });
                }}
                onDragEnd={() => {
                  setDrag(null);
                  setDropTarget(null);
                }}
                title="Drag to reorder section"
                aria-label="Drag to reorder section"
              >
                <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor" aria-hidden="true">
                  <circle cx="3" cy="3" r="1.2" /><circle cx="7" cy="3" r="1.2" />
                  <circle cx="3" cy="7" r="1.2" /><circle cx="7" cy="7" r="1.2" />
                  <circle cx="3" cy="11" r="1.2" /><circle cx="7" cy="11" r="1.2" />
                </svg>
              </span>
              <input
                ref={checkAll}
                type="checkbox"
                className={styles.checkAll}
                checked={allDone}
                disabled={total === 0}
                onChange={() => setAllDone(!allDone)}
                title={allDone ? "Uncheck every step here" : "Check every step here"}
                aria-label={`Mark all steps in ${section.name || "this section"}`}
              />
              {/* The name is the rename control; only the arrow collapses. */}
              <div className={styles.titleGroup}>
                <button
                  className={styles.nameBtn}
                  onClick={startRename}
                  title="Click to rename"
                >
                  <span className={styles.name}>{section.name}</span>
                </button>
                <button
                  className={styles.chevronBtn}
                  onClick={() => onChange({ ...section, collapsed: !section.collapsed })}
                  aria-expanded={!section.collapsed}
                  title={section.collapsed ? "Expand section" : "Collapse section"}
                  aria-label={section.collapsed ? "Expand section" : "Collapse section"}
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
                </button>
              </div>
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
              {/* Last in the row so it sits flush right, clear of the controls. */}
              <span
                className={`${styles.count} ${total > 0 && done === total ? styles.complete : ""}`}
              >
                {done}/{total}
              </span>
            </>
          )}
        </div>
      )}

      {!collapsed && (
        <>
          {total === 0 ? (
            <p className={styles.empty}>No steps in this section yet.</p>
          ) : (
            <ul
              className={styles.list}
              ref={listRef}
              onDragOver={listDragOver}
              onDrop={listDrop}
            >
              {section.tasks.map((task, i) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  number={startNumber + i}
                  autoEdit={task.id === justAddedId}
                  dragging={drag?.type === "task" && drag.taskId === task.id}
                  dropLine={
                    dropTarget?.type === "task" &&
                    dropTarget.sectionId === section.id &&
                    dropTarget.beforeTaskId === task.id
                  }
                  onDragStart={() =>
                    setDrag({ type: "task", taskId: task.id, fromSectionId: section.id })
                  }
                  onDragEnd={() => {
                    setDrag(null);
                    setDropTarget(null);
                  }}
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

          {/* Insertion line for "drop at the end of this section". */}
          {endLine && <div className={styles.endLine} />}

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
