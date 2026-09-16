// What the user is currently dragging. Kept in React state rather than the
// DataTransfer payload, because dragover handlers need to inspect it to decide
// whether a drop is allowed, and DataTransfer values aren't readable then.
export type Drag =
  | { type: "task"; taskId: string; fromSectionId: string }
  | { type: "section"; sectionId: string }
  | null;

/** Where the item would land, so the UI can draw an insertion line. */
export type DropTarget =
  | { type: "task"; sectionId: string; beforeTaskId: string | null }
  /** null means "after the last section" — the tail zone below the list. */
  | { type: "section"; beforeSectionId: string | null }
  | null;

/** Mark the event as a move so the cursor shows the right affordance. */
export function acceptDrop(e: React.DragEvent) {
  e.preventDefault();
  e.stopPropagation();
  e.dataTransfer.dropEffect = "move";
}
