// Core data model for Up and Running.
// A Checklist is one event-setup guide (e.g. "Sunday Service Setup").
// Each Task is one step; steps expand to show details and tutorial resources.

/**
 * "web" and "file" point outside the app; "doc" and "checklist" are internal
 * links whose target is another item's id, so clicking navigates in-app.
 */
export type ResourceKind = "web" | "file" | "doc" | "checklist";

export interface Resource {
  id: string;
  label: string;
  kind: ResourceKind;
  /**
   * For "web": a URL. For "file": an absolute path on this machine.
   * For "doc"/"checklist": the id of the item being linked to.
   */
  target: string;
  /**
   * Set only inside an export: a base64 data: URI holding the attachment's bytes
   * so it travels with the file. On import it's written back to disk and cleared.
   */
  data?: string;
}

export interface Task {
  id: string;
  title: string;
  /** Longer explanation shown when the task is expanded. Plain text. */
  details: string;
  done: boolean;
  resources: Resource[];
}

/**
 * A named, collapsible group of steps. Every checklist has at least one section;
 * a section with an empty name renders without a header, so simple checklists
 * look like a plain list until the user adds real groups.
 */
export interface Section {
  id: string;
  name: string;
  collapsed: boolean;
  tasks: Task[];
}

export interface Checklist {
  id: string;
  name: string;
  /** Links/files that apply to the whole checklist (e.g. an overview video). */
  resources: Resource[];
  sections: Section[];
  /** Pre-sections format; migrated into `sections` on load/import. */
  tasks?: Task[];
}

/** Every step in the checklist, in display order. */
export function allTasks(checklist: Checklist): Task[] {
  return checklist.sections.flatMap((s) => s.tasks);
}

/** Where a file is referenced, for the Files list in the sidebar. */
export interface FileUse {
  resource: Resource;
  /** Human-readable origin, e.g. "Sunday Service Setup › Power on the board". */
  where: string;
}

/**
 * Every file referenced anywhere in the app — standalone library files plus
 * files attached to checklists, their steps, and docs — deduplicated by path so
 * the same file used in three places shows once.
 */
export function allFiles(state: AppState): FileUse[] {
  const uses: FileUse[] = [];

  for (const r of state.files) {
    if (r.kind === "file") uses.push({ resource: r, where: "Library" });
  }
  for (const c of state.checklists) {
    for (const r of c.resources) {
      if (r.kind === "file") uses.push({ resource: r, where: c.name });
    }
    for (const section of c.sections) {
      for (const t of section.tasks) {
        for (const r of t.resources) {
          if (r.kind === "file") {
            uses.push({ resource: r, where: `${c.name} › ${t.title}` });
          }
        }
      }
    }
  }
  for (const d of state.docs) {
    for (const r of d.resources) {
      if (r.kind === "file") uses.push({ resource: r, where: d.name });
    }
  }

  // Collapse duplicates by path, keeping the first place we saw it.
  const seen = new Map<string, FileUse>();
  for (const use of uses) {
    if (!seen.has(use.resource.target)) seen.set(use.resource.target, use);
  }
  return [...seen.values()];
}

/**
 * Normalize a checklist that may predate sections (or come from an older
 * export): a flat `tasks` array becomes one unnamed section, and missing
 * fields are backfilled so the UI never sees undefined.
 */
export function withSections(c: Checklist): Checklist {
  const sections: Section[] = Array.isArray(c.sections) && c.sections.length > 0
    ? c.sections.map((s) => ({
        id: s.id ?? newId(),
        name: s.name ?? "",
        collapsed: Boolean(s.collapsed),
        tasks: Array.isArray(s.tasks) ? s.tasks : [],
      }))
    : [
        {
          id: newId(),
          name: "",
          collapsed: false,
          tasks: Array.isArray(c.tasks) ? c.tasks : [],
        },
      ];

  return {
    id: c.id,
    name: c.name,
    resources: Array.isArray(c.resources) ? c.resources : [],
    sections,
  };
}

/**
 * A reference page: how something works, a diagram, a policy — anything that
 * explains rather than instructs step by step. Just a Markdown body plus links
 * and files.
 */
export interface Doc {
  id: string;
  name: string;
  body: string;
  resources: Resource[];
}

export type ItemKind = "checklist" | "doc";

/** What the main pane is showing. */
export interface Selection {
  kind: ItemKind;
  id: string;
}

export interface AppState {
  checklists: Checklist[];
  docs: Doc[];
  /** Loose files kept in the library, not tied to any checklist or doc. */
  files: Resource[];
  active: Selection | null;
  /** Pre-docs format; migrated into `active` on load. */
  activeChecklistId?: string | null;
}

export function newId(): string {
  // Available in the Tauri webview (secure context).
  return crypto.randomUUID();
}
