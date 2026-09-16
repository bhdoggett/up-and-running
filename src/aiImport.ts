import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";

// A self-contained prompt the user pastes into any LLM (claude.ai, etc.) along
// with their existing checklist — a Word doc, a printout, notes from another
// app. The model returns .uar JSON, which the app validates and imports.
const CONVERSION_PROMPT = `You convert existing checklists into the "Up and Running" checklist format.

I will give you the contents of a checklist — it may come from a Word document, a
PDF, an email, notes, or another checklist app. Convert it into a single JSON
object matching the schema below.

## Output rules

- Reply with ONLY the JSON object. No commentary before or after, no code fence.
- Every field in the schema must be present, even when empty.
- Do not invent steps that aren't in the source. Keep the original order.
- Do not include "id" fields — the app generates those on import.

## Schema

{
  "name": "string — the checklist's title",
  "resources": [
    {
      "label": "string — short human-readable name",
      "kind": "web" | "file",
      "target": "string — a full https:// URL for kind=web, or an absolute file path for kind=file"
    }
  ],
  "sections": [
    {
      "name": "string — a group heading, e.g. 'Before doors open'. Use \\"\\" if the source has no groups.",
      "collapsed": false,
      "tasks": [
        {
          "title": "string — one short imperative step, e.g. 'Power on the sound board'",
          "details": "string — Markdown explaining the step; empty string if there's nothing to add",
          "done": false,
          "resources": [ /* same shape as above, for links specific to this step */ ]
        }
      ]
    }
  ]
}

## How to map the source

- If the source has headings that group steps (phases, rooms, times of day),
  make each one a section with that name. If it's just one flat list, use a
  single section with "name": "".
- Top-level "resources" are links/files that apply to the WHOLE checklist, such
  as an overview video. Per-step links belong in that step's "resources".
- "title" is the action itself — keep it under about 60 characters. Move any
  explanation, warnings, or context into "details".
- "details" supports Markdown: use ## headings, "-" bullets (indent two spaces
  for sub-bullets), **bold**, numbered lists, and [links](https://example.com).
  Preserve sub-steps as nested bullets rather than flattening them.
- Any URL found in the text should become a resource with kind "web". Only use
  kind "file" when the source clearly references a local file path.
- Set every "done" to false.

## Example output

{
  "name": "Sunday Service Setup",
  "resources": [
    { "label": "Full setup walkthrough", "kind": "web", "target": "https://example.com/video" }
  ],
  "sections": [
    {
      "name": "Before doors open",
      "collapsed": false,
      "tasks": [
        {
          "title": "Power on the sound board",
          "details": "Turn on in this order to avoid a loud pop:\\n\\n1. Wall power\\n2. The board\\n3. The speakers\\n\\n**Wait** for the board to finish booting before touching faders.",
          "done": false,
          "resources": []
        }
      ]
    }
  ]
}

## The checklist to convert

Paste your checklist below this line, then send.
------------------------------------------------------------
`;

// The doc equivalent: keep the source document's structure, but as Markdown.
const DOC_CONVERSION_PROMPT = `You convert reference documents into the "Up and Running" doc format.

I will give you the contents of a document — a Word file, a PDF, a printout, or
notes. It explains how something works; it is NOT a step-by-step checklist.
Convert it into a single JSON object matching the schema below.

## Output rules

- Reply with ONLY the JSON object. No commentary before or after, no code fence.
- Every field must be present, even when empty.
- Keep ALL of the original wording. Do not summarize, shorten, or rewrite
  sentences. This is a formatting job, not an editing job.

## Schema

{
  "itemKind": "doc",
  "name": "string — the document's title",
  "body": "string — the whole document as Markdown",
  "resources": [
    {
      "label": "string — short human-readable name",
      "kind": "web" | "file",
      "target": "string — a full https:// URL for kind=web, or an absolute file path for kind=file"
    }
  ]
}

## How to map the source to Markdown

Mirror the original layout as closely as Markdown allows:

- Headings and sub-headings become "#", "##", "###" — match the source's own
  heading levels and order.
- Bulleted lists become "-". Indent two spaces per level to keep sub-bullets
  nested exactly as they appear.
- Numbered lists become "1.", "2.", … Keep the original numbering style.
- **Bold** and *italic* emphasis is preserved where the source uses it.
- Tables become Markdown tables (| col | col |) with a header separator row.
- Callouts, notes, and warnings become "> " blockquotes.
- Page breaks, headers/footers, and page numbers are dropped — they're artifacts
  of the page, not content.
- If the source has images or diagrams, insert a placeholder on its own line:
  ![description of the diagram](REPLACE_WITH_IMAGE_PATH)
  Describe what the diagram shows in the alt text so it can be matched up later.
- Any URL in the text becomes a "web" resource AND stays as a [link](url) inline
  if it was inline in the source.

## Example output

{
  "itemKind": "doc",
  "name": "How the sound system is wired",
  "body": "## Signal path\\n\\n- **Stage boxes** run to the snake\\n- The snake terminates at the **booth patch panel**\\n  - Channels 1-8 are stage left\\n  - Channels 9-16 are stage right\\n\\n> Channel 7 uses a different battery than the lapel packs.\\n",
  "resources": []
}

## The document to convert

Paste your document below this line, then send.
------------------------------------------------------------
`;

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for contexts where the async clipboard API is unavailable.
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

export type PromptKind = "checklist" | "doc";

function promptFor(kind: PromptKind): string {
  return kind === "doc" ? DOC_CONVERSION_PROMPT : CONVERSION_PROMPT;
}

/** Copy a conversion prompt. Returns false if the clipboard is unavailable. */
export function copyPromptToClipboard(kind: PromptKind = "checklist") {
  return copyText(promptFor(kind));
}

/** Save a conversion prompt as a text file. Returns the path, or null if cancelled. */
export async function downloadPrompt(
  kind: PromptKind = "checklist",
): Promise<string | null> {
  const path = await save({
    title: "Save conversion prompt",
    defaultPath: `up-and-running-${kind}-prompt.txt`,
    filters: [{ name: "Text", extensions: ["txt", "md"] }],
  });
  if (!path) return null;
  await writeTextFile(path, promptFor(kind));
  return path;
}
