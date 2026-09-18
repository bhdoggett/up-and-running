import { describe, expect, it } from "vitest";
import {
  appImageRef,
  dataImageName,
  dataImageSources,
  imageMarkdown,
  isAppImage,
  markdownUrl,
  parseImageAlt,
  markdownImageAlts,
  markdownImageSources,
  rewriteImageSources,
  setImageWidth,
} from "./images";

describe("isAppImage", () => {
  it("recognises a reference into the app's image folder", () => {
    expect(isAppImage("images/ab12cd-map.png")).toBe(true);
  });

  it("leaves other sources alone", () => {
    expect(isAppImage("https://example.com/map.png")).toBe(false);
    expect(isAppImage("/Users/me/map.png")).toBe(false);
    expect(isAppImage("data:image/png;base64,AAA")).toBe(false);
    expect(isAppImage("imagesfoo/map.png")).toBe(false);
  });

  it("refuses a reference that climbs out of the folder", () => {
    expect(isAppImage("images/../../secrets.png")).toBe(false);
  });
});

describe("markdownUrl", () => {
  it("leaves a plain destination as it is", () => {
    expect(markdownUrl("images/ab12-map.png")).toBe("images/ab12-map.png");
  });

  it("wraps destinations Markdown would otherwise break on", () => {
    expect(markdownUrl("/Users/me/My Screens/shot.png")).toBe(
      "</Users/me/My Screens/shot.png>",
    );
    expect(markdownUrl("/tmp/shot (2).png")).toBe("</tmp/shot (2).png>");
  });
});

describe("imageMarkdown", () => {
  it("writes an image tag the renderer can read back", () => {
    const md = imageMarkdown("stage map", appImageRef("ab12-map.png"));
    expect(md).toBe("![stage map](images/ab12-map.png)");
    expect(markdownImageSources(md)).toEqual(["images/ab12-map.png"]);
  });

  it("survives a name with spaces, which a bare path would not", () => {
    const md = imageMarkdown("shot", "/Users/me/My Screens/shot.png");
    expect(markdownImageSources(md)).toEqual(["/Users/me/My Screens/shot.png"]);
  });

  it("drops brackets from the alt text, which would end it early", () => {
    expect(imageMarkdown("map [draft]", "images/a.png")).toBe(
      "![map draft](images/a.png)",
    );
  });
});

describe("markdownImageSources", () => {
  it("finds every picture in a body of Markdown", () => {
    const text = [
      "# Setup",
      "![one](images/a.png)",
      "some words ![two](https://x.test/b.png) after",
      "![three](</tmp/c d.png>)",
      "[not an image](images/nope.png)",
    ].join("\n");
    expect(markdownImageSources(text)).toEqual([
      "images/a.png",
      "https://x.test/b.png",
      "/tmp/c d.png",
    ]);
  });

  it("returns nothing for Markdown without pictures", () => {
    expect(markdownImageSources("plain **text**")).toEqual([]);
  });
});

describe("image width in the alt text", () => {
  it("reads a width and leaves the words alone", () => {
    expect(parseImageAlt("stage map|420")).toEqual({ text: "stage map", width: 420 });
    expect(parseImageAlt("stage map")).toEqual({ text: "stage map", width: null });
  });

  it("doesn't mistake a pipe in the words for a width", () => {
    expect(parseImageAlt("before | after")).toEqual({
      text: "before | after",
      width: null,
    });
  });

  it("writes a width back, then clears it", () => {
    const md = "![stage map](images/ab12-map.png)";
    const sized = setImageWidth(md, "images/ab12-map.png", 420);
    expect(sized).toBe("![stage map|420](images/ab12-map.png)");
    expect(setImageWidth(sized, "images/ab12-map.png", 300)).toBe(
      "![stage map|300](images/ab12-map.png)",
    );
    expect(setImageWidth(sized, "images/ab12-map.png", null)).toBe(md);
  });

  it("keeps the angle brackets a spaced name needs", () => {
    const md = "![shot](<images/ab12-Screen Shot.png>)";
    expect(setImageWidth(md, "images/ab12-Screen Shot.png", 200)).toBe(
      "![shot|200](<images/ab12-Screen Shot.png>)",
    );
  });

  // The renderer hands back the destination percent-encoded, so that is what
  // the resize arrives with — it still has to find the right picture.
  it("matches a picture by its encoded destination", () => {
    const md = "![shot](<images/ab12-Screen Shot.png>)";
    expect(setImageWidth(md, "images/ab12-Screen%20Shot.png", 200)).toBe(
      "![shot|200](<images/ab12-Screen Shot.png>)",
    );
  });

  it("resizes only the picture asked for", () => {
    const md = "![one](images/a.png)\n\n![two](images/b.png)";
    expect(setImageWidth(md, "images/b.png", 150)).toBe(
      "![one](images/a.png)\n\n![two|150](images/b.png)",
    );
  });
});

describe("pictures carried inline in a bundle", () => {
  const PNG = "data:image/png;base64,iVBORw0KGgo=";
  const JPEG = "data:image/jpeg;base64,/9j/4AAQ";

  it("finds only the inline ones", () => {
    const text = `![a](${PNG})\n\n![b](images/ab12-b.png)\n\n![c](https://x.test/c.png)`;
    expect(dataImageSources(text)).toEqual([PNG]);
  });

  it("names a picture from its alt text and its own media type", () => {
    expect(dataImageName(PNG, "stage map", 0)).toBe("stage map.png");
    expect(dataImageName(JPEG, "stage map", 0)).toBe("stage map.jpeg");
    expect(dataImageName("data:image/svg+xml;base64,PD8=", "plan", 0)).toBe("plan.svg");
  });

  it("falls back to a numbered name when there is no alt text", () => {
    expect(dataImageName(PNG, "", 2)).toBe("image-3.png");
    expect(dataImageName(PNG, "  ", 0)).toBe("image-1.png");
  });

  it("keeps a width out of the filename", () => {
    expect(dataImageName(PNG, "stage map|420", 0)).toBe("stage map.png");
  });

  it("copes with a data URI that carries no media type", () => {
    expect(dataImageName("data:,hello", "note", 0)).toBe("note.png");
  });

  it("reads the alt text of every picture, in order", () => {
    expect(markdownImageAlts("![one](a.png) ![two|300](b.png)")).toEqual([
      "one",
      "two|300",
    ]);
  });
});

describe("rewriteImageSources", () => {
  const PNG = "data:image/png;base64,iVBORw0KGgo=";

  it("swaps a destination and leaves the alt text alone", () => {
    const text = `![stage map|420](${PNG})`;
    const map = new Map([[PNG, "images/ab12-map.png"]]);
    expect(rewriteImageSources(text, map)).toBe("![stage map|420](images/ab12-map.png)");
  });

  it("swaps every use of the same picture", () => {
    const text = `![a](${PNG})\n\n![b](${PNG})`;
    const map = new Map([[PNG, "images/ab12-map.png"]]);
    expect(rewriteImageSources(text, map)).toBe(
      "![a](images/ab12-map.png)\n\n![b](images/ab12-map.png)",
    );
  });

  it("leaves untouched what it has no replacement for", () => {
    const text = "![a](images/a.png)";
    expect(rewriteImageSources(text, new Map())).toBe(text);
    expect(rewriteImageSources(text, new Map([["images/b.png", "x"]]))).toBe(text);
  });
});
