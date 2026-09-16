import { describe, expect, it } from "vitest";
import {
  allFiles,
  allTasks,
  migrateState,
  normalizeProject,
  withSections,
  type AppState,
  type Checklist,
  type Project,
} from "./types";

function task(id: string, done = false) {
  return { id, title: id, details: "", done, resources: [] };
}

describe("withSections", () => {
  it("wraps a pre-sections flat task list in one unnamed section", () => {
    const old = { id: "c", name: "Old", tasks: [task("t1"), task("t2")] } as unknown as Checklist;
    const out = withSections(old);
    expect(out.sections).toHaveLength(1);
    expect(out.sections[0].name).toBe("");
    expect(out.sections[0].tasks.map((t) => t.id)).toEqual(["t1", "t2"]);
  });

  it("keeps existing sections as they are", () => {
    const c = {
      id: "c",
      name: "N",
      sections: [{ id: "s", name: "Setup", collapsed: true, tasks: [task("t1")] }],
    } as unknown as Checklist;
    const out = withSections(c);
    expect(out.sections).toHaveLength(1);
    expect(out.sections[0].name).toBe("Setup");
    expect(out.sections[0].collapsed).toBe(true);
  });

  it("backfills missing description and resources", () => {
    const out = withSections({ id: "c", name: "N", tasks: [] } as unknown as Checklist);
    expect(out.description).toBe("");
    expect(out.resources).toEqual([]);
  });

  it("survives a checklist with neither tasks nor sections", () => {
    const out = withSections({ id: "c", name: "N" } as unknown as Checklist);
    expect(out.sections[0].tasks).toEqual([]);
  });
});

describe("migrateState", () => {
  it("moves a pre-projects save into one starter project", () => {
    const saved = {
      checklists: [{ id: "c1", name: "Setup", tasks: [task("t1")] }],
      docs: [{ id: "d1", name: "Wiring", body: "x", resources: [] }],
      files: [{ id: "f1", label: "v.mp4", kind: "file", target: "/v.mp4" }],
      active: { kind: "checklist", id: "c1" },
    } as unknown as AppState;

    const out = migrateState(saved);
    expect(out.projects).toHaveLength(1);
    expect(out.projects[0].checklists).toHaveLength(1);
    expect(out.projects[0].docs).toHaveLength(1);
    expect(out.projects[0].files).toHaveLength(1);
    expect(out.activeProjectId).toBe(out.projects[0].id);
    expect(out.active).toEqual({ kind: "checklist", id: "c1" });
  });

  it("converts the oldest activeChecklistId pointer", () => {
    const out = migrateState({
      checklists: [{ id: "c1", name: "Old", tasks: [] }],
      activeChecklistId: "c1",
    } as unknown as AppState);
    expect(out.active).toEqual({ kind: "checklist", id: "c1" });
  });

  it("leaves an already-migrated save alone", () => {
    const project: Project = {
      id: "p1",
      name: "Sunday",
      checklists: [],
      docs: [],
      files: [],
    };
    const out = migrateState({
      projects: [project],
      activeProjectId: "p1",
      active: null,
    } as AppState);
    expect(out.projects).toHaveLength(1);
    expect(out.activeProjectId).toBe("p1");
  });

  it("falls back to the first project when the active id is stale", () => {
    const out = migrateState({
      projects: [{ id: "p1", name: "A", checklists: [], docs: [], files: [] }],
      activeProjectId: "gone",
      active: null,
    } as AppState);
    expect(out.activeProjectId).toBe("p1");
  });

  it("produces a usable project from an empty save", () => {
    const out = migrateState({} as AppState);
    expect(out.projects).toHaveLength(1);
    expect(out.projects[0].checklists).toEqual([]);
    expect(out.active).toBeNull();
  });
});

describe("normalizeProject", () => {
  it("fills in every missing field", () => {
    const p = normalizeProject({});
    expect(p.id).toBeTruthy();
    expect(p.name).toBe("Untitled project");
    expect(p).toMatchObject({ checklists: [], docs: [], files: [] });
  });

  it("names an unnamed project rather than leaving it blank", () => {
    expect(normalizeProject({ name: "   " }).name).toBe("Untitled project");
  });
});

describe("allTasks", () => {
  it("flattens sections in display order", () => {
    const c = withSections({
      id: "c",
      name: "N",
      sections: [
        { id: "s1", name: "One", collapsed: false, tasks: [task("a"), task("b")] },
        { id: "s2", name: "Two", collapsed: false, tasks: [task("c")] },
      ],
    } as unknown as Checklist);
    expect(allTasks(c).map((t) => t.id)).toEqual(["a", "b", "c"]);
  });
});

describe("allFiles", () => {
  const file = (id: string, target: string) => ({
    id,
    label: target,
    kind: "file" as const,
    target,
  });

  it("gathers files from the project, its checklists, steps, and docs", () => {
    const project: Project = {
      id: "p",
      name: "P",
      files: [file("f1", "/loose.pdf")],
      docs: [{ id: "d", name: "Doc", body: "", resources: [file("f4", "/doc.pdf")] }],
      checklists: [
        {
          id: "c",
          name: "List",
          description: "",
          resources: [file("f2", "/overview.mp4")],
          sections: [
            {
              id: "s",
              name: "",
              collapsed: false,
              tasks: [
                { ...task("t"), title: "Step", resources: [file("f3", "/step.png")] },
              ],
            },
          ],
        },
      ],
    };

    const found = allFiles(project);
    expect(found.map((f) => f.resource.target).sort()).toEqual([
      "/doc.pdf",
      "/loose.pdf",
      "/overview.mp4",
      "/step.png",
    ]);
  });

  it("deduplicates one file used in several places", () => {
    const project: Project = {
      id: "p",
      name: "P",
      files: [file("f1", "/same.pdf")],
      docs: [{ id: "d", name: "Doc", body: "", resources: [file("f2", "/same.pdf")] }],
      checklists: [],
    };
    expect(allFiles(project)).toHaveLength(1);
  });

  it("labels where each file came from", () => {
    const project: Project = {
      id: "p",
      name: "P",
      files: [],
      docs: [],
      checklists: [
        {
          id: "c",
          name: "Sunday",
          description: "",
          resources: [],
          sections: [
            {
              id: "s",
              name: "",
              collapsed: false,
              tasks: [
                { ...task("t"), title: "Power on", resources: [file("f", "/x.mp4")] },
              ],
            },
          ],
        },
      ],
    };
    expect(allFiles(project)[0].where).toBe("Sunday › Power on");
  });

  it("ignores web and in-app links", () => {
    const project: Project = {
      id: "p",
      name: "P",
      files: [
        { id: "w", label: "site", kind: "web", target: "https://example.com" },
        { id: "l", label: "doc", kind: "doc", target: "some-doc-id" },
      ],
      docs: [],
      checklists: [],
    };
    expect(allFiles(project)).toEqual([]);
  });
});
