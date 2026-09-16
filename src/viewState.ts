/**
 * A one-shot instruction from "Collapse all" / "Expand all" down to each step.
 *
 * Whether a step is expanded is local to that step — it isn't saved, and
 * lifting it into the checklist would mean storing view state alongside the
 * content. Instead the count changes on every click, and steps react to a
 * count they haven't seen yet.
 */
export interface ExpandPulse {
  count: number;
  open: boolean;
}

export const NO_PULSE: ExpandPulse = { count: 0, open: false };
