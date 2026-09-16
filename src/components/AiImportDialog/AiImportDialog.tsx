import { useState } from "react";
import { copyPromptToClipboard, downloadPrompt, type PromptKind } from "../../aiImport";
import { importItemFromJson, type ImportedItem } from "../../importFile";
import styles from "./AiImportDialog.module.css";

interface Props {
  /** Chosen by which sidebar group opened this, so the dialog doesn't re-ask. */
  kind: PromptKind;
  onImported: (item: ImportedItem) => void;
  onClose: () => void;
}

// Guides the user through converting an existing document into a checklist with
// any LLM: take the prompt, paste it plus their document into the chat, then
// paste the JSON answer back here.
export default function AiImportDialog({ kind, onImported, onClose }: Props) {
  const [json, setJson] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleCopy() {
    const ok = await copyPromptToClipboard(kind);
    setNote(ok ? "Prompt copied to clipboard" : "Couldn't copy — use Download instead");
    setTimeout(() => setNote(null), 3000);
  }

  async function handleDownload() {
    try {
      const path = await downloadPrompt(kind);
      if (path) {
        setNote(`Saved to ${path}`);
        setTimeout(() => setNote(null), 4000);
      }
    } catch (e) {
      setNote(null);
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleImport() {
    setBusy(true);
    setError(null);
    try {
      onImported(await importItemFromJson(json));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.head}>
          <h2 className={styles.title}>
            {kind === "doc" ? "Import a reference doc" : "Import a checklist"}
          </h2>
          <p className={styles.sub}>
            {kind === "doc"
              ? "Turn a Word doc, PDF, or notes into a reference page, keeping the original wording and layout."
              : "Turn a Word doc, PDF, or notes into steps you can work through."}{" "}
            Uses any AI chat — no account setup needed here.
          </p>
        </div>

        <div className={styles.body}>
          <div className={styles.step}>
            <span className={styles.num}>1</span>
            <div className={styles.stepBody}>
              <div className={styles.stepTitle}>Get the conversion prompt</div>
              <p className={styles.stepText}>
                Copy it, or save it as a file to keep for next time.
              </p>
              <div className={styles.btnRow}>
                <button className={styles.btn} onClick={handleCopy}>
                  Copy prompt
                </button>
                <button className={styles.btn} onClick={handleDownload}>
                  Download prompt
                </button>
                {note && <span className={styles.ok}>{note}</span>}
              </div>
            </div>
          </div>

          <div className={styles.step}>
            <span className={styles.num}>2</span>
            <div className={styles.stepBody}>
              <div className={styles.stepTitle}>Paste it into an AI chat</div>
              <p className={styles.stepText}>
                Open claude.ai (or any AI assistant), paste the prompt, then add
                your document underneath it and send.
              </p>
            </div>
          </div>

          <div className={styles.step}>
            <span className={styles.num}>3</span>
            <div className={styles.stepBody}>
              <div className={styles.stepTitle}>Paste the answer back here</div>
              <p className={styles.stepText}>
                Copy the JSON it replies with and paste it below.
              </p>
              <textarea
                className={styles.textarea}
                value={json}
                onChange={(e) => {
                  setJson(e.target.value);
                  setError(null);
                }}
                placeholder={
                  kind === "doc"
                    ? '{\n  "itemKind": "doc",\n  "name": "…",\n  "body": "…"\n}'
                    : '{\n  "name": "…",\n  "sections": [ … ]\n}'
                }
              />
              {error && <p className={styles.error}>{error}</p>}
            </div>
          </div>
        </div>

        <div className={styles.foot}>
          <button className={styles.btn} onClick={onClose}>
            Cancel
          </button>
          <button
            className={styles.primary}
            onClick={handleImport}
            disabled={!json.trim() || busy}
          >
            {busy ? "Importing…" : kind === "doc" ? "Create doc" : "Create checklist"}
          </button>
        </div>
      </div>
    </div>
  );
}
