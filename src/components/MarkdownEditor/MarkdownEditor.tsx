import { useRef, useState } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import MarkdownView from "../MarkdownView/MarkdownView";
import { resolveAppImage, openLink } from "../../appLinks";
import styles from "./MarkdownEditor.module.css";

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export default function MarkdownEditor({ value, onChange, placeholder }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [preview, setPreview] = useState(false);

  // Wrap the current selection with `before`/`after` (e.g. ** ** for bold).
  function wrap(before: string, after: string, placeholderText = "text") {
    const ta = ref.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = value.slice(start, end) || placeholderText;
    const next =
      value.slice(0, start) + before + selected + after + value.slice(end);
    onChange(next);
    const caret = start + before.length;
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(caret, caret + selected.length);
    });
  }

  // Prefix the line(s) touched by the selection (e.g. "- " for a bullet).
  function prefixLines(prefix: string) {
    const ta = ref.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    const block = value.slice(lineStart, end);
    const prefixed = block
      .split("\n")
      .map((l) => prefix + l)
      .join("\n");
    const next = value.slice(0, lineStart) + prefixed + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => ta.focus());
  }

  // Indent (Tab) / outdent (Shift+Tab) the touched line(s) by two spaces, so
  // nested sub-bullets are easy to make without counting spaces by hand.
  function changeIndent(outdent: boolean) {
    const ta = ref.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    const block = value.slice(lineStart, end);
    const lines = block.split("\n");
    let deltaFirst = 0;
    let deltaTotal = 0;
    const changed = lines.map((l, i) => {
      if (outdent) {
        const removed = l.match(/^ {1,2}/)?.[0].length ?? 0;
        if (i === 0) deltaFirst = -removed;
        deltaTotal -= removed;
        return l.slice(removed);
      }
      if (i === 0) deltaFirst = 2;
      deltaTotal += 2;
      return "  " + l;
    });
    const next = value.slice(0, lineStart) + changed.join("\n") + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(
        Math.max(lineStart, start + deltaFirst),
        end + deltaTotal,
      );
    });
  }

  function insert(text: string) {
    const ta = ref.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const next = value.slice(0, start) + text + value.slice(ta.selectionEnd);
    onChange(next);
    const caret = start + text.length;
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(caret, caret);
    });
  }

  async function insertImage() {
    const selected = await openDialog({
      title: "Insert an image",
      multiple: false,
      filters: [
        { name: "Images", extensions: ["png", "jpg", "jpeg", "gif", "webp", "svg"] },
      ],
    });
    if (typeof selected !== "string") return;
    const name = selected.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, "") || "image";
    insert(`\n![${name}](${selected})\n`);
  }

  return (
    <div className={styles.editor}>
      <div className={styles.toolbar}>
        <button type="button" className={`${styles.tbtn} ${styles.bold}`} title="Bold" onClick={() => wrap("**", "**")}>
          B
        </button>
        <button type="button" className={`${styles.tbtn} ${styles.italic}`} title="Italic" onClick={() => wrap("*", "*")}>
          I
        </button>
        <span className={styles.sep} />
        <button type="button" className={styles.tbtn} title="Heading" onClick={() => prefixLines("## ")}>
          H
        </button>
        <button type="button" className={styles.tbtn} title="Bullet list" onClick={() => prefixLines("- ")}>
          •
        </button>
        <button type="button" className={styles.tbtn} title="Indent (sub-bullet)" onClick={() => changeIndent(false)}>
          →
        </button>
        <button type="button" className={styles.tbtn} title="Outdent" onClick={() => changeIndent(true)}>
          ←
        </button>
        <button type="button" className={styles.tbtn} title="Numbered list" onClick={() => prefixLines("1. ")}>
          1.
        </button>
        <span className={styles.sep} />
        <button type="button" className={styles.tbtn} title="Link" onClick={() => wrap("[", "](https://)", "link text")}>
          🔗
        </button>
        <button type="button" className={styles.tbtn} title="Insert image" onClick={insertImage}>
          🖼
        </button>
        <span className={styles.spacer} />
        <button
          type="button"
          className={`${styles.toggle} ${preview ? styles.active : ""}`}
          onClick={() => setPreview((p) => !p)}
          title="Toggle preview"
        >
          {preview ? "Write" : "Preview"}
        </button>
      </div>

      {preview ? (
        value.trim() ? (
          <MarkdownView
            className={styles.preview}
            content={value}
            resolveImage={resolveAppImage}
            onLinkClick={openLink}
          />
        ) : (
          <div className={styles.previewEmpty}>Nothing to preview yet.</div>
        )
      ) : (
        <textarea
          ref={ref}
          className={styles.textarea}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Tab") {
              e.preventDefault();
              changeIndent(e.shiftKey);
            }
          }}
          placeholder={placeholder}
        />
      )}
    </div>
  );
}
