import { describe, expect, it } from "vitest";
import { isCommandEnter } from "./keys";

const key = (key: string, mods: { metaKey?: boolean; ctrlKey?: boolean } = {}) => ({
  key,
  metaKey: false,
  ctrlKey: false,
  ...mods,
});

describe("isCommandEnter", () => {
  it("accepts Cmd+Enter and Ctrl+Enter", () => {
    expect(isCommandEnter(key("Enter", { metaKey: true }))).toBe(true);
    expect(isCommandEnter(key("Enter", { ctrlKey: true }))).toBe(true);
  });

  it("leaves plain Enter alone, since it types a newline", () => {
    expect(isCommandEnter(key("Enter"))).toBe(false);
  });

  it("ignores the modifier without Enter", () => {
    expect(isCommandEnter(key("s", { metaKey: true }))).toBe(false);
    expect(isCommandEnter(key("Escape", { metaKey: true }))).toBe(false);
  });
});
