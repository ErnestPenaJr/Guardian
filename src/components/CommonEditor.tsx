"use client";

import { useEffect } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";

import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Link as LinkIcon,
} from "lucide-react";

interface CommonEditorProps {
  value: string;
  onChange: (content: string) => void;
}

export default function CommonEditor({ value, onChange }: CommonEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      Link.configure({ openOnClick: false }),
      Placeholder.configure({
        placeholder: "Enter notice content...",
      }),
    ],
    content: value || "",
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "p-3 min-h-[160px] text-sm focus:outline-none",
      },
    },
    immediatelyRender: false,
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || "");
    }
  }, [value, editor]);

  if (!editor) return null;

  const setLink = () => {
    const url = prompt("Enter URL");
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  };

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden bg-white">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-3 py-2 bg-gray-50 border-b border-gray-200 text-gray-600 h-11">
        {/* Heading Dropdown */}
        <select
          onChange={(e) => {
            const level = Number(e.target.value);
            if (level === 0) {
              editor.chain().focus().setParagraph().run();
            } else {
              editor.chain().focus().toggleHeading({ level }).run();
            }
          }}
          className="text-sm border border-gray-300 rounded px-2 py-1 h-8"
        >
          <option value={0}>Normal</option>
          <option value={1}>Heading 1</option>
          <option value={2}>Heading 2</option>
          <option value={3}>Heading 3</option>
        </select>

        {/* Divider */}
        <div className="w-px h-6 bg-gray-300 mx-2" />

        {/* Bold */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`h-8 w-8 flex items-center justify-center rounded hover:bg-gray-200 ${
            editor.isActive("bold") ? "bg-gray-200" : ""
          }`}
        >
          <Bold size={16} />
        </button>

        {/* Italic */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`h-8 w-8 flex items-center justify-center rounded hover:bg-gray-200 ${
            editor.isActive("italic") ? "bg-gray-200" : ""
          }`}
        >
          <Italic size={16} />
        </button>

        {/* Underline */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={`h-8 w-8 flex items-center justify-center rounded hover:bg-gray-200 ${
            editor.isActive("underline") ? "bg-gray-200" : ""
          }`}
        >
          <UnderlineIcon size={16} />
        </button>

        {/* Bullet List */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`h-8 w-8 flex items-center justify-center rounded hover:bg-gray-200 ${
            editor.isActive("bulletList") ? "bg-gray-200" : ""
          }`}
        >
          <List size={16} />
        </button>

        {/* Ordered List */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`h-8 w-8 flex items-center justify-center rounded hover:bg-gray-200 ${
            editor.isActive("orderedList") ? "bg-gray-200" : ""
          }`}
        >
          <ListOrdered size={16} />
        </button>

        {/* Link */}
        <button
          type="button"
          onClick={setLink}
          className="h-8 w-8 flex items-center justify-center rounded hover:bg-gray-200"
        >
          <LinkIcon size={16} />
        </button>
      </div>

      {/* Editor Area */}
      <EditorContent editor={editor} />
    </div>
  );
}
