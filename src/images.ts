import { appDataDir, join } from "@tauri-apps/api/path";
import { mkdir, writeFile } from "@tauri-apps/plugin-fs";
import { contentAddressedName } from "./attachments";

/**
 * Pictures used *inside* Markdown live in their own folder, separate from the
 * files attached to steps: a screenshot pasted into an explanation is part of
 * the writing, not a resource someone opens.
 *
 * Markdown refers to them by a short relative path — `images/ab12cd-map.png` —
 * rather than by where the original sat on one machine. That reference means
 * the same thing wherever the project is opened, and the export inlines the
 * bytes, so a picture keeps working on a machine that never had the original.
 */
export const IMAGE_DIR = "images";

/** A Markdown src that points into the app's own image folder. */
export function isAppImage(src: string): boolean {
  return src.startsWith(`${IMAGE_DIR}/`) && !src.includes("..");
}

/** The reference written into Markdown for a stored image. */
export function appImageRef(fileName: string): string {
  return `${IMAGE_DIR}/${fileName}`;
}

/**
 * Markdown link destinations can't contain spaces or parentheses unless they
 * are wrapped in angle brackets, which is why a pasted path like
 * `/Users/me/My Screens/shot (2).png` renders as plain text instead of a
 * picture.
 */
export function markdownUrl(target: string): string {
  return /[\s()<>]/.test(target) ? `<${target.replace(/([<>])/g, "\\$1")}>` : target;
}

/**
 * Markdown parsers hand back link destinations percent-encoded: a picture
 * stored as `Screen Shot 10.36 AM.png` arrives as `Screen%20Shot%2010.36…`.
 * A file path has to be the real name, and encoding it a second time on the
 * way to the webview is what makes a perfectly good picture fail to load.
 */
export function decodeMarkdownUrl(src: string): string {
  try {
    return decodeURIComponent(src);
  } catch {
    return src; // a stray % that isn't an escape — take it literally
  }
}

/**
 * `![alt](dest)`, where dest is either bare or, when it contains spaces,
 * wrapped in angle brackets: `![alt](<My Folder/shot.png>)`.
 */
const MARKDOWN_IMAGE_RE = /!\[([^\]]*)\]\(\s*(?:<([^>]+)>|([^)\s]+))[^)]*\)/g;

/** Every image destination in a piece of Markdown, in source order. */
export function markdownImageSources(text: string): string[] {
  return [...text.matchAll(MARKDOWN_IMAGE_RE)].map((m) => m[2] ?? m[3]);
}

/** Swap image destinations for new ones, leaving alt text and the rest alone. */
export function rewriteImageSources(text: string, map: Map<string, string>): string {
  if (map.size === 0) return text;
  return text.replace(MARKDOWN_IMAGE_RE, (whole, _alt, angle, bare) => {
    const src = angle ?? bare;
    const next = map.get(src);
    return next ? whole.replace(src, next) : whole;
  });
}

/** Pictures carried inline in the Markdown, as an imported bundle has them. */
export function dataImageSources(text: string): string[] {
  return markdownImageSources(text).filter((s) => s.startsWith("data:image/"));
}

/**
 * A filename for a picture that arrived as bytes with no name of its own —
 * from its alt text where there is one, and its own media type for the
 * extension, which is what makes it load again once stored.
 */
export function dataImageName(uri: string, alt: string, index: number): string {
  const mime = uri.slice(5, uri.indexOf(";") === -1 ? uri.indexOf(",") : uri.indexOf(";"));
  const ext = mime.split("/")[1]?.replace(/\+xml$/, "") || "png";
  const stem = parseImageAlt(alt).text.trim().replace(/[^\w -]+/g, "") || `image-${index + 1}`;
  return `${stem}.${ext}`;
}

/** The alt text of each image in a piece of Markdown, in source order. */
export function markdownImageAlts(text: string): string[] {
  return [...text.matchAll(MARKDOWN_IMAGE_RE)].map((m) => m[1]);
}

/** `![alt](dest)`, with the destination escaped if it needs it. */
export function imageMarkdown(alt: string, target: string): string {
  return `![${alt.replace(/[[\]]/g, "")}](${markdownUrl(target)})`;
}

/**
 * A width can be written into the alt text after a pipe — `![stage map|420]` —
 * the same shorthand Obsidian uses. It rides along in plain Markdown, so a
 * resized picture stays resized in an export and in any other reader, which an
 * HTML `<img width>` would not (raw HTML is deliberately not rendered).
 */
export interface ImageAlt {
  text: string;
  width: number | null;
}

export function parseImageAlt(alt: string): ImageAlt {
  const m = alt.match(/^(.*)\|\s*(\d{1,5})\s*$/);
  if (!m) return { text: alt, width: null };
  return { text: m[1].trimEnd(), width: Number(m[2]) };
}

export function formatImageAlt({ text, width }: ImageAlt): string {
  return width ? `${text}|${Math.round(width)}` : text;
}

/**
 * Rewrite the width of one picture in a body of Markdown, matching it by its
 * destination. A width of null clears it, putting the picture back to its
 * natural size.
 */
export function setImageWidth(
  markdown: string,
  target: string,
  width: number | null,
): string {
  return markdown.replace(
    /!\[([^\]]*)\]\(\s*(?:<([^>]+)>|([^)\s]+))([^)]*)\)/g,
    (whole, alt: string, angle: string, bare: string, trailing: string) => {
      const dest = angle ?? bare;
      if (decodeMarkdownUrl(dest) !== decodeMarkdownUrl(target)) return whole;
      const next = formatImageAlt({ ...parseImageAlt(alt), width });
      const written = angle !== undefined ? `<${angle}>` : bare;
      return `![${next}](${written}${trailing})`;
    },
  );
}

/** Absolute path of the image folder. */
export async function imagesDir(): Promise<string> {
  return join(await appDataDir(), IMAGE_DIR);
}

/** Absolute path a stored reference resolves to. */
export async function appImagePath(ref: string): Promise<string> {
  return join(await imagesDir(), ref.slice(IMAGE_DIR.length + 1));
}

/**
 * Copy bytes into the image folder and return the reference to write into
 * Markdown. Named by content, so adding the same picture twice stores it once.
 */
export async function saveImage(bytes: Uint8Array, name: string): Promise<string> {
  const dir = await imagesDir();
  await mkdir(dir, { recursive: true });
  const fileName = await contentAddressedName(bytes, name);
  await writeFile(await join(dir, fileName), bytes);
  return appImageRef(fileName);
}

/**
 * Where the webview should load an image reference from. Markdown rendering is
 * synchronous and can't await a path lookup, so the folder is remembered.
 *
 * It is remembered in localStorage rather than in this module alone: a value
 * held only in memory is lost whenever the module is re-evaluated — which a
 * hot reload does routinely — and startup, the one thing that sets it, has
 * long since run. Every picture then quietly fails to load. The folder is the
 * same on every launch of a given machine, so reading it back is safe, and it
 * is refreshed from the real lookup each startup.
 */
const DIR_KEY = "up-and-running:images-dir";

function remembered(): string | null {
  try {
    return localStorage.getItem(DIR_KEY);
  } catch {
    return null; // no storage (tests, or a locked-down webview)
  }
}

let cachedDir: string | null = remembered();

export async function initImages(): Promise<void> {
  const dir = await imagesDir();
  await mkdir(dir, { recursive: true }).catch(() => {});
  cachedDir = dir;
  try {
    localStorage.setItem(DIR_KEY, dir);
  } catch {
    // Not fatal: this run keeps the value in memory.
  }
  tick += 1;
  for (const listener of listeners) listener();
}

export function imagesDirSync(): string | null {
  return cachedDir;
}

/**
 * Anything that rendered before the folder was known asks to be told, rather
 * than being left showing a broken picture until something else happens to
 * redraw it. A render that finds no folder starts the lookup itself.
 */
let tick = 0;
const listeners = new Set<() => void>();

export function ensureImages(): void {
  if (!cachedDir) void initImages();
}

export function subscribeImages(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function imagesTick(): number {
  return tick;
}
