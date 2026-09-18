import { useRef, useState, useSyncExternalStore } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { imagesTick, parseImageAlt, subscribeImages } from "../../images";
import styles from "./MarkdownView.module.css";

export function isLocalPath(src: string | undefined): boolean {
  if (!src) return false;
  return !/^(https?:|data:|asset:|blob:|mailto:)/i.test(src);
}

/**
 * A picture, at whatever width its alt text asks for. Where the Markdown can
 * be written back to, the corner can be dragged to set that width; double
 * clicking it goes back to the picture's own size.
 *
 * A picture that can't be loaded says so, naming the address it tried — blank
 * space gives no way to tell a moved file from a typo in the Markdown.
 */
function Image({
  src,
  original,
  alt,
  onResize,
}: {
  src: string | undefined;
  original: string | undefined;
  alt: string;
  onResize?: (target: string, width: number | null) => void;
}) {
  const [failed, setFailed] = useState(false);
  const [dragWidth, setDragWidth] = useState<number | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const { text, width } = parseImageAlt(alt);

  if (failed) {
    return <span className={styles.missing}>Image not found: {original}</span>;
  }

  const shown = dragWidth ?? width;
  const picture = (
    <img
      ref={imgRef}
      src={src}
      alt={text}
      style={shown ? { width: `${shown}px` } : undefined}
      onError={() => setFailed(true)}
    />
  );

  if (!onResize || !original) return picture;

  function startResize(e: React.PointerEvent) {
    const el = imgRef.current;
    if (!el) return;
    e.preventDefault();
    e.stopPropagation();
    const handle = e.currentTarget as HTMLElement;
    handle.setPointerCapture(e.pointerId);
    const startX = e.clientX;
    const startWidth = el.getBoundingClientRect().width;

    const move = (ev: PointerEvent) =>
      setDragWidth(Math.max(40, Math.round(startWidth + ev.clientX - startX)));
    const up = (ev: PointerEvent) => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", up);
      const final = Math.max(40, Math.round(startWidth + ev.clientX - startX));
      setDragWidth(null);
      onResize!(original!, final);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", up);
  }

  return (
    <span className={styles.resizable}>
      {picture}
      <span
        className={styles.handle}
        onPointerDown={startResize}
        onDoubleClick={() => onResize(original, null)}
        title="Drag to resize · double-click for its own size"
        role="presentation"
      />
    </span>
  );
}

interface Props {
  content: string;
  /** Map an image src to a loadable URL (e.g. convertFileSrc for local files). */
  resolveImage?: (src: string) => string;
  /** If provided, links call this instead of navigating (used in-app to open via the OS). */
  onLinkClick?: (href: string) => void;
  /** If provided, pictures can be resized and the new width written back. */
  onImageResize?: (target: string, width: number | null) => void;
  className?: string;
}

// Renders Markdown to safe HTML (raw HTML in the source is NOT rendered, so
// imported content can't inject scripts). Shared by the in-app view and, via
// renderToStaticMarkup, by the HTML export.
export default function MarkdownView({
  content,
  resolveImage,
  onLinkClick,
  onImageResize,
  className,
}: Props) {
  // Redraw once the image folder is known, so a view rendered before then
  // doesn't sit there showing pictures that "aren't found".
  useSyncExternalStore(subscribeImages, imagesTick, imagesTick);

  return (
    <div className={`${styles.prose} ${className ?? ""}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          img({ src, alt }) {
            const resolved =
              resolveImage && typeof src === "string" ? resolveImage(src) : src;
            return (
              <Image
                // Keyed on the address: when an unresolved reference becomes a
                // real one, this remounts rather than keeping the "not found"
                // it concluded a moment earlier.
                key={resolved}
                src={resolved}
                original={src}
                alt={alt ?? ""}
                onResize={onImageResize}
              />
            );
          },
          a({ href, children }) {
            if (onLinkClick && href) {
              return (
                <a
                  href={href}
                  onClick={(e) => {
                    e.preventDefault();
                    onLinkClick(href);
                  }}
                >
                  {children}
                </a>
              );
            }
            return (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
