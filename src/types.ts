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

export interface Checklist {
  id: string;
  name: string;
  /** Links/files that apply to the whole checklist (e.g. an overview video). */
  resources: Resource[];
  tasks: Task[];
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
