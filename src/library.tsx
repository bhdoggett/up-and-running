import { createContext, useContext, type ReactNode } from "react";
import type { Checklist, Doc, Resource, Selection } from "./types";

interface LibraryValue {
  checklists: Checklist[];
  docs: Doc[];
  /** Id of the item on screen, so it can't be offered as a link to itself. */
  currentId: string | null;
  /** Jump to a checklist or doc in the main pane. */
  navigate: (sel: Selection) => void;
}

const LibraryContext = createContext<LibraryValue | null>(null);

export function LibraryProvider({
  value,
  children,
}: {
  value: LibraryValue;
  children: ReactNode;
}) {
  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useLibrary(): LibraryValue {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error("useLibrary must be used inside a LibraryProvider");
  return ctx;
}

export function isInternal(kind: Resource["kind"]): boolean {
  return kind === "doc" || kind === "checklist";
}

/** id → current name, so exports can bake in the names of linked items. */
export function useNameMap(): Record<string, string> {
  const { checklists, docs } = useLibrary();
  const names: Record<string, string> = {};
  for (const c of checklists) names[c.id] = c.name;
  for (const d of docs) names[d.id] = d.name;
  return names;
}

/**
 * What to show for a resource. Internal links follow the target item's current
 * name so renaming a doc updates every link to it; an explicit label wins.
 */
export function useResourceLabel(): (r: Resource) => string {
  const { checklists, docs } = useLibrary();
  return (r: Resource) => {
    if (r.label.trim()) return r.label;
    if (r.kind === "doc") {
      return docs.find((d) => d.id === r.target)?.name ?? "(missing doc)";
    }
    if (r.kind === "checklist") {
      return checklists.find((c) => c.id === r.target)?.name ?? "(missing checklist)";
    }
    return r.target;
  };
}
