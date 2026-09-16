# Up and Running

A desktop app for walking volunteers through setting up an event — the printed
run sheet taped up backstage, but with the tutorial video attached to the step
that needs it.

Built for people who are standing at a sound board at 8:15am with coffee in one
hand, not for people who live in project management tools.

---

## What's in it

**Projects** hold everything for one event or effort:

- **Checklists** — steps grouped into collapsible sections, each step with
  Markdown details, links, files, and links to other items in the app
- **Docs** — reference pages that explain how something works, for the things
  that don't need checking off
- **Files** — every file used anywhere in the project, listed in one place

Steps are numbered continuously across sections, so "step 7" means something.
Ticking a step turns its number into a check; a section's checkbox ticks all of
its steps at once.

### Sharing it

| You want to… | Use | What they get |
| --- | --- | --- |
| Hand a volunteer the checklist | **Export HTML** on a checklist or doc | A single web page that opens in any browser, with working checkboxes saved in that browser. No app needed. |
| Move your work to another machine | **Export project (.uar)** from the project menu | The whole project — checklists, docs, files — importable into another copy of the app, with links between items intact. |

Both ask whether to bundle attached files. Bundling makes the file work
anywhere at the cost of size; skipping keeps it small and marks those files as
not included.

### Bringing existing material in

You probably already have this written down somewhere. **Import → From a
document (AI)** hands you a conversion prompt: paste it into any AI chat along
with your Word doc or PDF, paste the JSON answer back, and it becomes a
checklist or a doc. No API key, no account, no cost.

The doc prompt is a formatting job, not an editing one — it's told to keep the
original wording and mirror the headings, lists, tables, and callouts.

---

## Installing

Download a build from [Releases](../../releases):

- **macOS (Apple Silicon)** — `_aarch64.dmg`
- **macOS (Intel)** — `_x64.dmg`
- **Windows** — `_x64-setup.exe` or `_x64_en-US.msi`

### Opening it the first time

The builds are **unsigned**, so both systems will object once.

**macOS.** Drag the app into Applications first, then strip the
downloaded-from-the-internet flag:

```sh
xattr -dr com.apple.quarantine "/Applications/Up and Running.app"
```

Then open it normally. (Right-click → Open no longer works for unsigned apps on
current macOS. The "Open Anyway" button in System Settings → Privacy & Security
does, but only in the minutes right after a blocked attempt.)

**Windows.** SmartScreen shows "Windows protected your PC" → **More info** →
**Run anyway**.

Removing the warnings for good needs a paid Apple Developer account and a
Windows code-signing certificate. Not worth it for handing an app to a dozen
volunteers; worth it if you distribute widely.

---

## Developing

Needs [Node](https://nodejs.org) and [Rust](https://rustup.rs). On macOS you
also need the Xcode command line tools (`xcode-select --install`).

```sh
npm install
npm run tauri dev      # run the app with hot reload
npm test               # run the test suite
npm run build          # typecheck + build the frontend
npm run tauri build    # produce installers in src-tauri/target/release/bundle/
```

`npm run build` runs `tsc` before Vite, so it fails on type errors — `vite
build` alone does not typecheck.

### Layout

```
src/
  types.ts          data model, plus migrations for older saved data
  reorder.ts        drag-and-drop reordering rules (pure, tested)
  storage.ts        persistence via the Tauri store plugin
  importFile.ts     import .uar / .html / pasted AI output
  exportHtml.tsx    standalone HTML and .uar export
  aiImport.ts       the conversion prompts
  library.tsx       shared context: what exists, and how to navigate to it
  components/       one folder per component, with its CSS module
src-tauri/          Rust shell, window config, capabilities
scripts/
  make-icon.mjs     draws the ## mark and renders the icon source
```

### Tests

Logic where a bug would lose or mangle data is pure and tested: reordering,
state migration, file collection, link normalisation, and the tolerant parser
for pasted AI output. Components stay thin and delegate to those modules.

New features come with tests in the same change.

### Styling

Dark only. Colour, spacing, and radii come from custom properties in
`src/global.css`; type and spacing use `rem`, with `px` reserved for hairlines
and fixed control sizes. Two signal colours do real work and nothing else:
**amber** means attention or active, **green** only ever means done.

---

## Known limits

- **Attached files are paths, not copies.** A file attached on one machine
  won't resolve on another unless it was bundled into the export. Web links
  travel better.
- **No sync yet.** Remote sync via Supabase is planned — one account, your own
  machines — but deliberately deferred until the data model settles, since a
  project is stored as JSON and that shape would become the schema.
- **Builds are unsigned**, as above.
