"use client";

import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, type Editor, type JSONContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Heading2, Italic, List, ListOrdered, Quote, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type NoteEditorProps = {
  content: JSONContent | undefined;
  onChange: (content: JSONContent) => void;
};

export function NoteEditor({ content, onChange }: NoteEditorProps) {
  const editor = useEditor({
    immediatelyRender: true,
    extensions: [StarterKit, Placeholder.configure({ placeholder: "회의 내용을 적어 보세요" })],
    content,
    onUpdate: ({ editor: current }) => onChange(current.getJSON()),
    editorProps: {
      attributes: { "aria-label": "노트 내용", class: "note-content outline-none" },
    },
  });

  return (
    <div className="mx-auto flex w-full max-w-180 flex-1 flex-col gap-3 px-6 pb-12">
      {editor && <Toolbar editor={editor} />}
      <EditorContent editor={editor} className="flex-1" />
    </div>
  );
}

type ToolProps = { label: string; icon: LucideIcon; active: boolean; run: () => void };

function Tool({ label, icon: Icon, active, run }: ToolProps) {
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={label}
      aria-pressed={active}
      className={cn(active && "bg-(--tab) text-(--on-tab) hover:bg-(--tab) hover:text-(--on-tab)")}
      onClick={run}
    >
      <Icon />
    </Button>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      heading: current.isActive("heading", { level: 2 }),
      bold: current.isActive("bold"),
      italic: current.isActive("italic"),
      bullet: current.isActive("bulletList"),
      ordered: current.isActive("orderedList"),
      quote: current.isActive("blockquote"),
    }),
  });
  const chain = () => editor.chain().focus();

  return (
    <div role="toolbar" aria-label="글자 서식" className="sticky top-0 z-10 flex flex-wrap gap-1 border-b bg-background py-1">
      <Tool label="제목" icon={Heading2} active={state.heading} run={() => chain().toggleHeading({ level: 2 }).run()} />
      <Tool label="굵게" icon={Bold} active={state.bold} run={() => chain().toggleBold().run()} />
      <Tool label="기울임" icon={Italic} active={state.italic} run={() => chain().toggleItalic().run()} />
      <Tool label="글머리 목록" icon={List} active={state.bullet} run={() => chain().toggleBulletList().run()} />
      <Tool label="번호 목록" icon={ListOrdered} active={state.ordered} run={() => chain().toggleOrderedList().run()} />
      <Tool label="인용" icon={Quote} active={state.quote} run={() => chain().toggleBlockquote().run()} />
    </div>
  );
}
