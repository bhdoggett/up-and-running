import { useState } from "react";
import type { Checklist, Section } from "../../types";
import { newId, allTasks } from "../../types";
import { exportChecklistToHtml } from "../../exportHtml";
import { useNameMap } from "../../library";
import { acceptDrop, type Drag, type DropTarget } from "../../dragState";
import { isCommandEnter } from "../../keys";
import { setImageWidth } from "../../images";
import { moveTask, moveSection } from "../../reorder";
import { NO_PULSE, type ExpandPulse } from "../../viewState";
import SectionBlock from "../SectionBlock/SectionBlock";
import ResourceList from "../ResourceList/ResourceList";
import MarkdownView from "../MarkdownView/MarkdownView";
import MarkdownEditor from "../MarkdownEditor/MarkdownEditor";
import { resolveAppImage, openMarkdownLink } from "../../appLinks";
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
  // One editor at a time across the whole checklist, so a long list can't end
  // up with half a dozen editors open behind each other.
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [pulse, setPulse] = useState<ExpandPulse>(NO_PULSE);
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

  // Collapses/expands sections *and* every step's details, so "expand all"
  // means all of it rather than just the section headers.
  function setAllCollapsed(collapsed: boolean) {
    onChange({
      ...checklist,
      sections: checklist.sections.map((s) => ({ ...s, collapsed })),
    });
    setPulse((p) => ({ count: p.count + 1, open: !collapsed }));
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
              </div>
            )}
            <div className={styles.meta}>
              <span>
                {done} of {total} done
              </span>
              {/* One dash per step, like a cue strip — you can see how many
                  steps there are, not just how far along you are. Past a point
                  the dashes would be sub-pixel, so it falls back to a bar. */}
              {total > 0 &&
                (total <= 40 ? (
                  <span className={styles.ticks}>
                    {tasks.map((t) => (
                      <span
                        key={t.id}
                        className={`${styles.tick} ${t.done ? styles.tickDone : ""}`}
                      />
                    ))}
                  </span>
                ) : (
                  <span className={styles.bar}>
                    <span className={styles.barFill} style={{ width: `${pct}%` }} />
                  </span>
                ))}
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
              {/* Whole-checklist controls, together at the top rather than
                  stranded past the last section. */}
              {total > 0 && (
                <>
                  <button
                    className={styles.uncheckAll}
                    onClick={() => setAllCollapsed(true)}
                    title="Close every section and step"
                  >
                    Collapse all
                  </button>
                  <button
                    className={styles.uncheckAll}
                    onClick={() => setAllCollapsed(false)}
                    title="Open every section and step"
                  >
                    Expand all
                  </button>
                </>
              )}
            </div>
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
          <div
            className={styles.descEdit}
            onKeyDown={(e) => {
              if (!isCommandEnter(e)) return;
              e.preventDefault();
              setEditingDesc(false);
            }}
          >
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
                onLinkClick={openMarkdownLink}
                onImageResize={(target, width) =>
                  onChange({
                    ...checklist,
                    description: setImageWidth(checklist.description, target, width),
                  })
                }
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

        {/* Below the description: the intro reads first, then what it points
            you at. */}
        <div className={styles.resourceRow}>
          <ResourceList
            resources={checklist.resources}
            onChange={(resources) => onChange({ ...checklist, resources })}
          />
        </div>

        {checklist.sections.map((section, index) => (
          <SectionBlock
            key={section.id}
            section={section}
            showHeader={showHeaders}
            isLast={index === checklist.sections.length - 1}
            // Steps are numbered continuously, so "step 7 of 32" means something
            // whichever section it happens to sit in.
            startNumber={
              checklist.sections
                .slice(0, index)
                .reduce((n, s) => n + s.tasks.length, 0) + 1
            }
            onChange={updateSection}
            onDelete={() => deleteSection(section.id)}
            drag={drag}
            setDrag={setDrag}
            dropTarget={dropTarget}
            setDropTarget={setDropTarget}
            pulse={pulse}
            editingTaskId={editingTaskId}
            setEditingTaskId={setEditingTaskId}
            onMoveTask={handleMoveTask}
            onMoveSection={handleMoveSection}
          />
        ))}

        {/* Without this, the last position is unreachable: every other drop
            target inserts *before* a section. It is always in the DOM — a zone
            created mid-drag isn't reliably registered as a drop target — and
            only takes up space while a section is in flight. */}
        <div
          className={[
            styles.tailZone,
            drag?.type === "section" ? styles.tailReady : "",
            dropTarget?.type === "section" && dropTarget.beforeSectionId === null
              ? styles.tailActive
              : "",
          ].join(" ")}
          onDragOver={(e) => {
            if (drag?.type !== "section") return;
            acceptDrop(e);
            setDropTarget({ type: "section", beforeSectionId: null });
          }}
          onDrop={(e) => {
            if (drag?.type !== "section") return;
            e.preventDefault();
            e.stopPropagation();
            handleMoveSection(drag.sectionId, null);
            setDrag(null);
            setDropTarget(null);
          }}
        />

        <div className={styles.sectionActions}>
          <button className={styles.ghostBtn} onClick={addSection}>
            + Add section
          </button>
        </div>
      </div>

      {toast && <div className={styles.toast}>{toast}</div>}
    </section>
  );
}
