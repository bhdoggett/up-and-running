/**
 * Cmd+Enter (Ctrl+Enter on Windows) means "I'm finished here" — it closes
 * whichever editor is open. Plain Enter is left alone, because the editors
 * contain multi-line text where Enter has to insert a newline.
 */
export function isCommandEnter(e: {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
}): boolean {
  return e.key === "Enter" && (e.metaKey || e.ctrlKey);
}
