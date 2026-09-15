import { convertFileSrc } from "@tauri-apps/api/core";
import { openPath, openUrl } from "@tauri-apps/plugin-opener";
import { isLocalPath } from "./components/MarkdownView/MarkdownView";

// In-app image resolution: local file paths go through Tauri's asset protocol
// so the webview can load them; web/data URLs pass through unchanged.
export function resolveAppImage(src: string): string {
  return isLocalPath(src) ? convertFileSrc(src) : src;
}

// Open a link the way the OS would: files with the default app, URLs in the browser.
export async function openLink(href: string): Promise<void> {
  try {
    if (isLocalPath(href)) {
      await openPath(href);
    } else {
      await openUrl(href);
    }
  } catch (e) {
    console.error("Failed to open link", href, e);
  }
}
