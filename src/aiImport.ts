import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";

// A self-contained prompt the user pastes into any LLM (claude.ai, etc.) along
// with their existing checklist — a Word doc, a printout, notes from another
// app. The model returns .uar JSON, which the app validates and imports.
export const CONVERSION_PROMPT = `You convert existing checklists into the "Up and Running" checklist format.

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

/** Copy the prompt to the clipboard. Returns false if the browser blocks it. */
export async function copyPromptToClipboard(): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(CONVERSION_PROMPT);
    return true;
  } catch {
    // Fallback for contexts where the async clipboard API is unavailable.
    try {
      const ta = document.createElement("textarea");
      ta.value = CONVERSION_PROMPT;
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

/** Save the prompt as a text file. Returns the path, or null if cancelled. */
export async function downloadPrompt(): Promise<string | null> {
  const path = await save({
    title: "Save conversion prompt",
    defaultPath: "up-and-running-conversion-prompt.txt",
    filters: [{ name: "Text", extensions: ["txt", "md"] }],
  });
  if (!path) return null;
  await writeTextFile(path, CONVERSION_PROMPT);
  return path;
}
