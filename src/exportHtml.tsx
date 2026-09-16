import { save, confirm } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { renderToStaticMarkup } from "react-dom/server";
import type { Checklist, Doc, Project, Resource } from "./types";
import { allTasks } from "./types";
import MarkdownView from "./components/MarkdownView/MarkdownView";
import {
  preparePortable,
  prepareDocPortable,
  localAttachments,
  localDocAttachments,
  totalAttachmentBytes,
  totalDocAttachmentBytes,
  localProjectAttachments,
  totalProjectAttachmentBytes,
  prepareProjectPortable,
  formatBytes,
} from "./exportShared";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeName(name: string): string {
  return name.trim().replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "checklist";
}

// Render one task's Markdown to a static HTML string. Images are already inline
// data URIs (see embedLocalImages); links become normal target=_blank anchors.
function renderDetails(details: string): string {
  if (!details.trim()) return "";
  const inner = renderToStaticMarkup(<MarkdownView content={details} />);
  return `<div class="export-prose">${inner}</div>`;
}

/**
 * Internal links carry no label when they follow the target's name, which the
 * exported page can't look up. Bake the current names in before rendering.
 */
export type NameMap = Record<string, string>;

function fillLabels(resources: Resource[], names: NameMap): Resource[] {
  return resources.map((r) =>
    (r.kind === "doc" || r.kind === "checklist") && !r.label.trim()
      ? { ...r, label: names[r.target] ?? `(missing ${r.kind})` }
      : r,
  );
}

function withResolvedLabels(checklist: Checklist, names: NameMap): Checklist {
  return {
    ...checklist,
    resources: fillLabels(checklist.resources, names),
    sections: checklist.sections.map((s) => ({
      ...s,
      tasks: s.tasks.map((t) => ({ ...t, resources: fillLabels(t.resources, names) })),
    })),
  };
}

function renderResources(resources: Resource[]): string {
  if (resources.length === 0) return "";
  const items = resources
    .map((r) => {
      if (r.kind === "web") {
        return `<li><a href="${escapeHtml(r.target)}" target="_blank" rel="noopener noreferrer">${escapeHtml(r.label || r.target)}</a></li>`;
      }
      if (r.kind === "doc" || r.kind === "checklist") {
        // In-app links can't navigate outside the app; name them instead.
        return `<li><span class="file-res">${escapeHtml(r.label || `(${r.kind})`)}</span> <span class="file-note">— ${r.kind} in the Up and Running app</span></li>`;
      }
      if (r.data) {
        // Bundled attachment — downloadable straight from this file.
        return `<li><a href="${r.data}" download="${escapeHtml(r.label)}">${escapeHtml(r.label)}</a> <span class="file-note">(attached file)</span></li>`;
      }
      // Local file that was NOT bundled into this export.
      return `<li><span class="file-removed">📎 ${escapeHtml(r.label)}</span> <span class="file-note">— file not included in this export</span></li>`;
    })
    .join("");
  return `<ul class="resources">${items}</ul>`;
}

function renderTasks(tasks: Checklist["sections"][number]["tasks"]): string {
  return tasks
    .map((task) => {
      const resourcesBlock = renderResources(task.resources);
      return `
      <li class="task" data-id="${escapeHtml(task.id)}">
        <label class="task-head">
          <input type="checkbox" class="task-check">
          <span class="task-title">${escapeHtml(task.title)}</span>
        </label>
        ${renderDetails(task.details)}
        ${resourcesBlock}
      </li>`;
    })
    .join("");
}

// Sections become native <details> elements, so collapsing works with no JS.
// A lone unnamed section renders as a plain list, matching the app.
function renderSections(checklist: Checklist): string {
  const showHeaders =
    checklist.sections.length > 1 ||
    (checklist.sections[0]?.name ?? "").trim() !== "";

  return checklist.sections
    .map((section) => {
      const list = `<ol class="tasks">${renderTasks(section.tasks)}\n    </ol>`;
      if (!showHeaders) return list;
      return `
    <details class="section"${section.collapsed ? "" : " open"}>
      <summary class="section-head">
        <span class="section-name">${escapeHtml(section.name)}</span>
        <span class="section-count" data-section="${escapeHtml(section.id)}"></span>
      </summary>
      ${list}
    </details>`;
    })
    .join("");
}

// Build a single self-contained HTML document. It renders the checklist read-only
// (interactive checkboxes saved in the viewer's browser) AND embeds the full
// checklist JSON in a <script> tag so the desktop app can re-import it.
export function renderChecklistHtml(checklist: Checklist): string {
  const storageKey = `up-and-running:${checklist.id}`;
  const stepCount = allTasks(checklist).length;
  // Embed the data payload for round-tripping. Escape "<" so "</script>" in any
  // user text can't close the tag early; JSON.parse decodes < back to "<".
  const payload = JSON.stringify(checklist).replace(/</g, "\\u003c");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(checklist.name)}</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 2rem 1rem;
    font: 16px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    background: #f6f7f9; color: #1c1f23;
  }
  .wrap { max-width: 680px; margin: 0 auto; }
  header { margin-bottom: 1.5rem; }
  h1 { font-size: 1.6rem; margin: 0 0 .25rem; }
  .sub { color: #6b7280; font-size: .9rem; }
  .overview { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: .8rem 1.1rem; margin-bottom: 1.2rem; }
  .overview-label { font-size: .72rem; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: #6b7280; margin-bottom: .3rem; }
  .overview ul.resources { margin: 0; }
  ol.tasks { list-style: none; margin: 0; padding: 0; }
  details.section { margin-bottom: 1.2rem; }
  .section-head {
    display: flex; align-items: center; gap: .5rem; cursor: pointer;
    padding: .3rem 0 .45rem; border-bottom: 1px solid #e5e7eb; margin-bottom: .6rem;
    list-style: none;
  }
  .section-head::-webkit-details-marker { display: none; }
  .section-head::before {
    content: ""; flex: none; width: 0; height: 0;
    border-left: 5px solid #9ca3af; border-top: 4px solid transparent; border-bottom: 4px solid transparent;
    transition: transform .15s ease;
  }
  details[open] > .section-head::before { transform: rotate(90deg); }
  .section-name {
    font-size: 1.08rem; font-weight: 700; letter-spacing: -.01em;
    color: #1c1f23; flex: 1;
  }
  .section-count {
    font-size: .72rem; color: #9ca3af; border: 1px solid #e5e7eb;
    border-radius: 999px; padding: .05rem .5rem; background: #fff;
  }
  .section-count.complete { color: #059669; border-color: #a7f3d0; }
  .task { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 1rem 1.1rem; margin-bottom: .75rem; }
  .task-head { display: flex; align-items: flex-start; gap: .7rem; cursor: pointer; font-weight: 600; }
  .task-check { width: 1.15rem; height: 1.15rem; margin-top: .18rem; flex: none; accent-color: #2563eb; cursor: pointer; }
  .task.done .task-title { text-decoration: line-through; color: #9ca3af; }
  ul.resources { margin: .6rem 0 0 1.85rem; padding-left: 1rem; }
  ul.resources li { margin: .2rem 0; }
  a { color: #2563eb; }
  .file-res { font-weight: 500; }
  .file-removed { color: #9ca3af; text-decoration: line-through; }
  .file-note { color: #9ca3af; font-size: .82rem; }
  .reset { margin-top: 1.5rem; background: none; border: 1px solid #d1d5db; border-radius: 8px; padding: .4rem .8rem; color: #6b7280; cursor: pointer; font: inherit; font-size: .85rem; }
  /* Markdown prose */
  .export-prose { margin: .6rem 0 0 1.85rem; color: #374151; }
  .export-prose > :first-child { margin-top: 0; }
  .export-prose h1, .export-prose h2, .export-prose h3, .export-prose h4, .export-prose h5, .export-prose h6 { color: #1c1f23; line-height: 1.3; font-weight: 700; margin: 1rem 0 .4rem; }
  .export-prose h1 { font-size: 1.2rem; } .export-prose h2 { font-size: 1.08rem; } .export-prose h3 { font-size: 1rem; }
  .export-prose h4 { font-size: .95rem; }
  .export-prose h5, .export-prose h6 { font-size: .87rem; text-transform: uppercase; letter-spacing: .04em; color: #6b7280; }
  .export-prose p { margin: .5rem 0; }
  .export-prose ul, .export-prose ol { margin: .5rem 0; padding-left: 1.4rem; }
  .export-prose li { margin: .2rem 0; }
  .export-prose ul { list-style-type: disc; }
  .export-prose ul ul { list-style-type: circle; }
  .export-prose ul ul ul { list-style-type: square; }
  .export-prose ul ul ul ul { list-style-type: disc; }
  .export-prose li > ul, .export-prose li > ol { margin: .2rem 0; }
  .export-prose img { max-width: 100%; height: auto; border-radius: 8px; display: block; margin: .6rem 0; }
  .export-prose code { background: #eef0f3; border-radius: 4px; padding: .05rem .3rem; font-size: .88em; }
  .export-prose pre { background: #eef0f3; border-radius: 8px; padding: .7rem .85rem; overflow-x: auto; }
  .export-prose pre code { background: none; padding: 0; }
  .export-prose blockquote { margin: .6rem 0; padding: .2rem 0 .2rem .9rem; border-left: 3px solid #d3d6dc; color: #6b7280; }
  .export-prose table { border-collapse: collapse; margin: .6rem 0; }
  .export-prose th, .export-prose td { border: 1px solid #e5e7eb; padding: .35rem .6rem; }
  @media (prefers-color-scheme: dark) {
    body { background: #16181c; color: #e7e9ea; }
    .task, .overview { background: #1f2226; border-color: #33373d; }
    .overview-label { color: #8b929c; }
    .section-head { border-bottom-color: #33373d; }
    .section-name { color: #e7e9ea; }
    .section-count { background: #1f2226; border-color: #33373d; }
    .sub, .file-note { color: #8b929c; }
    .export-prose { color: #c3c7cd; }
    .export-prose h1, .export-prose h2, .export-prose h3, .export-prose h4 { color: #e7e9ea; }
    .export-prose h5, .export-prose h6 { color: #8b929c; }
    .export-prose code, .export-prose pre { background: #2a2e34; }
    .reset { border-color: #3a3f46; color: #9aa0a8; }
  }
</style>
</head>
<body>
  <div class="wrap">
    <header>
      <h1>${escapeHtml(checklist.name)}</h1>
      <div class="sub">${stepCount} step${stepCount === 1 ? "" : "s"} · progress is saved in this browser</div>
    </header>
    ${checklist.description.trim() ? `<div class="overview">${renderDetails(checklist.description)}</div>` : ""}
    ${checklist.resources.length > 0 ? `<div class="overview"><div class="overview-label">Overview links &amp; files</div>${renderResources(checklist.resources)}</div>` : ""}
    ${renderSections(checklist)}
    <button class="reset" type="button">Reset all checkboxes</button>
  </div>
  <script type="application/json" id="uar-data">${payload}</script>
<script>
(function () {
  var KEY = ${JSON.stringify(storageKey)};
  function loadDone() { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (e) { return {}; } }
  function saveDone(d) { localStorage.setItem(KEY, JSON.stringify(d)); }
  var done = loadDone();
  var tasks = document.querySelectorAll(".task");

  // Keep each section's "done/total" badge in sync with its checkboxes.
  function refreshCounts() {
    document.querySelectorAll("details.section").forEach(function (sec) {
      var badge = sec.querySelector(".section-count");
      if (!badge) return;
      var boxes = sec.querySelectorAll(".task-check");
      var checked = sec.querySelectorAll(".task-check:checked").length;
      badge.textContent = checked + "/" + boxes.length;
      badge.classList.toggle("complete", boxes.length > 0 && checked === boxes.length);
    });
  }

  tasks.forEach(function (li) {
    var id = li.getAttribute("data-id");
    var box = li.querySelector(".task-check");
    if (done[id]) { box.checked = true; li.classList.add("done"); }
    box.addEventListener("change", function () {
      done[id] = box.checked; li.classList.toggle("done", box.checked); saveDone(done);
      refreshCounts();
    });
  });
  document.querySelector(".reset").addEventListener("click", function () {
    done = {}; saveDone(done);
    tasks.forEach(function (li) { li.querySelector(".task-check").checked = false; li.classList.remove("done"); });
    refreshCounts();
  });
  refreshCounts();
})();
</script>
</body>
</html>`;
}

// A reference doc as a standalone page: same styling as the checklist export,
// with the Markdown body rendered and the doc JSON embedded for re-import.
export function renderDocHtml(doc: Doc): string {
  const payload = JSON.stringify({ ...doc, itemKind: "doc" }).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(doc.name)}</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 2rem 1rem;
    font: 16px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    background: #f6f7f9; color: #1c1f23;
  }
  .wrap { max-width: 720px; margin: 0 auto; }
  header { margin-bottom: 1.3rem; }
  h1 { font-size: 1.6rem; margin: 0 0 .25rem; }
  .sub { color: #6b7280; font-size: .82rem; text-transform: uppercase; letter-spacing: .06em; font-weight: 700; }
  .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 1.1rem 1.3rem; }
  .overview { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: .8rem 1.1rem; margin-bottom: 1.1rem; }
  .overview-label { font-size: .72rem; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: #6b7280; margin-bottom: .3rem; }
  ul.resources { margin: 0; padding-left: 1rem; }
  ul.resources li { margin: .2rem 0; }
  a { color: #2563eb; }
  .file-res { font-weight: 500; }
  .file-removed { color: #9ca3af; text-decoration: line-through; }
  .file-note { color: #9ca3af; font-size: .82rem; }
  .export-prose { color: #374151; }
  .export-prose > :first-child { margin-top: 0; }
  .export-prose h1, .export-prose h2, .export-prose h3, .export-prose h4, .export-prose h5, .export-prose h6 { color: #1c1f23; line-height: 1.3; font-weight: 700; margin: 1.1rem 0 .4rem; }
  .export-prose h1 { font-size: 1.2rem; } .export-prose h2 { font-size: 1.08rem; } .export-prose h3 { font-size: 1rem; }
  .export-prose h4 { font-size: .95rem; }
  .export-prose h5, .export-prose h6 { font-size: .87rem; text-transform: uppercase; letter-spacing: .04em; color: #6b7280; }
  .export-prose p { margin: .5rem 0; }
  .export-prose ul, .export-prose ol { margin: .5rem 0; padding-left: 1.4rem; }
  .export-prose li { margin: .2rem 0; }
  .export-prose ul { list-style-type: disc; }
  .export-prose ul ul { list-style-type: circle; }
  .export-prose ul ul ul { list-style-type: square; }
  .export-prose img { max-width: 100%; height: auto; border-radius: 8px; display: block; margin: .6rem 0; }
  .export-prose code { background: #eef0f3; border-radius: 4px; padding: .05rem .3rem; font-size: .88em; }
  .export-prose pre { background: #eef0f3; border-radius: 8px; padding: .7rem .85rem; overflow-x: auto; }
  .export-prose pre code { background: none; padding: 0; }
  .export-prose blockquote { margin: .6rem 0; padding: .2rem 0 .2rem .9rem; border-left: 3px solid #d3d6dc; color: #6b7280; }
  .export-prose table { border-collapse: collapse; margin: .6rem 0; }
  .export-prose th, .export-prose td { border: 1px solid #e5e7eb; padding: .35rem .6rem; }
  @media (prefers-color-scheme: dark) {
    body { background: #16181c; color: #e7e9ea; }
    .card, .overview { background: #1f2226; border-color: #33373d; }
    .sub, .overview-label, .file-note { color: #8b929c; }
    .export-prose { color: #c3c7cd; }
    .export-prose h1, .export-prose h2, .export-prose h3, .export-prose h4 { color: #e7e9ea; }
    .export-prose h5, .export-prose h6 { color: #8b929c; }
    .export-prose code, .export-prose pre { background: #2a2e34; }
  }
</style>
</head>
<body>
  <div class="wrap">
    <header>
      <div class="sub">Reference doc</div>
      <h1>${escapeHtml(doc.name)}</h1>
    </header>
    ${doc.resources.length > 0 ? `<div class="overview"><div class="overview-label">Links &amp; files</div>${renderResources(doc.resources)}</div>` : ""}
    <div class="card">${renderDetails(doc.body) || "<p><em>No content yet.</em></p>"}</div>
  </div>
  <script type="application/json" id="uar-data">${payload}</script>
</body>
</html>`;
}

/** Export a doc as a standalone page. Returns the path, or null if cancelled. */
export async function exportDocToHtml(
  doc: Doc,
  names: NameMap = {},
): Promise<string | null> {
  const includeAttachments = await askIncludeDocAttachments(doc);
  const path = await save({
    title: "Export doc as HTML",
    defaultPath: `${safeName(doc.name)}.html`,
    filters: [{ name: "HTML", extensions: ["html"] }],
  });
  if (!path) return null;
  const portable = await prepareDocPortable(doc, includeAttachments);
  await writeTextFile(
    path,
    renderDocHtml({ ...portable, resources: fillLabels(portable.resources, names) }),
  );
  return path;
}

/**
 * Export a whole project as a .uar bundle: every checklist, doc, and file in
 * one file, so links between them still resolve when it's imported elsewhere.
 */
export async function exportProjectToUar(project: Project): Promise<string | null> {
  const attachments = localProjectAttachments(project);
  let includeAttachments = false;
  if (attachments.length > 0) {
    includeAttachments = await askBundle(
      attachments.length,
      await totalProjectAttachmentBytes(project),
    );
  }
  const path = await save({
    title: "Export project",
    defaultPath: `${safeName(project.name)}.uar`,
    filters: [{ name: "Up and Running project", extensions: ["uar"] }],
  });
  if (!path) return null;

  const portable = await prepareProjectPortable(project, includeAttachments);
  // Name links by their target's current name so the bundle reads correctly
  // even where an item was linked without an explicit label.
  const names: NameMap = {};
  for (const c of portable.checklists) names[c.id] = c.name;
  for (const d of portable.docs) names[d.id] = d.name;

  const payload = {
    itemKind: "project",
    ...portable,
    checklists: portable.checklists.map((c) => withResolvedLabels(c, names)),
    docs: portable.docs.map((d) => ({
      ...d,
      resources: fillLabels(d.resources, names),
    })),
  };
  await writeTextFile(path, JSON.stringify(payload, null, 2));
  return path;
}

// If the checklist has local file attachments, ask whether to bundle them
// (showing the total size). Returns the user's choice; no prompt when there are none.
async function askIncludeDocAttachments(doc: Doc): Promise<boolean> {
  const attachments = localDocAttachments(doc);
  if (attachments.length === 0) return false;
  const bytes = await totalDocAttachmentBytes(doc);
  return askBundle(attachments.length, bytes);
}

async function askIncludeAttachments(checklist: Checklist): Promise<boolean> {
  const attachments = localAttachments(checklist);
  if (attachments.length === 0) return false;
  const bytes = await totalAttachmentBytes(checklist);
  return askBundle(attachments.length, bytes);
}

function askBundle(count: number, bytes: number): Promise<boolean> {
  return confirm(
    `This has ${count} file attachment${count === 1 ? "" : "s"} totaling ${formatBytes(bytes)}.\n\n` +
      `Include them in the export? They'll travel with the file so it works on any computer, but the file will be larger. ` +
      `Choose “Skip” to keep the file small (attachments stay as references only).`,
    {
      title: "Include attachments?",
      kind: "info",
      okLabel: "Include",
      cancelLabel: "Skip",
    },
  );
}

// Prompt for a location and write the standalone HTML file. Returns the path, or
// null if cancelled.
export async function exportChecklistToHtml(
  checklist: Checklist,
  names: NameMap = {},
): Promise<string | null> {
  const includeAttachments = await askIncludeAttachments(checklist);
  const path = await save({
    title: "Export checklist as HTML",
    defaultPath: `${safeName(checklist.name)}.html`,
    filters: [{ name: "HTML", extensions: ["html"] }],
  });
  if (!path) return null;
  const portable = await preparePortable(checklist, includeAttachments);
  await writeTextFile(path, renderChecklistHtml(withResolvedLabels(portable, names)));
  return path;
}

// A single checklist has no .uar of its own: .uar always means a whole
// project bundle, so one extension has one meaning. Single items export as
// HTML (see exportChecklistToHtml / exportDocToHtml).
