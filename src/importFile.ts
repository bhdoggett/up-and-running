import { open } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeFile, mkdir } from "@tauri-apps/plugin-fs";
import { appDataDir, join } from "@tauri-apps/api/path";
import type { Checklist, Doc, Project, Resource, Task } from "./types";
import { newId, withSections, normalizeProject } from "./types";
import {
  dataImageName,
  dataImageSources,
  markdownImageAlts,
  markdownImageSources,
  rewriteImageSources,
  saveImage,
} from "./images";

function bytesFromDataUri(uri: string): Uint8Array {
  const comma = uri.indexOf(",");
  const bin = atob(uri.slice(comma + 1));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function basename(path: string): string {
  return path.split(/[\\/]/).pop() || "attachment";
}

// Pull the embedded JSON payload out of an exported HTML file.
function extractPayloadFromHtml(html: string): unknown {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const el = doc.getElementById("uar-data");
  if (!el?.textContent) {
    throw new Error("This HTML file has no embedded checklist data.");
  }
  return JSON.parse(el.textContent);
}

function asChecklist(raw: unknown): Checklist {
  const c = raw as Checklist;
  // Accept both shapes: `sections` (current) or a flat `tasks` array (older
  // exports, and what an LLM may produce from the simpler example).
  const hasSteps = Array.isArray(c?.sections) || Array.isArray(c?.tasks);
  if (!raw || typeof raw !== "object" || !hasSteps || typeof c.name !== "string") {
    throw new Error(
      "That doesn't look like a checklist — it needs a \"name\" and a \"sections\" or \"tasks\" list.",
    );
  }
  return c;
}

/** The attachments folder, made only when something in the bundle needs it. */
async function attachmentsDirFor(resources: Resource[]): Promise<string | null> {
  if (!resources.some((r) => typeof r.data === "string")) return null;
  const dir = await join(await appDataDir(), "attachments");
  await mkdir(dir, { recursive: true });
  return dir;
}

// Regenerate a resource's id and, if it carries bundled bytes, write them to a
// real file under `dir` so the OS can open it (clearing the `data` field).
async function restoreResource(r: Resource, dir: string | null): Promise<Resource> {
  const base: Resource = { id: newId(), label: r.label, kind: r.kind, target: r.target };
  if (typeof r.data === "string" && dir) {
    try {
      const dest = await join(dir, `${newId()}-${basename(r.target)}`);
      await writeFile(dest, bytesFromDataUri(r.data));
      return { ...base, target: dest };
    } catch (e) {
      console.error("Could not restore attachment", r.label, e);
    }
  }
  return base;
}

/**
 * An imported bundle carries its pictures inline, as base64. Write them back
 * into the image folder and point the Markdown at them, so a project that has
 * been through an export reads exactly like one made here: short references,
 * one copy per picture however many places use it, and a saved state that
 * isn't carrying image blobs around on every keystroke.
 *
 * A picture that can't be written keeps its inline copy — it still displays,
 * which beats losing it.
 */
async function restoreMarkdownImages(text: string): Promise<string> {
  const uris = dataImageSources(text);
  if (uris.length === 0) return text;

  const alts = markdownImageAlts(text);
  const sources = markdownImageSources(text);
  const map = new Map<string, string>();

  for (const [i, uri] of uris.entries()) {
    if (map.has(uri)) continue; // the same picture used twice
    try {
      const alt = alts[sources.indexOf(uri)] ?? "";
      map.set(uri, await saveImage(bytesFromDataUri(uri), dataImageName(uri, alt, i)));
    } catch (e) {
      console.error("Could not restore an image from the bundle", e);
    }
  }
  return rewriteImageSources(text, map);
}

// Turn validated raw data into a new, ready-to-use checklist: fresh ids,
// progress reset, bundled attachments written back to disk. Shared by every
// import path (file, pasted JSON, AI-assisted).
async function buildImportedChecklist(raw: unknown): Promise<Checklist> {
  // withSections also accepts the older flat-`tasks` shape, so exports from
  // before sections (and LLM output using either form) import cleanly.
  const checklist = withSections(asChecklist(raw));
  const resourceLists = [
    checklist.resources,
    ...checklist.sections.flatMap((s) => s.tasks.map((t) => t.resources ?? [])),
  ];

  const dir = await attachmentsDirFor(resourceLists.flat());

  return {
    id: newId(),
    name: checklist.name,
    description: await restoreMarkdownImages(checklist.description ?? ""),
    resources: await Promise.all(
      checklist.resources.map((r) => restoreResource(r, dir)),
    ),
    sections: await Promise.all(
      checklist.sections.map(async (section) => ({
        id: newId(),
        name: section.name ?? "",
        collapsed: Boolean(section.collapsed),
        tasks: await Promise.all(
          section.tasks.map(async (task): Promise<Task> => ({
            id: newId(),
            title: task.title,
            details: await restoreMarkdownImages(task.details ?? ""),
            done: false,
            resources: await Promise.all(
              (task.resources ?? []).map((r) => restoreResource(r, dir)),
            ),
          })),
        ),
      })),
    ),
  };
}

function isDocPayload(raw: unknown): boolean {
  const r = raw as { itemKind?: string; body?: unknown };
  return !!r && (r.itemKind === "doc" || typeof r.body === "string");
}

async function buildImportedDoc(raw: unknown): Promise<Doc> {
  const d = raw as Doc;
  if (typeof d.name !== "string") {
    throw new Error("That file doesn't contain a valid doc.");
  }
  const resources = Array.isArray(d.resources) ? d.resources : [];
  // Its attachments are written back to disk too — they used to be dropped,
  // leaving a link to a file that only existed on the exporting machine.
  const dir = await attachmentsDirFor(resources);
  return {
    id: newId(),
    name: d.name,
    body: await restoreMarkdownImages(typeof d.body === "string" ? d.body : ""),
    resources: await Promise.all(resources.map((r) => restoreResource(r, dir))),
  };
}

export type ImportedItem =
  | { kind: "checklist"; checklist: Checklist }
  | { kind: "doc"; doc: Doc }
  | { kind: "project"; project: Project };

function isProjectPayload(raw: unknown): boolean {
  const r = raw as { itemKind?: string; checklists?: unknown };
  return !!r && (r.itemKind === "project" || Array.isArray(r.checklists));
}

// A whole project bundle: fresh ids throughout, progress reset, and any
// bundled attachments written back to disk.
async function buildImportedProject(raw: unknown): Promise<Project> {
  const p = normalizeProject(raw as Partial<Project>);
  const checklists = await Promise.all(
    p.checklists.map((c) => buildImportedChecklist(c)),
  );
  const docs = await Promise.all(p.docs.map((d) => buildImportedDoc(d)));
  const dir = await attachmentsDirFor(p.files);
  const files = await Promise.all(p.files.map((f) => restoreResource(f, dir)));
  return { id: newId(), name: p.name, checklists, docs, files };
}

// Let the user pick a .uar or .html file holding a project, checklist, or doc.
// Returns null if they cancel.
export async function importItemFromFile(): Promise<ImportedItem | null> {
  const selected = await open({
    title: "Import a project or checklist",
    multiple: false,
    filters: [
      { name: "Up and Running (.uar or .html)", extensions: ["uar", "html", "htm"] },
    ],
  });
  if (typeof selected !== "string") return null;

  const text = await readTextFile(selected);
  const isHtml = /\.html?$/i.test(selected);
  const raw = isHtml ? extractPayloadFromHtml(text) : JSON.parse(text);

  if (isProjectPayload(raw)) {
    return { kind: "project", project: await buildImportedProject(raw) };
  }
  if (isDocPayload(raw)) {
    return { kind: "doc", doc: await buildImportedDoc(raw) };
  }
  return { kind: "checklist", checklist: await buildImportedChecklist(raw) };
}

// Import from JSON text pasted into the app (e.g. an LLM's conversion output).
// Tolerates a ```json fence and surrounding prose by extracting the outer object.
export async function importItemFromJson(text: string): Promise<ImportedItem> {
  const raw = parseLooseJson(text);
  if (isDocPayload(raw)) return { kind: "doc", doc: await buildImportedDoc(raw) };
  return { kind: "checklist", checklist: await buildImportedChecklist(raw) };
}

/** Exported for tests: the tolerant parser behind pasted AI output. */
export function parseLooseJson(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Nothing pasted yet.");

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  let body = (fenced ? fenced[1] : trimmed).trim();
  if (!body.startsWith("{")) {
    const start = body.indexOf("{");
    const end = body.lastIndexOf("}");
    if (start === -1 || end <= start) {
      throw new Error("Couldn't find any JSON in what you pasted.");
    }
    body = body.slice(start, end + 1);
  }

  try {
    return JSON.parse(body);
  } catch (e) {
    throw new Error(
      `That isn't valid JSON: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}
