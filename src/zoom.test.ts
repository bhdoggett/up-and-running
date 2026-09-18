import { describe, expect, it } from "vitest";
import { DEFAULT_ZOOM, ZOOM_STEPS, clampZoom, nextZoom } from "./zoom";

describe("nextZoom", () => {
  it("moves one stop along the ladder", () => {
    expect(nextZoom(1, "in")).toBe(1.1);
    expect(nextZoom(1, "out")).toBe(0.9);
  });

  it("stops at either end rather than running off it", () => {
    const smallest = ZOOM_STEPS[0];
    const largest = ZOOM_STEPS[ZOOM_STEPS.length - 1];
    expect(nextZoom(smallest, "out")).toBe(smallest);
    expect(nextZoom(largest, "in")).toBe(largest);
  });

  it("returns to actual size from anywhere", () => {
    expect(nextZoom(2, "reset")).toBe(DEFAULT_ZOOM);
    expect(nextZoom(0.7, "reset")).toBe(DEFAULT_ZOOM);
  });

  it("walks the whole ladder and back without drifting", () => {
    let zoom = ZOOM_STEPS[0];
    for (let i = 1; i < ZOOM_STEPS.length; i++) zoom = nextZoom(zoom, "in");
    expect(zoom).toBe(ZOOM_STEPS[ZOOM_STEPS.length - 1]);
    for (let i = 1; i < ZOOM_STEPS.length; i++) zoom = nextZoom(zoom, "out");
    expect(zoom).toBe(ZOOM_STEPS[0]);
  });

  it("snaps an off-ladder level onto the nearest stop first", () => {
    expect(nextZoom(1.42, "in")).toBe(1.6);
  });
});

describe("clampZoom", () => {
  it("keeps values that are already stops", () => {
    for (const step of ZOOM_STEPS) expect(clampZoom(step)).toBe(step);
  });

  it("pulls anything else onto the ladder", () => {
    expect(clampZoom(1.3)).toBe(1.25);
    expect(clampZoom(9)).toBe(ZOOM_STEPS[ZOOM_STEPS.length - 1]);
    expect(clampZoom(0.01)).toBe(ZOOM_STEPS[0]);
  });

  it("falls back to actual size for a missing or nonsense value", () => {
    expect(clampZoom(Number(null))).toBe(DEFAULT_ZOOM);
    expect(clampZoom(Number("nope"))).toBe(DEFAULT_ZOOM);
    expect(clampZoom(-2)).toBe(DEFAULT_ZOOM);
  });
});
