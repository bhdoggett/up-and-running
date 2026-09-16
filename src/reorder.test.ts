import { describe, expect, it } from "vitest";
import { moveSection, moveTask } from "./reorder";
import type { Checklist } from "./types";

// Compact fixture: two sections, "A" with three steps and "B" with two.
function fixture(): Checklist {
  return {
    id: "cl",
    name: "Test",
    description: "",
    resources: [],
    sections: [
      {
        id: "A",
        name: "A",
        collapsed: false,
        tasks: ["a1", "a2", "a3"].map((id) => ({
          id,
          title: id,
          details: "",
          done: false,
          resources: [],
        })),
      },
      {
        id: "B",
        name: "B",
        collapsed: false,
        tasks: ["b1", "b2"].map((id) => ({
          id,
          title: id,
          details: "",
          done: false,
          resources: [],
        })),
      },
    ],
  };
}

/** "A[a1,a2] B[b1]" — readable shape for assertions. */
function shape(c: Checklist): string {
  return c.sections.map((s) => `${s.id}[${s.tasks.map((t) => t.id).join(",")}]`).join(" ");
}

describe("moveTask", () => {
  it("moves a step up within its section", () => {
    const out = moveTask(fixture(), "a3", "A", "A", "a1");
    expect(shape(out)).toBe("A[a3,a1,a2] B[b1,b2]");
  });

  it("moves a step down within its section", () => {
    const out = moveTask(fixture(), "a1", "A", "A", "a3");
    expect(shape(out)).toBe("A[a2,a1,a3] B[b1,b2]");
  });

  it("appends to the end when there is no target", () => {
    const out = moveTask(fixture(), "a1", "A", "A", null);
    expect(shape(out)).toBe("A[a2,a3,a1] B[b1,b2]");
  });

  it("moves a step into another section at the right position", () => {
    const out = moveTask(fixture(), "a1", "A", "B", "b2");
    expect(shape(out)).toBe("A[a2,a3] B[b1,a1,b2]");
  });

  it("appends to the end of another section", () => {
    const out = moveTask(fixture(), "a1", "A", "B", null);
    expect(shape(out)).toBe("A[a2,a3] B[b1,b2,a1]");
  });

  it("does nothing when a step is dropped on itself", () => {
    const before = fixture();
    expect(shape(moveTask(before, "a2", "A", "A", "a2"))).toBe(shape(before));
  });

  it("ignores an unknown step rather than dropping data", () => {
    const before = fixture();
    expect(shape(moveTask(before, "nope", "A", "B", null))).toBe(shape(before));
  });

  it("ignores an unknown source section", () => {
    const before = fixture();
    expect(shape(moveTask(before, "a1", "ZZZ", "B", null))).toBe(shape(before));
  });

  it("never loses or duplicates steps", () => {
    const out = moveTask(fixture(), "a2", "A", "B", "b1");
    const ids = out.sections.flatMap((s) => s.tasks.map((t) => t.id));
    expect(ids.slice().sort()).toEqual(["a1", "a2", "a3", "b1", "b2"]);
  });

  it("leaves the original checklist untouched", () => {
    const before = fixture();
    moveTask(before, "a1", "A", "B", null);
    expect(shape(before)).toBe("A[a1,a2,a3] B[b1,b2]");
  });
});

describe("moveSection", () => {
  it("moves a section before another", () => {
    const out = moveSection(fixture(), "B", "A");
    expect(out.sections.map((s) => s.id)).toEqual(["B", "A"]);
  });

  it("moves a section to the end", () => {
    const out = moveSection(fixture(), "A", null);
    expect(out.sections.map((s) => s.id)).toEqual(["B", "A"]);
  });

  it("does nothing when dropped on itself", () => {
    const out = moveSection(fixture(), "A", "A");
    expect(out.sections.map((s) => s.id)).toEqual(["A", "B"]);
  });

  it("ignores an unknown section", () => {
    const out = moveSection(fixture(), "ZZZ", "A");
    expect(out.sections.map((s) => s.id)).toEqual(["A", "B"]);
  });

  it("keeps each section's steps with it", () => {
    expect(shape(moveSection(fixture(), "B", "A"))).toBe("B[b1,b2] A[a1,a2,a3]");
  });
});
