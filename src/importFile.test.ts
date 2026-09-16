import { describe, expect, it } from "vitest";
import { parseLooseJson } from "./importFile";

// What an LLM actually returns varies: bare JSON, fenced, or wrapped in prose.
const obj = { name: "Test", sections: [{ name: "", collapsed: false, tasks: [] }] };
const json = JSON.stringify(obj, null, 2);

describe("parseLooseJson", () => {
  it("reads bare JSON", () => {
    expect(parseLooseJson(json)).toEqual(obj);
  });

  it("reads a ```json fenced block", () => {
    expect(parseLooseJson("```json\n" + json + "\n```")).toEqual(obj);
  });

  it("reads an unlabelled fenced block", () => {
    expect(parseLooseJson("```\n" + json + "\n```")).toEqual(obj);
  });

  it("reads JSON surrounded by chatty prose", () => {
    const text = `Here you go!\n\n${json}\n\nLet me know if you'd like changes.`;
    expect(parseLooseJson(text)).toEqual(obj);
  });

  it("reads prose plus a fenced block", () => {
    expect(parseLooseJson("Sure:\n```json\n" + json + "\n```\nHope that helps!")).toEqual(
      obj,
    );
  });

  it("keeps nested braces intact", () => {
    const nested = { name: "N", meta: { a: { b: 1 } }, sections: [] };
    expect(parseLooseJson("text " + JSON.stringify(nested) + " more")).toEqual(nested);
  });

  it("rejects an empty paste with a clear message", () => {
    expect(() => parseLooseJson("   ")).toThrow(/nothing pasted/i);
  });

  it("rejects text containing no JSON", () => {
    expect(() => parseLooseJson("I couldn't do that")).toThrow(/couldn't find any JSON/i);
  });

  it("reports malformed JSON rather than failing silently", () => {
    expect(() => parseLooseJson('{ "name": "x", }')).toThrow(/isn't valid JSON/i);
  });
});
