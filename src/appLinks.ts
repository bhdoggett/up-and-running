import { convertFileSrc } from "@tauri-apps/api/core";
import { openPath, openUrl } from "@tauri-apps/plugin-opener";
import { message } from "@tauri-apps/plugin-dialog";
import { isLocalPath } from "./components/MarkdownView/MarkdownView";
import {
  IMAGE_DIR,
  decodeMarkdownUrl,
  ensureImages,
  imagesDirSync,
  isAppImage,
} from "./images";

// In-app image resolution: pictures stored in the app's own image folder are
// found by name, other local paths go through Tauri's asset protocol so the
// webview can load them, and web/data URLs pass through unchanged.
export function resolveAppImage(src: string): string {
  if (isAppImage(src)) {
    const dir = imagesDirSync();
    if (!dir) {
      // Not known yet — start finding it; the view redraws when it lands.
      ensureImages();
      return src;
    }
    const name = decodeMarkdownUrl(src.slice(IMAGE_DIR.length + 1));
    return convertFileSrc(`${dir}/${name}`);
  }
  return isLocalPath(src) ? convertFileSrc(decodeMarkdownUrl(src)) : src;
}

// A link inside Markdown, whose destination arrives percent-encoded. Web
// addresses are left as they came; a file path is decoded back to its name.
export function openMarkdownLink(href: string): Promise<void> {
  return openLink(isLocalPath(href) ? decodeMarkdownUrl(href) : href);
}

// Add a scheme to bare web addresses ("youtube.com/x" -> "https://youtube.com/x")
// so they open in the browser instead of being mistaken for a file path.
// Absolute paths and anything already carrying a scheme are left alone.
export function normalizeTarget(target: string): string {
  const s = target.trim();
  if (/^[a-z][a-z0-9+.-]*:/i.test(s)) return s; // https:, mailto:, file:, data:…
  if (s.startsWith("/") || s.startsWith("~") || /^[a-z]:[\\/]/i.test(s)) return s;
  if (/^[\w-]+(\.[\w-]+)+([/?#].*)?$/.test(s)) return `https://${s}`;
  return s;
}

// Open a link the way the OS would: files with the default app, URLs in the browser.
// Failures surface as a dialog — a silent console error just looks like a dead link.
export async function openLink(href: string): Promise<void> {
  const target = normalizeTarget(href);
  if (!target || target === "https://") {
    await message("This entry has no address yet. Use the pencil to set one.", {
      title: "Nothing to open",
      kind: "warning",
    });
    return;
  }
  try {
    if (isLocalPath(target)) {
      await openPath(target);
    } else {
      await openUrl(target);
    }
  } catch (e) {
    console.error("Failed to open link", target, e);
    await message(`Could not open:\n${target}\n\n${e instanceof Error ? e.message : String(e)}`, {
      title: "Couldn't open link",
      kind: "error",
    });
  }
}

