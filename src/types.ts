// Core data model for Up and Running.
// A Checklist is one event-setup guide (e.g. "Sunday Service Setup").
// Each Task is one step; steps expand to show details and tutorial resources.

export type ResourceKind = "web" | "file";

export interface Resource {
  id: string;
  label: string;
  kind: ResourceKind;
  /** For "web": a URL. For "file": an absolute path on this machine. */
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

export interface AppState {
  checklists: Checklist[];
  /** id of the checklist currently shown in the main pane. */
  activeChecklistId: string | null;
}

export function newId(): string {
  // Available in the Tauri webview (secure context).
  return crypto.randomUUID();
}
