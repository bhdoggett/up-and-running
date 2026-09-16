import { useState } from "react";
import type { Checklist, Section } from "../../types";
import { newId, allTasks } from "../../types";
import { exportChecklistToHtml } from "../../exportHtml";
import { useNameMap } from "../../library";
import { acceptDrop, type Drag, type DropTarget } from "../../dragState";
import { moveTask, moveSection } from "../../reorder";
import SectionBlock from "../SectionBlock/SectionBlock";
import ResourceList from "../ResourceList/ResourceList";
import MarkdownView from "../MarkdownView/MarkdownView";
import MarkdownEditor from "../MarkdownEditor/MarkdownEditor";
import { resolveAppImage, openLink } from "../../appLinks";
import styles from "./ChecklistView.module.css";

interface Props {
  checklist: Checklist;
  onChange: (checklist: Checklist) => void;
}

export default function ChecklistView({ checklist, onChange }: Props) {
  const [toast, setToast] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [drag, setDrag] = useState<Drag>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget>(null);
  const [editingDesc, setEditingDesc] = useState(false);
  const names = useNameMap();

  const hasDescription = checklist.description.trim() !== "";

  const tasks = allTasks(checklist);
  const done = tasks.filter((t) => t.done).length;
  const total = tasks.length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);

  // A single unnamed section is the "no sections yet" state: render it bare.
  const showHeaders =
    checklist.sections.length > 1 || checklist.sections[0]?.name.trim() !== "";

  function startRename() {
    setNameDraft(checklist.name);
    setEditingName(true);
  }
  function commitRename() {
    onChange({ ...checklist, name: nameDraft.trim() || "Untitled checklist" });
    setEditingName(false);
  }

  function updateSection(updated: Section) {
    onChange({
      ...checklist,
      sections: checklist.sections.map((s) => (s.id === updated.id ? updated : s)),
    });
  }

  function deleteSection(id: string) {
    const remaining = checklist.sections.filter((s) => s.id !== id);
    onChange({
      ...checklist,
      // Never leave zero sections — fall back to one empty unnamed group.
      sections: remaining.length
        ? remaining
        : [{ id: newId(), name: "", collapsed: false, tasks: [] }],
    });
  }

  function addSection() {
    const section: Section = {
      id: newId(),
      name: `Section ${checklist.sections.length + 1}`,
      collapsed: false,
      tasks: [],
    };
    onChange({ ...checklist, sections: [...checklist.sections, section] });
  }

  // Reordering rules live in src/reorder.ts so they can be tested directly.
  function handleMoveTask(
    taskId: string,
    fromSectionId: string,
    toSectionId: string,
    beforeTaskId: string | null,
  ) {
    onChange(moveTask(checklist, taskId, fromSectionId, toSectionId, beforeTaskId));
  }

  function handleMoveSection(sectionId: string, beforeSectionId: string | null) {
    onChange(moveSection(checklist, sectionId, beforeSectionId));
  }

  function setAllUnchecked() {
    onChange({
      ...checklist,
      sections: checklist.sections.map((s) => ({
        ...s,
        tasks: s.tasks.map((t) => (t.done ? { ...t, done: false } : t)),
      })),
    });
  }

  function setAllCollapsed(collapsed: boolean) {
    onChange({
      ...checklist,
      sections: checklist.sections.map((s) => ({ ...s, collapsed })),
    });
  }

  async function runExport() {
    try {
      const path = await exportChecklistToHtml(checklist, names);
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
              <div className={styles.titleRow}>
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
                {/* Sits beside the name so it reads as part of the title area. */}
                {!hasDescription && !editingDesc && (
                  <button
                    className={styles.addDesc}
                    onClick={() => setEditingDesc(true)}
                    title="Add an intro or summary"
                  >
                    + Description
                  </button>
                )}
              </div>
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
              {/* Reset for the next time the checklist is run. */}
              {done > 0 && (
                <button
                  className={styles.uncheckAll}
                  onClick={setAllUnchecked}
                  title="Clear every checkbox in this checklist"
                >
                  Uncheck all
                </button>
              )}
            </div>
            <ResourceList
              resources={checklist.resources}
              onChange={(resources) => onChange({ ...checklist, resources })}
            />
          </div>
          {/* One artefact per item: a read-only web page. Editable bundles are
              .uar, and those are whole projects. */}
          <button
            className={styles.exportBtn}
            onClick={runExport}
            title="Export as a web page anyone can open"
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M8 10V2M5 5l3-3 3 3M3 11v2a1 1 0 001 1h8a1 1 0 001-1v-2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Export HTML
          </button>
        </div>

        {editingDesc ? (
          <div className={styles.descEdit}>
            <MarkdownEditor
              value={checklist.description}
              onChange={(description) => onChange({ ...checklist, description })}
              placeholder="An intro or summary for this checklist… (Markdown supported)"
            />
            <div className={styles.descActions}>
              <button className={styles.ghostBtn} onClick={() => setEditingDesc(false)}>
                Done
              </button>
            </div>
          </div>
        ) : (
          hasDescription && (
            <div className={styles.description}>
              <MarkdownView
                content={checklist.description}
                resolveImage={resolveAppImage}
                onLinkClick={openLink}
              />
              <button
                className={styles.descEditBtn}
                onClick={() => setEditingDesc(true)}
                title="Edit description"
                aria-label="Edit description"
              >
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                  <path d="M11.5 2.5l2 2L6 12l-2.5.5L4 10l7.5-7.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          )
        )}

        {checklist.sections.map((section) => (
          <SectionBlock
            key={section.id}
            section={section}
            showHeader={showHeaders}
            onChange={updateSection}
            onDelete={() => deleteSection(section.id)}
            drag={drag}
            setDrag={setDrag}
            dropTarget={dropTarget}
            setDropTarget={setDropTarget}
            onMoveTask={handleMoveTask}
            onMoveSection={handleMoveSection}
          />
        ))}

        {/* Without this, the last position is unreachable: every other drop
            target inserts *before* a section. */}
        {drag?.type === "section" && (
          <div
            className={`${styles.tailZone} ${
              dropTarget?.type === "section" && dropTarget.beforeSectionId === null
                ? styles.tailActive
                : ""
            }`}
            onDragOver={(e) => {
              acceptDrop(e);
              setDropTarget({ type: "section", beforeSectionId: null });
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleMoveSection(drag.sectionId, null);
              setDrag(null);
              setDropTarget(null);
            }}
          >
            Move to the end
          </div>
        )}

        <div className={styles.sectionActions}>
          <button className={styles.ghostBtn} onClick={addSection}>
            + Add section
          </button>
          {showHeaders && checklist.sections.length > 1 && (
            <>
              <button className={styles.ghostBtn} onClick={() => setAllCollapsed(true)}>
                Collapse all
              </button>
              <button className={styles.ghostBtn} onClick={() => setAllCollapsed(false)}>
                Expand all
              </button>
            </>
          )}
        </div>
      </div>

      {toast && <div className={styles.toast}>{toast}</div>}
    </section>
  );
}
