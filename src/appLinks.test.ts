import { describe, expect, it } from "vitest";
import { normalizeTarget } from "./appLinks";
import { isLocalPath } from "./components/MarkdownView/MarkdownView";

describe("normalizeTarget", () => {
  it("adds https:// to a bare domain so it opens in a browser", () => {
    // This was a real bug: "youtube.com/x" was treated as a file path.
    expect(normalizeTarget("youtube.com")).toBe("https://youtube.com");
    expect(normalizeTarget("youtube.com/watch?v=abc")).toBe(
      "https://youtube.com/watch?v=abc",
    );
    expect(normalizeTarget("www.example.co.uk/a/b")).toBe(
      "https://www.example.co.uk/a/b",
    );
  });

  it("leaves anything that already has a scheme alone", () => {
    for (const url of [
      "https://example.com",
      "http://example.com",
      "mailto:a@b.com",
      "file:///Users/me/x.pdf",
      "data:image/png;base64,AAA",
    ]) {
      expect(normalizeTarget(url)).toBe(url);
    }
  });

  it("leaves absolute and home paths as paths", () => {
    expect(normalizeTarget("/Users/me/video.mp4")).toBe("/Users/me/video.mp4");
    expect(normalizeTarget("~/video.mp4")).toBe("~/video.mp4");
    expect(normalizeTarget("C:\\Users\\me\\video.mp4")).toBe("C:\\Users\\me\\video.mp4");
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeTarget("  https://example.com  ")).toBe("https://example.com");
  });

  it("leaves plain words alone rather than inventing a URL", () => {
    expect(normalizeTarget("just some text")).toBe("just some text");
    expect(normalizeTarget("")).toBe("");
  });
});

describe("isLocalPath", () => {
  it("treats scheme-carrying targets as remote", () => {
    expect(isLocalPath("https://example.com")).toBe(false);
    expect(isLocalPath("data:image/png;base64,AAA")).toBe(false);
    expect(isLocalPath("mailto:a@b.com")).toBe(false);
  });

  it("treats file paths as local", () => {
    expect(isLocalPath("/Users/me/x.png")).toBe(true);
    expect(isLocalPath("images/diagram.png")).toBe(true);
  });

  it("treats an empty target as not local", () => {
    expect(isLocalPath("")).toBe(false);
    expect(isLocalPath(undefined)).toBe(false);
  });
});
