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
  if (
    !raw ||
    typeof raw !== "object" ||
    !Array.isArray((raw as Checklist).tasks) ||
    typeof (raw as Checklist).name !== "string"
  ) {
    throw new Error("File doesn't contain a valid checklist.");
  }
  return raw as Checklist;
}

// Write any bundled attachment bytes to a file under the app's data dir, so the
// resource points at a real local path the OS can open. Clears the `data` field.
async function materializeAttachments(tasks: Task[]): Promise<Task[]> {
  const hasBundled = tasks.some((t) =>
    t.resources.some((r) => typeof r.data === "string"),
  );
  if (!hasBundled) return tasks.map(freshTask);

  const dir = await join(await appDataDir(), "attachments");
  await mkdir(dir, { recursive: true });

  return Promise.all(
    tasks.map(async (task) => {
      const resources = await Promise.all(
        task.resources.map(async (r): Promise<Resource> => {
          const base: Resource = {
            id: newId(),
            label: r.label,
            kind: r.kind,
            target: r.target,
          };
          if (typeof r.data === "string") {
            try {
              const fileName = `${newId()}-${basename(r.target)}`;
              const dest = await join(dir, fileName);
              await writeFile(dest, bytesFromDataUri(r.data));
              return { ...base, target: dest };
            } catch (e) {
              console.error("Could not restore attachment", r.label, e);
              return base; // fall back to the (dead) original path
            }
          }
          return base;
        }),
      );
      return { id: newId(), title: task.title, details: task.details, done: false, resources };
    }),
  );
}

// Regenerate ids and reset progress for a task with no bundled attachments.
function freshTask(task: Task): Task {
  return {
    id: newId(),
    title: task.title,
    details: task.details,
    done: false,
    resources: task.resources.map((r) => ({
      id: newId(),
      label: r.label,
      kind: r.kind,
      target: r.target,
    })),
  };
}

// Let the user pick a .uar or .html file and turn it into a new, ready-to-use
// checklist (fresh ids, progress reset, attachments restored to disk).
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

  return {
    id: newId(),
    name: checklist.name,
    tasks: await materializeAttachments(checklist.tasks),
  };
}
