import { Extension } from "@tiptap/core";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Heading2,
  Heading3,
  Italic,
  Link2,
  Link2Off,
  List,
  ListOrdered,
  Quote,
  Redo2,
  RemoveFormatting,
  Strikethrough,
  Underline as UnderlineIcon,
  Undo2,
} from "lucide-react";
import { forwardRef, useImperativeHandle, type ReactNode } from "react";

export type EditorHandle = { getHtml: () => string };

type Props = { initialHtml?: string; onDirty?: () => void };

function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^(https?:\/\/|mailto:)/i.test(trimmed)) return trimmed;
  if (/^\/\//.test(trimmed)) return `https:${trimmed}`;
  return `https://${trimmed}`;
}

function promptForLink(editor: Editor) {
  const previous = editor.getAttributes("link").href as string | undefined;
  const next = window.prompt("Link URL", previous ?? "https://");
  if (next === null) return;
  const href = normalizeUrl(next);
  if (!href) {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    return;
  }
  editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
}

const LinkShortcut = Extension.create({
  name: "emailLinkShortcut",
  addKeyboardShortcuts() {
    return {
      "Mod-k": () => {
        promptForLink(this.editor);
        return true;
      },
    };
  },
});

function ToolButton({
  label,
  shortcut,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  shortcut?: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  const title = shortcut ? `${label} (${shortcut})` : label;
  return (
    <button
      type="button"
      className={`editor-tool${active ? " active" : ""}`}
      aria-label={label}
      title={title}
      aria-pressed={active}
      aria-keyshortcuts={shortcut}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {children}
      <span className="sr-only">{label}</span>
    </button>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const mod = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl";

  return (
    <div className="editor-toolbar" role="toolbar" aria-label="Message formatting">
      <ToolButton
        label="Undo"
        shortcut={`${mod}+Z`}
        disabled={!editor.can().undo()}
        onClick={() => editor.chain().focus().undo().run()}
      >
        <Undo2 size={15} strokeWidth={2.25} aria-hidden />
      </ToolButton>
      <ToolButton
        label="Redo"
        shortcut={`${mod}+Shift+Z`}
        disabled={!editor.can().redo()}
        onClick={() => editor.chain().focus().redo().run()}
      >
        <Redo2 size={15} strokeWidth={2.25} aria-hidden />
      </ToolButton>

      <span className="editor-divider" aria-hidden />

      <ToolButton
        label="Bold"
        shortcut={`${mod}+B`}
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold size={15} strokeWidth={2.25} aria-hidden />
      </ToolButton>
      <ToolButton
        label="Italic"
        shortcut={`${mod}+I`}
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic size={15} strokeWidth={2.25} aria-hidden />
      </ToolButton>
      <ToolButton
        label="Underline"
        shortcut={`${mod}+U`}
        active={editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <UnderlineIcon size={15} strokeWidth={2.25} aria-hidden />
      </ToolButton>
      <ToolButton
        label="Strikethrough"
        shortcut={`${mod}+Shift+S`}
        active={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <Strikethrough size={15} strokeWidth={2.25} aria-hidden />
      </ToolButton>

      <span className="editor-divider" aria-hidden />

      <ToolButton
        label="Heading 2"
        shortcut={`${mod}+Alt+2`}
        active={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 size={15} strokeWidth={2.25} aria-hidden />
      </ToolButton>
      <ToolButton
        label="Heading 3"
        shortcut={`${mod}+Alt+3`}
        active={editor.isActive("heading", { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        <Heading3 size={15} strokeWidth={2.25} aria-hidden />
      </ToolButton>

      <span className="editor-divider" aria-hidden />

      <ToolButton
        label="Bulleted list"
        shortcut={`${mod}+Shift+8`}
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List size={15} strokeWidth={2.25} aria-hidden />
      </ToolButton>
      <ToolButton
        label="Numbered list"
        shortcut={`${mod}+Shift+7`}
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered size={15} strokeWidth={2.25} aria-hidden />
      </ToolButton>
      <ToolButton
        label="Quote"
        shortcut={`${mod}+Shift+B`}
        active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <Quote size={15} strokeWidth={2.25} aria-hidden />
      </ToolButton>

      <span className="editor-divider" aria-hidden />

      <ToolButton
        label="Add or edit link"
        shortcut={`${mod}+K`}
        active={editor.isActive("link")}
        onClick={() => promptForLink(editor)}
      >
        <Link2 size={15} strokeWidth={2.25} aria-hidden />
      </ToolButton>
      <ToolButton
        label="Remove link"
        disabled={!editor.isActive("link")}
        onClick={() => editor.chain().focus().extendMarkRange("link").unsetLink().run()}
      >
        <Link2Off size={15} strokeWidth={2.25} aria-hidden />
      </ToolButton>

      <span className="editor-divider" aria-hidden />

      <ToolButton
        label="Align left"
        active={editor.isActive({ textAlign: "left" })}
        onClick={() => editor.chain().focus().setTextAlign("left").run()}
      >
        <AlignLeft size={15} strokeWidth={2.25} aria-hidden />
      </ToolButton>
      <ToolButton
        label="Align center"
        active={editor.isActive({ textAlign: "center" })}
        onClick={() => editor.chain().focus().setTextAlign("center").run()}
      >
        <AlignCenter size={15} strokeWidth={2.25} aria-hidden />
      </ToolButton>
      <ToolButton
        label="Align right"
        active={editor.isActive({ textAlign: "right" })}
        onClick={() => editor.chain().focus().setTextAlign("right").run()}
      >
        <AlignRight size={15} strokeWidth={2.25} aria-hidden />
      </ToolButton>

      <span className="editor-divider" aria-hidden />

      <ToolButton
        label="Clear formatting"
        onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
      >
        <RemoveFormatting size={15} strokeWidth={2.25} aria-hidden />
      </ToolButton>
    </div>
  );
}

const RichTextEditor = forwardRef<EditorHandle, Props>(function RichTextEditor(
  { initialHtml, onDirty },
  ref,
) {
  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    extensions: [
      StarterKit.configure({
        // TipTap v3 ships link + underline inside StarterKit — configure here
        // instead of registering duplicate extensions (which breaks the editor).
        heading: { levels: [2, 3] },
        code: false,
        codeBlock: false,
        horizontalRule: false,
        link: {
          openOnClick: false,
          autolink: true,
          defaultProtocol: "https",
          HTMLAttributes: {
            class: "editor-link",
            rel: "noopener noreferrer",
            target: "_blank",
          },
        },
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
        alignments: ["left", "center", "right"],
      }),
      Placeholder.configure({
        placeholder: "Write a message…",
        emptyEditorClass: "is-editor-empty",
        emptyNodeClass: "is-empty",
      }),
      LinkShortcut,
    ],
    content: initialHtml || "",
    onUpdate: () => onDirty?.(),
    editorProps: {
      attributes: {
        id: "body",
        class: "rich-editor-content tiptap",
        "aria-label": "Message body",
      },
    },
  });

  useImperativeHandle(
    ref,
    () => ({
      getHtml: () => {
        if (!editor) return "";
        const html = editor.getHTML();
        // TipTap empty doc is "<p></p>" — treat as empty for callers that check text.
        return html === "<p></p>" ? "" : html;
      },
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
