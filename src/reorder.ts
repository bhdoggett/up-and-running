import type { Checklist } from "./types";

/**
 * Move a step, within its section or into another one. Insertion is always
 * "before `beforeTaskId`"; a null target appends to the end of `toSectionId`.
 * Returns the checklist unchanged when the move is a no-op.
 */
export function moveTask(
  checklist: Checklist,
  taskId: string,
  fromSectionId: string,
  toSectionId: string,
  beforeTaskId: string | null,
): Checklist {
  // Dropping a task on itself would otherwise remove it and re-append at the end.
  if (taskId === beforeTaskId) return checklist;

  const from = checklist.sections.find((s) => s.id === fromSectionId);
  const task = from?.tasks.find((t) => t.id === taskId);
  if (!task) return checklist;

  const stripped = checklist.sections.map((s) =>
    s.id === fromSectionId ? { ...s, tasks: s.tasks.filter((t) => t.id !== taskId) } : s,
  );

  return {
    ...checklist,
    sections: stripped.map((s) => {
      if (s.id !== toSectionId) return s;
      const tasks = [...s.tasks];
      const at = beforeTaskId ? tasks.findIndex((t) => t.id === beforeTaskId) : tasks.length;
      tasks.splice(at === -1 ? tasks.length : at, 0, task);
      return { ...s, tasks };
    }),
  };
}

/**
 * Move a section before `beforeSectionId`, or to the end when that is null.
 */
export function moveSection(
  checklist: Checklist,
  sectionId: string,
  beforeSectionId: string | null,
): Checklist {
  const moving = checklist.sections.find((s) => s.id === sectionId);
  if (!moving || sectionId === beforeSectionId) return checklist;

  const rest = checklist.sections.filter((s) => s.id !== sectionId);
  const at = beforeSectionId ? rest.findIndex((s) => s.id === beforeSectionId) : rest.length;
  rest.splice(at === -1 ? rest.length : at, 0, moving);
  return { ...checklist, sections: rest };
}
