import { $generateHtmlFromNodes } from "@lexical/html";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { INSERT_ORDERED_LIST_COMMAND, INSERT_UNORDERED_LIST_COMMAND } from "@lexical/list";
import { TOGGLE_LINK_COMMAND } from "@lexical/link";
import { FORMAT_TEXT_COMMAND } from "lexical";

type Props = { onChange: (html: string) => void };

function ToolButton({ label, onClick }: { label: string; onClick: () => void }) {
  return <button type="button" className="editor-tool" aria-label={label} title={label} onMouseDown={(event) => event.preventDefault()} onClick={onClick}>{label}</button>;
}

function Toolbar() {
  const [editor] = useLexicalComposerContext();
  function toggleLink() {
    const url = window.prompt("Paste a link URL");
    if (url) editor.dispatchCommand(TOGGLE_LINK_COMMAND, url);
  }

  return (
    <div className="editor-toolbar" role="toolbar" aria-label="Message formatting">
      <ToolButton label="Bold" onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold")} />
      <ToolButton label="Italic" onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic")} />
      <ToolButton label="Underline" onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "underline")} />
      <span className="editor-divider" />
      <ToolButton label="Bullets" onClick={() => editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)} />
      <ToolButton label="Numbered list" onClick={() => editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)} />
      <ToolButton label="Link" onClick={toggleLink} />
    </div>
  );
}

export default function RichTextEditor({ onChange }: Props) {
  return (
    <LexicalComposer initialConfig={{ namespace: "inlet-compose", onError: (error) => { throw error; }, theme: {} }}>
      <div className="rich-editor">
        <Toolbar />
        <RichTextPlugin
          contentEditable={<ContentEditable id="body" className="rich-editor-content" aria-label="Message body" />}
          placeholder={<div className="rich-editor-placeholder">Write a message…</div>}
          ErrorBoundary={LexicalErrorBoundary}
        />
        <HistoryPlugin />
        <ListPlugin />
        <LinkPlugin />
        <OnChangePlugin onChange={(editorState, editor) => editorState.read(() => onChange($generateHtmlFromNodes(editor, null)))} />
      </div>
    </LexicalComposer>
  );
}
