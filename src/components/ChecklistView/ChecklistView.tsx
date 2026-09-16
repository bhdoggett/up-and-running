import { useState } from "react";
import type { Checklist, Section } from "../../types";
import { newId, allTasks } from "../../types";
import { exportChecklistToHtml, exportChecklistToUar } from "../../exportHtml";
import { useNameMap } from "../../library";
import type { Drag, DropTarget } from "../../dragState";
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

  // --- reordering -------------------------------------------------------
  // Tasks can move within a section or across sections; sections reorder among
  // themselves. Insertion is always "before the drop target", with a trailing
  // zone at the end of each list to append.
  function moveTask(
    taskId: string,
    fromSectionId: string,
    toSectionId: string,
    beforeTaskId: string | null,
  ) {
    // Dropping a task on itself is a no-op; without this it would be removed
    // and then appended to the end.
    if (taskId === beforeTaskId) return;
    const from = checklist.sections.find((s) => s.id === fromSectionId);
    const task = from?.tasks.find((t) => t.id === taskId);
    if (!task) return;

    const sections = checklist.sections.map((s) =>
      s.id === fromSectionId ? { ...s, tasks: s.tasks.filter((t) => t.id !== taskId) } : s,
    );

    onChange({
      ...checklist,
      sections: sections.map((s) => {
        if (s.id !== toSectionId) return s;
        const tasks = [...s.tasks];
        const at = beforeTaskId
          ? tasks.findIndex((t) => t.id === beforeTaskId)
          : tasks.length;
        tasks.splice(at === -1 ? tasks.length : at, 0, task);
        return { ...s, tasks };
      }),
    });
  }

  function moveSection(sectionId: string, beforeSectionId: string | null) {
    const current = checklist.sections;
    const moving = current.find((s) => s.id === sectionId);
    if (!moving || sectionId === beforeSectionId) return;
    const rest = current.filter((s) => s.id !== sectionId);
    const at = beforeSectionId
      ? rest.findIndex((s) => s.id === beforeSectionId)
      : rest.length;
    rest.splice(at === -1 ? rest.length : at, 0, moving);
    onChange({ ...checklist, sections: rest });
  }

  function setAllCollapsed(collapsed: boolean) {
    onChange({
      ...checklist,
      sections: checklist.sections.map((s) => ({ ...s, collapsed })),
    });
  }

  const [exportOpen, setExportOpen] = useState(false);

  async function runExport(kind: "html" | "uar") {
    setExportOpen(false);
    try {
      const path =
        kind === "html"
          ? await exportChecklistToHtml(checklist, names)
          : await exportChecklistToUar(checklist, names);
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
            <ResourceList
              resources={checklist.resources}
              onChange={(resources) => onChange({ ...checklist, resources })}
            />
            {/* The description only takes up space once it has content. */}
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
            onMoveTask={moveTask}
            onMoveSection={moveSection}
          />
        ))}

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
