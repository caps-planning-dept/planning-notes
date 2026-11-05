"use client";

import {
  ClientSideSuspense,
  LiveblocksProvider,
  RoomProvider,
  useErrorListener,
  useOthers,
  useStatus,
} from "@liveblocks/react/suspense";
import { useLiveblocksExtension } from "@liveblocks/react-tiptap";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, type Editor, type JSONContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Heading2, Italic, List, ListOrdered, Quote, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { noteRoomId } from "@/lib/collaboration";
import { cn } from "@/lib/utils";

type NoteEditorProps = {
  tabId: string;
  content: JSONContent | undefined;
  onChange: (content: JSONContent) => void;
};

async function authorize(room?: string) {
  const response = await fetch("/api/liveblocks-auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ room }),
  });
  return response.json();
}

export function NoteEditor({ tabId, content, onChange }: NoteEditorProps) {
  return (
    <LiveblocksProvider authEndpoint={authorize}>
      <RoomProvider id={noteRoomId(tabId)}>
        <NoteRoomContent content={content} onChange={onChange} />
      </RoomProvider>
    </LiveblocksProvider>
  );
}

type NoteContentProps = Omit<NoteEditorProps, "tabId">;

function NoteRoomContent({ content, onChange }: NoteContentProps) {
  const [failed, setFailed] = useState(false);

  useErrorListener((error) => {
    if (error.context.type === "ROOM_CONNECTION_ERROR") setFailed(true);
  });

  if (failed) {
    return (
      <p role="alert" className="mx-6 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
        노트에 연결하지 못했습니다. 권한을 확인한 뒤 새로고침해 주세요.
      </p>
    );
  }

  // 방 연결이 끝난 뒤 편집기를 만들어야 편집기가 실제 공유 문서와 연결된다.
  return (
    <ClientSideSuspense fallback={<p className="px-6 text-muted-foreground">노트를 불러오는 중입니다.</p>}>
      <CollaborativeEditor content={content} onChange={onChange} />
    </ClientSideSuspense>
  );
}

function CollaborativeEditor({ content, onChange }: NoteContentProps) {
  const [initialContent] = useState(content);
  const liveblocks = useLiveblocksExtension({
    initialContent,
    comments: false,
    mentions: false,
  });
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      liveblocks,
      StarterKit.configure({ undoRedo: false }),
      Placeholder.configure({ placeholder: "회의 내용을 적어 보세요" }),
    ],
    onUpdate: ({ editor: current, transaction }) => {
      // 다른 사람의 변경은 그 사람의 화면에서 저장하므로 내 변경만 백업용으로 저장한다.
      if (!transaction.getMeta("y-sync$")?.isChangeOrigin) onChange(current.getJSON());
    },
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

function ConnectionStatus() {
  const status = useStatus();
  const others = useOthers();

  if (status !== "connected") return <>연결 중</>;
  if (others.length === 0) return <>연결됨</>;
  const names = others.map((other) => other.info?.name ?? "멤버");
  return <>{names.slice(0, 2).join(", ")}{names.length > 2 && ` 외 ${names.length - 2}명`} 함께 편집 중</>;
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
    <div role="toolbar" aria-label="글자 서식" className="sticky top-0 z-10 flex flex-wrap items-center gap-1 border-b bg-background py-1">
      <Tool label="제목" icon={Heading2} active={state.heading} run={() => chain().toggleHeading({ level: 2 }).run()} />
      <Tool label="굵게" icon={Bold} active={state.bold} run={() => chain().toggleBold().run()} />
      <Tool label="기울임" icon={Italic} active={state.italic} run={() => chain().toggleItalic().run()} />
      <Tool label="글머리 목록" icon={List} active={state.bullet} run={() => chain().toggleBulletList().run()} />
      <Tool label="번호 목록" icon={ListOrdered} active={state.ordered} run={() => chain().toggleOrderedList().run()} />
      <Tool label="인용" icon={Quote} active={state.quote} run={() => chain().toggleBlockquote().run()} />
      <span role="status" className="ml-auto text-sm text-muted-foreground">
        <ConnectionStatus />
      </span>
    </div>
  );
}
