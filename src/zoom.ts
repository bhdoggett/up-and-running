import { listen } from "@tauri-apps/api/event";
import { getCurrentWebview } from "@tauri-apps/api/webview";

const ZOOM_KEY = "up-and-running:zoom";

/**
 * Fixed stops rather than a multiplier, so a press always lands on the same
 * size, Actual Size is exactly one of them, and the ends are hard stops.
 */
export const ZOOM_STEPS = [0.7, 0.8, 0.9, 1, 1.1, 1.25, 1.4, 1.6, 1.8, 2];
export const DEFAULT_ZOOM = 1;

export type ZoomDirection = "in" | "out" | "reset";

/** Index of the closest stop; a tie goes to the smaller one. */
function nearestStep(zoom: number): number {
  let best = 0;
  for (let i = 1; i < ZOOM_STEPS.length; i++) {
    if (Math.abs(ZOOM_STEPS[i] - zoom) < Math.abs(ZOOM_STEPS[best] - zoom)) best = i;
  }
  return best;
}

/** Snap to the ladder so a stale or hand-edited value can't stick. */
export function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom) || zoom <= 0) return DEFAULT_ZOOM;
  return ZOOM_STEPS[nearestStep(zoom)];
}

/** The stop one move away, or the current one when already at the end. */
export function nextZoom(current: number, direction: ZoomDirection): number {
  if (direction === "reset") return DEFAULT_ZOOM;
  const i = nearestStep(current) + (direction === "in" ? 1 : -1);
  return ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, Math.max(0, i))];
}

function readZoom(): number {
  return clampZoom(Number(localStorage.getItem(ZOOM_KEY)));
}

async function apply(zoom: number) {
  try {
    await getCurrentWebview().setZoom(zoom);
  } catch (e) {
    console.error("Could not set the zoom level", e);
  }
}

/**
 * Restore the saved zoom and keep it in step with View > Zoom. Returns a
 * teardown function.
 */
export function initZoom(): () => void {
  let zoom = readZoom();
  void apply(zoom);

  function go(direction: ZoomDirection) {
    const next = nextZoom(zoom, direction);
    if (next === zoom) return;
    zoom = next;
    localStorage.setItem(ZOOM_KEY, String(zoom));
    void apply(zoom);
  }

  const unlisten = listen<ZoomDirection>("zoom", (e) => go(e.payload));

  /**
   * The menu accelerators are the plain keys — Cmd+= and Cmd+- — because that
   * is what the keyboard sends. Holding shift to type a literal "+" produces a
   * combination no menu item claims, so catch that one here. Everything the
   * menu does claim is left alone, or it would step twice.
   */
  function onKeyDown(e: KeyboardEvent) {
    if (!(e.metaKey || e.ctrlKey) || !e.shiftKey || e.altKey) return;
    if (e.code !== "Equal" && e.key !== "+") return;
    e.preventDefault();
    go("in");
  }
  window.addEventListener("keydown", onKeyDown);

  return () => {
    window.removeEventListener("keydown", onKeyDown);
    void unlisten.then((off) => off());
  };
}
