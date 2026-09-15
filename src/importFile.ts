import { open } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeFile, mkdir } from "@tauri-apps/plugin-fs";
import { appDataDir, join } from "@tauri-apps/api/path";
import type { Checklist, Resource, Task } from "./types";
import { newId } from "./types";

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
  if (
    !raw ||
    typeof raw !== "object" ||
    !Array.isArray(c.tasks) ||
    typeof c.name !== "string"
  ) {
    throw new Error("File doesn't contain a valid checklist.");
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

// Let the user pick a .uar or .html file and turn it into a new, ready-to-use
// checklist (fresh ids, progress reset, bundled attachments restored to disk).
// Returns null if the user cancels.
export async function importChecklistFromFile(): Promise<Checklist | null> {
  const selected = await open({
    title: "Import a checklist",
    multiple: false,
    filters: [{ name: "Checklist (.uar or .html)", extensions: ["uar", "html", "htm"] }],
  });
  if (typeof selected !== "string") return null;

  const text = await readTextFile(selected);
  const isHtml = /\.html?$/i.test(selected);
  const raw = isHtml ? extractPayloadFromHtml(text) : JSON.parse(text);
  const checklist = asChecklist(raw);
  const resourceLists = [
    checklist.resources ?? [],
    ...checklist.tasks.map((t) => t.resources ?? []),
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
      (checklist.resources ?? []).map((r) => restoreResource(r, dir)),
    ),
    tasks: await Promise.all(
      checklist.tasks.map(async (task): Promise<Task> => ({
        id: newId(),
        title: task.title,
        details: task.details,
        done: false,
        resources: await Promise.all(
          (task.resources ?? []).map((r) => restoreResource(r, dir)),
        ),
      })),
    ),
  };
}
