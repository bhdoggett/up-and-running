import { convertFileSrc } from "@tauri-apps/api/core";
import { openPath, openUrl } from "@tauri-apps/plugin-opener";
import { isLocalPath } from "./components/MarkdownView/MarkdownView";

// In-app image resolution: local file paths go through Tauri's asset protocol
// so the webview can load them; web/data URLs pass through unchanged.
export function resolveAppImage(src: string): string {
  return isLocalPath(src) ? convertFileSrc(src) : src;
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
export async function openLink(href: string): Promise<void> {
  const target = normalizeTarget(href);
  try {
    if (isLocalPath(target)) {
      await openPath(target);
    } else {
      await openUrl(target);
    }
  } catch (e) {
    console.error("Failed to open link", target, e);
  }
}
