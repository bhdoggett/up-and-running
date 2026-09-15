import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import styles from "./MarkdownView.module.css";

export function isLocalPath(src: string | undefined): boolean {
  if (!src) return false;
  return !/^(https?:|data:|asset:|blob:|mailto:)/i.test(src);
}

interface Props {
  content: string;
  /** Map an image src to a loadable URL (e.g. convertFileSrc for local files). */
  resolveImage?: (src: string) => string;
  /** If provided, links call this instead of navigating (used in-app to open via the OS). */
  onLinkClick?: (href: string) => void;
  className?: string;
}

// Renders Markdown to safe HTML (raw HTML in the source is NOT rendered, so
// imported content can't inject scripts). Shared by the in-app view and, via
// renderToStaticMarkup, by the HTML export.
export default function MarkdownView({
  content,
  resolveImage,
  onLinkClick,
  className,
}: Props) {
  return (
    <div className={`${styles.prose} ${className ?? ""}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          img({ src, alt }) {
            const resolved =
              resolveImage && typeof src === "string" ? resolveImage(src) : src;
            return <img src={resolved} alt={alt ?? ""} />;
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
