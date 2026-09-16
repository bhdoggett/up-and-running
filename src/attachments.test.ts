import { describe, expect, it } from "vitest";
import { safeAttachmentName } from "./attachments";

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
