import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import MarkdownView from "./components/MarkdownView/MarkdownView";
import { decodeMarkdownUrl, imageMarkdown } from "./images";

/**
 * The src an image ends up with, after the Markdown parser has had it and the
 * app has turned it back into a name it can look up. The parser percent-encodes
 * destinations, so this pair — wrap on the way in, decode on the way out — is
 * what stands between a stored picture and a broken one.
 */
function resolvedSrc(markdown: string): string | null {
  const html = renderToStaticMarkup(
    <MarkdownView content={markdown} resolveImage={decodeMarkdownUrl} />,
  );
  return html.match(/<img[^>]*src="([^"]*)"/)?.[1] ?? null;
}

describe("images in Markdown survive the round trip", () => {
  it("a plain reference", () => {
    expect(resolvedSrc("![map](images/ab12-map.png)")).toBe("images/ab12-map.png");
  });

  it("a name with spaces", () => {
    const name = "images/ab12-Screen Shot.png";
    expect(resolvedSrc(imageMarkdown("shot", name))).toBe(name);
  });

  // macOS names screenshots with a narrow no-break space before AM/PM, which
  // the parser encodes as %E2%80%AF. Left encoded, the file is never found.
  it("a macOS screenshot name, narrow no-break space and all", () => {
    const name = "images/2aeafa-Screenshot 2026-09-18 at 10.36.24 AM.png";
    expect(resolvedSrc(imageMarkdown("shot", name))).toBe(name);
  });

  it("a name containing a per-cent sign", () => {
    const name = "images/ab12-50% off.png";
    expect(resolvedSrc(imageMarkdown("sign", name))).toBe(name);
  });

  it("an unwrapped path with spaces is not an image at all — hence the wrapping", () => {
    expect(resolvedSrc("![shot](images/Screen Shot.png)")).toBe(null);
  });
});

describe("decodeMarkdownUrl", () => {
  it("leaves a name that needs nothing alone", () => {
    expect(decodeMarkdownUrl("images/ab12-map.png")).toBe("images/ab12-map.png");
  });

  it("survives a stray per-cent that isn't an escape", () => {
    expect(decodeMarkdownUrl("images/100%.png")).toBe("images/100%.png");
  });
});
