import { EditorContent, useEditor } from "@tiptap/react";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import StarterKit from "@tiptap/starter-kit";
import { useEffect } from "react";

type Props = {
  value: string;
  onChange: (html: string) => void;
};

function ToolButton({
  label,
  active = false,
  disabled = false,
  onClick,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return <button type="button" className={`editor-tool${active ? " active" : ""}`} aria-label={label} title={label} disabled={disabled} onClick={onClick}>{label}</button>;
}

export default function RichTextEditor({ value, onChange }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Underline,
      Link.configure({ openOnClick: false, autolink: true, linkOnPaste: true }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class: "rich-editor-content",
        "aria-label": "Message body",
      },
    },
    onUpdate: ({ editor: currentEditor }) => onChange(currentEditor.getHTML()),
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML()) editor.commands.setContent(value, { emitUpdate: false });
  }, [editor, value]);

  function addLink() {
    const href = window.prompt("Paste a link URL");
    if (!href) return;
    editor?.chain().focus().extendMarkRange("link").setLink({ href }).run();
  }

  if (!editor) return <div className="rich-editor-loading" />;

  return (
    <div className="rich-editor">
      <div className="editor-toolbar" role="toolbar" aria-label="Message formatting">
        <ToolButton label="H2" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} />
        <ToolButton label="H3" active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} />
        <span className="editor-divider" />
        <ToolButton label="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} />
        <ToolButton label="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} />
        <ToolButton label="Underline" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()} />
        <span className="editor-divider" />
        <ToolButton label="Bullets" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} />
        <ToolButton label="Numbered list" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} />
        <ToolButton label="Quote" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()} />
        <ToolButton label="Link" active={editor.isActive("link")} onClick={addLink} />
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
