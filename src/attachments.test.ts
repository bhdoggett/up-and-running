import { describe, expect, it } from "vitest";
import { contentAddressedName, safeAttachmentName } from "./attachments";

const bytes = (s: string) => new TextEncoder().encode(s);

describe("contentAddressedName", () => {
  it("gives the same name to the same file every time", async () => {
    // This is what makes attaching one file in two places store it once.
    const a = await contentAddressedName(bytes("video"), "clip.mp4");
    const b = await contentAddressedName(bytes("video"), "clip.mp4");
    expect(a).toBe(b);
  });

  it("separates files whose contents differ", async () => {
    const a = await contentAddressedName(bytes("one"), "clip.mp4");
    const b = await contentAddressedName(bytes("two"), "clip.mp4");
    expect(a).not.toBe(b);
  });

  it("keeps the original name readable after the hash", async () => {
    const out = await contentAddressedName(bytes("x"), "Sound check.mp4");
    expect(out.endsWith("-Sound check.mp4")).toBe(true);
  });

  it("sanitises the name it appends", async () => {
    const out = await contentAddressedName(bytes("x"), "../../etc/passwd");
    expect(out).not.toContain("/");
  });
});

describe("safeAttachmentName", () => {
  it("leaves an ordinary filename alone", () => {
    expect(safeAttachmentName("Sound board walkthrough.mp4")).toBe(
      "Sound board walkthrough.mp4",
    );
  });

  it("refuses to let a name walk out of the folder", () => {
    expect(safeAttachmentName("../../etc/passwd")).not.toContain("/");
    expect(safeAttachmentName("..\\..\\windows\\system32")).not.toContain("\\");
  });

  it("drops leading dots so nothing lands hidden or as '..'", () => {
    expect(safeAttachmentName("...hidden.pdf")).toBe("hidden.pdf");
    expect(safeAttachmentName("..")).toBe("attachment");
  });

  it("removes characters the filesystem objects to", () => {
    expect(safeAttachmentName('re:port*"<>|.pdf')).toBe("report.pdf");
  });

  it("keeps the extension when truncating a long name", () => {
    const long = "a".repeat(200) + ".mp4";
    const out = safeAttachmentName(long);
    expect(out.length).toBeLessThanOrEqual(80);
    expect(out.endsWith(".mp4")).toBe(true);
  });

  it("falls back rather than returning an empty name", () => {
    expect(safeAttachmentName("")).toBe("attachment");
    expect(safeAttachmentName("///")).toBe("---");
  });
});
