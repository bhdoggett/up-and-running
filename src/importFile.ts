import { open } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeFile, mkdir } from "@tauri-apps/plugin-fs";
import { appDataDir, join } from "@tauri-apps/api/path";
import type { Checklist, Doc, Resource, Task } from "./types";
import { newId, withSections } from "./types";

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

// Turn validated raw data into a new, ready-to-use checklist: fresh ids,
// progress reset, bundled attachments written back to disk. Shared by every
// import path (file, pasted JSON, AI-assisted).
export async function buildImportedChecklist(raw: unknown): Promise<Checklist> {
  // withSections also accepts the older flat-`tasks` shape, so exports from
  // before sections (and LLM output using either form) import cleanly.
  const checklist = withSections(asChecklist(raw));
  const resourceLists = [
    checklist.resources,
    ...checklist.sections.flatMap((s) => s.tasks.map((t) => t.resources ?? [])),
  ];

  // Create the attachments dir once, only if something is bundled.
  const hasBundled = resourceLists.some((list) =>
    list.some((r) => typeof r.data === "string"),
  );
  let dir: string | null = null;
  if (hasBundled) {
    dir = await join(await appDataDir(), "attachments");
    await mkdir(dir, { recursive: true });
  }

  return {
    id: newId(),
    name: checklist.name,
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
            details: task.details ?? "",
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

function buildImportedDoc(raw: unknown): Doc {
  const d = raw as Doc;
  if (typeof d.name !== "string") {
    throw new Error("That file doesn't contain a valid doc.");
  }
  return {
    id: newId(),
    name: d.name,
    body: typeof d.body === "string" ? d.body : "",
    resources: Array.isArray(d.resources)
      ? d.resources.map((r) => ({
          id: newId(),
          label: r.label,
          kind: r.kind,
          target: r.target,
        }))
      : [],
  };
}

export type ImportedItem =
  | { kind: "checklist"; checklist: Checklist }
  | { kind: "doc"; doc: Doc };

// Let the user pick a .uar or .html file holding either a checklist or a doc.
// Returns null if they cancel.
export async function importChecklistFromFile(): Promise<ImportedItem | null> {
  const selected = await open({
    title: "Import a checklist or doc",
    multiple: false,
    filters: [
      { name: "Checklist or doc (.uar or .html)", extensions: ["uar", "html", "htm"] },
    ],
  });
  if (typeof selected !== "string") return null;

  const text = await readTextFile(selected);
  const isHtml = /\.html?$/i.test(selected);
  const raw = isHtml ? extractPayloadFromHtml(text) : JSON.parse(text);

  if (isDocPayload(raw)) {
    return { kind: "doc", doc: buildImportedDoc(raw) };
  }
  return { kind: "checklist", checklist: await buildImportedChecklist(raw) };
}

// Import from JSON text pasted into the app (e.g. an LLM's conversion output).
// Tolerates a ```json fence and surrounding prose by extracting the outer object.
export async function importChecklistFromJson(text: string): Promise<Checklist> {
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

  let raw: unknown;
  try {
    raw = JSON.parse(body);
  } catch (e) {
    throw new Error(
      `That isn't valid JSON: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
  return buildImportedChecklist(raw);
}
