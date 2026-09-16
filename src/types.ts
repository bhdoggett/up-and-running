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
   * For "file": a hash of the contents, so the same file added twice — once
   * through the picker, once by dropping it — is recognised as one file even
   * though the two routes produce different paths.
   */
  hash?: string;
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
  /** Optional Markdown intro shown above the steps; hidden when empty. */
  description: string;
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
export function allFiles(project: Project): FileUse[] {
  const uses: FileUse[] = [];

  for (const r of project.files) {
    if (r.kind === "file") uses.push({ resource: r, where: "Project" });
  }
  for (const c of project.checklists) {
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
  for (const d of project.docs) {
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
    description: typeof c.description === "string" ? c.description : "",
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

/**
 * An umbrella for everything belonging to one event or effort: its checklists,
 * reference docs, and files. A project is the unit that exports as a .uar
 * bundle, so links between its items survive the trip to another machine.
 */
export interface Project {
  id: string;
  name: string;
  checklists: Checklist[];
  docs: Doc[];
  /** Files kept in the project, not tied to a specific checklist or doc. */
  files: Resource[];
}

export interface AppState {
  projects: Project[];
  activeProjectId: string | null;
  active: Selection | null;
  /** Pre-projects format; migrated into `projects` on load. */
  checklists?: Checklist[];
  docs?: Doc[];
  files?: Resource[];
  activeChecklistId?: string | null;
}

export function newId(): string {
  // Available in the Tauri webview (secure context).
  return crypto.randomUUID();
}

/** Fill in any missing pieces of a project (also used when importing one). */
export function normalizeProject(p: Partial<Project>): Project {
  return {
    id: p.id ?? newId(),
    name: typeof p.name === "string" && p.name.trim() ? p.name : "Untitled project",
    checklists: Array.isArray(p.checklists) ? p.checklists.map(withSections) : [],
    docs: Array.isArray(p.docs)
      ? p.docs.map((d) => ({
          id: d.id ?? newId(),
          name: d.name ?? "Untitled doc",
          body: typeof d.body === "string" ? d.body : "",
          resources: Array.isArray(d.resources) ? d.resources : [],
        }))
      : [],
    files: Array.isArray(p.files) ? p.files : [],
  };
}

/**
 * Bring saved state up to date. Anything from before projects existed becomes
 * the contents of one starter project, so nothing is lost or re-homed by hand.
 */
export function migrateState(saved: AppState): AppState {
  const projects = Array.isArray(saved.projects) && saved.projects.length > 0
    ? saved.projects.map(normalizeProject)
    : [
        normalizeProject({
          name: "My library",
          checklists: saved.checklists ?? [],
          docs: saved.docs ?? [],
          files: saved.files ?? [],
        }),
      ];

  const activeProjectId =
    projects.find((p) => p.id === saved.activeProjectId)?.id ?? projects[0].id;

  const active =
    saved.active ??
    (saved.activeChecklistId
      ? { kind: "checklist" as const, id: saved.activeChecklistId }
      : null);

  return { projects, activeProjectId, active };
}
