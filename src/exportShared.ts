import { readFile, stat } from "@tauri-apps/plugin-fs";
import type { Checklist, Doc, Project, Resource } from "./types";
import { allTasks } from "./types";
import { isLocalPath } from "./components/MarkdownView/MarkdownView";

const MARKDOWN_IMAGE_RE = /!\[[^\]]*\]\(\s*([^)\s]+)[^)]*\)/g;

function mimeFromExt(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    case "svg":
      return "image/svg+xml";
    case "pdf":
      return "application/pdf";
    case "mp4":
    case "m4v":
      return "video/mp4";
    case "mov":
      return "video/quicktime";
    case "webm":
      return "video/webm";
    case "mp3":
      return "audio/mpeg";
    default:
      return "application/octet-stream";
  }
}

// Local file attachments (the "+ Local file" resources) that could be bundled,
// from both the checklist-level section and every task.
export function localAttachments(checklist: Checklist): Resource[] {
  const all = [
    ...checklist.resources,
    ...allTasks(checklist).flatMap((t) => t.resources),
  ];
  return all.filter((r) => r.kind === "file" && isLocalPath(r.target));
}

export async function totalAttachmentBytes(checklist: Checklist): Promise<number> {
  const sizes = await Promise.all(
    localAttachments(checklist).map(async (r) => {
      try {
        return (await stat(r.target)).size;
      } catch {
        return 0;
      }
    }),
  );
  return sizes.reduce((a, b) => a + b, 0);
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB"];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`;
}

function base64FromBytes(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000; // avoid arg-count limits on String.fromCharCode
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function toDataUri(path: string): Promise<string | null> {
  try {
    const bytes = await readFile(path);
    return `data:${mimeFromExt(path)};base64,${base64FromBytes(bytes)}`;
  } catch (e) {
    console.error("Could not embed image", path, e);
    return null;
  }
}

// Return a deep copy of the checklist where every local image referenced in a
// task's Markdown is replaced with an inline base64 data URI. This makes the
// exported file (HTML or .uar) fully self-contained and portable to any machine.
export async function embedLocalImages(checklist: Checklist): Promise<Checklist> {
  // Collect unique local image paths across all tasks.
  const paths = new Set<string>();
  for (const task of allTasks(checklist)) {
    for (const m of task.details.matchAll(MARKDOWN_IMAGE_RE)) {
      const src = m[1];
      if (isLocalPath(src)) paths.add(src);
    }
  }

  const map = new Map<string, string>();
  await Promise.all(
    [...paths].map(async (p) => {
      const uri = await toDataUri(p);
      if (uri) map.set(p, uri);
    }),
  );

  if (map.size === 0) return checklist;

  return {
    ...checklist,
    sections: checklist.sections.map((section) => ({
      ...section,
      tasks: section.tasks.map((task) => ({
        ...task,
        details: task.details.replace(MARKDOWN_IMAGE_RE, (whole, src) => {
          const uri = map.get(src);
          return uri ? whole.replace(src, uri) : whole;
        }),
      })),
    })),
  };
}

async function embedResourceList(resources: Resource[]): Promise<Resource[]> {
  return Promise.all(
    resources.map(async (r) => {
      if (r.kind !== "file" || !isLocalPath(r.target) || r.data) return r;
      const uri = await toDataUri(r.target);
      return uri ? { ...r, data: uri } : r;
    }),
  );
}

// Attach a base64 data: URI to each local file resource so it travels with the
// export. The original path is kept (as a filename hint); `data` carries bytes.
async function embedAttachments(checklist: Checklist): Promise<Checklist> {
  return {
    ...checklist,
    resources: await embedResourceList(checklist.resources),
    sections: await Promise.all(
      checklist.sections.map(async (section) => ({
        ...section,
        tasks: await Promise.all(
          section.tasks.map(async (task) => ({
            ...task,
            resources: await embedResourceList(task.resources),
          })),
        ),
      })),
    ),
  };
}

/** Local file attachments on a reference doc. */
export function localDocAttachments(doc: Doc): Resource[] {
  return doc.resources.filter((r) => r.kind === "file" && isLocalPath(r.target));
}

export async function totalDocAttachmentBytes(doc: Doc): Promise<number> {
  const sizes = await Promise.all(
    localDocAttachments(doc).map(async (r) => {
      try {
        return (await stat(r.target)).size;
      } catch {
        return 0;
      }
    }),
  );
  return sizes.reduce((a, b) => a + b, 0);
}

// Same treatment as a checklist: inline images in the body, optionally bundle
// attachments, so the exported page works on any machine.
export async function prepareDocPortable(
  doc: Doc,
  includeAttachments: boolean,
): Promise<Doc> {
  const paths = new Set<string>();
  for (const m of doc.body.matchAll(MARKDOWN_IMAGE_RE)) {
    if (isLocalPath(m[1])) paths.add(m[1]);
  }
  const map = new Map<string, string>();
  await Promise.all(
    [...paths].map(async (p) => {
      const uri = await toDataUri(p);
      if (uri) map.set(p, uri);
    }),
  );

  const body = doc.body.replace(MARKDOWN_IMAGE_RE, (whole, src) => {
    const uri = map.get(src);
    return uri ? whole.replace(src, uri) : whole;
  });

  return {
    ...doc,
    body,
    resources: includeAttachments
      ? await embedResourceList(doc.resources)
      : doc.resources,
  };
}

/** Every local file attachment in a project, across all its items. */
export function localProjectAttachments(project: Project): Resource[] {
  return [
    ...project.files,
    ...project.checklists.flatMap(localAttachments),
    ...project.docs.flatMap(localDocAttachments),
  ].filter((r) => r.kind === "file" && isLocalPath(r.target));
}

export async function totalProjectAttachmentBytes(project: Project): Promise<number> {
  const sizes = await Promise.all(
    localProjectAttachments(project).map(async (r) => {
      try {
        return (await stat(r.target)).size;
      } catch {
        return 0;
      }
    }),
  );
  return sizes.reduce((a, b) => a + b, 0);
}

// The whole project made portable: images inlined everywhere, attachments
// optionally bundled, so links between its items survive on another machine.
export async function prepareProjectPortable(
  project: Project,
  includeAttachments: boolean,
): Promise<Project> {
  return {
    ...project,
    checklists: await Promise.all(
      project.checklists.map((c) => preparePortable(c, includeAttachments)),
    ),
    docs: await Promise.all(
      project.docs.map((d) => prepareDocPortable(d, includeAttachments)),
    ),
    files: includeAttachments ? await embedResourceList(project.files) : project.files,
  };
}

// Produce the portable checklist written to disk. Images in descriptions are
// always inlined (they're small); file attachments are inlined only when the
// user opted in at the export prompt.
export async function preparePortable(
  checklist: Checklist,
  includeAttachments: boolean,
): Promise<Checklist> {
  const withImages = await embedLocalImages(checklist);
  return includeAttachments ? embedAttachments(withImages) : withImages;
}
