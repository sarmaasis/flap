import { $generateHtmlFromNodes, $generateNodesFromDOM } from "@lexical/html";
import { LinkNode } from "@lexical/link";
import { ListItemNode, ListNode } from "@lexical/list";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { INSERT_ORDERED_LIST_COMMAND, INSERT_UNORDERED_LIST_COMMAND } from "@lexical/list";
import { TOGGLE_LINK_COMMAND } from "@lexical/link";
import { $getRoot, $insertNodes, FORMAT_TEXT_COMMAND, type LexicalEditor } from "lexical";
import { forwardRef, useEffect, useImperativeHandle, useRef, type Ref } from "react";

export type EditorHandle = { getHtml: () => string };

type Props = { initialHtml?: string; onDirty?: () => void };

const editorTheme = {
  paragraph: "editor-paragraph",
  quote: "editor-quote",
  heading: { h2: "editor-h2" },
  list: { ul: "editor-list-ul", ol: "editor-list-ol", listitem: "editor-listitem" },
  link: "editor-link",
  text: { bold: "editor-bold", italic: "editor-italic", underline: "editor-underline" },
};

const initialConfig = {
  namespace: "inlet-compose",
  theme: editorTheme,
  nodes: [ListNode, ListItemNode, LinkNode, HeadingNode, QuoteNode],
  onError(error: Error) {
    console.error(error);
  },
};

function ToolButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="editor-tool" aria-label={label} title={label} onMouseDown={(event) => event.preventDefault()} onClick={onClick}>
      {label}
    </button>
  );
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
      <ToolButton label="Numbered" onClick={() => editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)} />
      <ToolButton label="Link" onClick={toggleLink} />
    </div>
  );
}

function InitialHtmlPlugin({ html }: { html?: string }) {
  const [editor] = useLexicalComposerContext();
  const applied = useRef(false);
  useEffect(() => {
    if (applied.current || !html) return;
    applied.current = true;
    editor.update(() => {
      const parser = new DOMParser();
      const dom = parser.parseFromString(html, "text/html");
      const nodes = $generateNodesFromDOM(editor, dom);
      const root = $getRoot();
      root.clear();
      $insertNodes(nodes);
    });
  }, [editor, html]);
  return null;
}

function HandlePlugin({ innerRef, onDirty }: { innerRef: Ref<EditorHandle>; onDirty?: () => void }) {
  const [editor] = useLexicalComposerContext();
  const editorRef = useRef<LexicalEditor>(editor);
  editorRef.current = editor;
  useImperativeHandle(innerRef, () => ({
    getHtml: () => {
      let html = "";
      editorRef.current.getEditorState().read(() => {
        html = $generateHtmlFromNodes(editorRef.current, null);
      });
      return html;
    },
  }), []);
  return (
    <OnChangePlugin
      ignoreSelectionChange
      onChange={() => onDirty?.()}
    />
  );
}

const RichTextEditor = forwardRef<EditorHandle, Props>(function RichTextEditor({ initialHtml, onDirty }, ref) {
  return (
    <LexicalComposer initialConfig={initialConfig}>
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
        <InitialHtmlPlugin html={initialHtml} />
        <HandlePlugin innerRef={ref} onDirty={onDirty} />
      </div>
    </LexicalComposer>
  );
});

export default RichTextEditor;
