import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { forwardRef, useImperativeHandle } from "react";

export type EditorHandle = { getHtml: () => string };

type Props = { initialHtml?: string; onDirty?: () => void };

function ToolButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`editor-tool${active ? " active" : ""}`}
      aria-label={label}
      title={label}
      aria-pressed={active}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function Toolbar({ editor }: { editor: ReturnType<typeof useEditor> }) {
  if (!editor) return null;
  function toggleLink() {
    if (editor.isActive("link")) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    const url = window.prompt("Paste a link URL");
    if (url) editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }
  return (
    <div className="editor-toolbar" role="toolbar" aria-label="Message formatting">
      <ToolButton
        label="Bold"
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      />
      <ToolButton
        label="Italic"
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      />
      <ToolButton
        label="Underline"
        active={editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      />
      <span className="editor-divider" />
      <ToolButton
        label="Bullets"
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      />
      <ToolButton
        label="Numbered"
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      />
      <ToolButton label="Link" active={editor.isActive("link")} onClick={toggleLink} />
    </div>
  );
}

const RichTextEditor = forwardRef<EditorHandle, Props>(function RichTextEditor(
  { initialHtml, onDirty },
  ref,
) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: "editor-link", rel: "noopener noreferrer", target: "_blank" },
      }),
      Placeholder.configure({ placeholder: "Write a message…" }),
    ],
    content: initialHtml || "",
    onUpdate: () => onDirty?.(),
    editorProps: {
      attributes: {
        id: "body",
        class: "rich-editor-content",
        "aria-label": "Message body",
      },
    },
  });

  useImperativeHandle(
    ref,
    () => ({
      getHtml: () => editor?.getHTML() ?? "",
    }),
    [editor],
  );

  if (!editor) {
    return <div className="rich-editor-loading" aria-hidden />;
  }

  return (
    <div className="rich-editor">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
});

export default RichTextEditor;
