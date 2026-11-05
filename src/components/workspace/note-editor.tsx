"use client";

import { Popover } from "@base-ui/react/popover";
import {
  ClientSideSuspense,
  LiveblocksProvider,
  RoomProvider,
  useErrorListener,
  useOthers,
  useStatus,
  useThreads,
} from "@liveblocks/react/suspense";
import { AnchoredThreads, FloatingComposer, FloatingThreads, useLiveblocksExtension } from "@liveblocks/react-tiptap";
import { LiveblocksUiConfig, Thread, type ThreadProps } from "@liveblocks/react-ui";
import Highlight from "@tiptap/extension-highlight";
import Placeholder from "@tiptap/extension-placeholder";
import { Color, FontFamily, TextStyle } from "@tiptap/extension-text-style";
import { EditorContent, type Editor, type JSONContent, useEditor, useEditorState } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import {
  Baseline,
  Bold,
  Eraser,
  Heading2,
  Highlighter,
  Italic,
  List,
  ListOrdered,
  MessageSquarePlus,
  Quote,
  Underline,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import type { Member } from "@/hooks/use-workspace";
import { cursorColor, noteRoomId } from "@/lib/collaboration";
import { HIGHLIGHT_COLORS, NOTE_FONTS, type NoteColor, TEXT_COLORS } from "@/lib/note-format";
import { cn } from "@/lib/utils";

type NoteEditorProps = {
  tabId: string;
  content: JSONContent | undefined;
  members: Member[];
  onChange: (content: JSONContent) => void;
};

const COMMENT_TEXT = {
  locale: "ko",
  USER_SELF: "나",
  USER_UNKNOWN: "이전 멤버",
  COMMENT_EDITED: "(수정됨)",
  COMMENT_DELETED: "삭제된 답글입니다.",
  COMMENT_MORE: "더 보기",
  COMMENT_EDIT: "수정",
  COMMENT_EDIT_COMPOSER_PLACEHOLDER: "답글을 수정하세요",
  COMMENT_EDIT_COMPOSER_CANCEL: "취소",
  COMMENT_EDIT_COMPOSER_SAVE: "저장",
  COMMENT_DELETE: "삭제",
  COMMENT_ADD_REACTION: "반응 추가",
  COMPOSER_INSERT_EMOJI: "이모지 넣기",
  COMPOSER_PLACEHOLDER: "답글을 입력하세요",
  COMPOSER_SEND: "보내기",
  THREAD_RESOLVE: "해결로 표시",
  THREAD_UNRESOLVE: "해결 취소",
  THREAD_SUBSCRIBE: "알림 받기",
  THREAD_UNSUBSCRIBE: "알림 끄기",
  THREAD_NEW_INDICATOR: "새 답글",
  THREAD_NEW_INDICATOR_DESCRIPTION: "읽지 않은 답글이 있습니다",
  THREAD_SHOW_MORE_COMMENTS: (count: number) => `답글 ${count}개 더 보기`,
  THREAD_COMPOSER_PLACEHOLDER: "답글을 입력하세요",
  THREAD_COMPOSER_SEND: "보내기",
};

async function authorize(room?: string) {
  const response = await fetch("/api/liveblocks-auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ room }),
  });
  return response.json();
}

export function NoteEditor({ tabId, content, members, onChange }: NoteEditorProps) {
  const membersRef = useRef(members);
  useEffect(() => {
    membersRef.current = members;
  }, [members]);

  // 답글에는 사용자 번호만 저장되므로, 화면에 보일 이름은 멤버 목록에서 찾는다.
  const resolveUsers = useCallback(({ userIds }: { userIds: string[] }) => {
    return userIds.map((id) => {
      const member = membersRef.current.find((item) => item.userId === id);
      // Google 프로필 사진은 다른 사이트에서 깨지는 일이 있어 이름 첫 글자로 표시한다.
      return { name: member?.displayName ?? "이전 멤버", color: cursorColor(id) };
    });
  }, []);

  return (
    <LiveblocksProvider authEndpoint={authorize} resolveUsers={resolveUsers}>
      <LiveblocksUiConfig overrides={COMMENT_TEXT}>
        <RoomProvider id={noteRoomId(tabId)}>
          <NoteRoomContent content={content} onChange={onChange} />
        </RoomProvider>
      </LiveblocksUiConfig>
    </LiveblocksProvider>
  );
}

type NoteContentProps = Pick<NoteEditorProps, "content" | "onChange">;

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
    comments: true,
    mentions: false,
  });
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      liveblocks,
      StarterKit.configure({ undoRedo: false }),
      TextStyle,
      Color,
      FontFamily,
      Highlight.configure({ multicolor: true }),
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

  const wide = useIsWide();

  return (
    <div
      className={cn(
        "mx-auto grid w-full flex-1 grid-rows-[auto_1fr] gap-x-6 gap-y-3 px-6 pb-12",
        wide ? "max-w-260 grid-cols-[minmax(0,45rem)_17.5rem]" : "max-w-180 grid-cols-[minmax(0,1fr)]",
      )}
    >
      {editor && <Toolbar editor={editor} />}
      {wide && <div />}
      <EditorContent editor={editor} className="min-w-0" />
      {editor && (
        <>
          <ReplyBubble editor={editor} />
          <FloatingComposer editor={editor} showAttachments={false} className="w-80 max-w-[calc(100vw-2rem)]" />
          <Threads editor={editor} wide={wide} />
        </>
      )}
    </div>
  );
}

const WIDE_QUERY = "(min-width: 1280px)";

function subscribeWide(onChange: () => void) {
  const query = window.matchMedia(WIDE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** 본문 옆에 답글 칸을 둘 만큼 화면이 넓은지 돌려준다. */
function useIsWide() {
  return useSyncExternalStore(subscribeWide, () => window.matchMedia(WIDE_QUERY).matches, () => false);
}

/** 파일 첨부는 다음 버전 기능이므로 답글에서도 끈다. */
function ReplyThread(props: ThreadProps) {
  return <Thread {...props} showAttachments={false} />;
}

const THREAD_COMPONENTS = { Thread: ReplyThread };

function Threads({ editor, wide }: { editor: Editor; wide: boolean }) {
  const { threads } = useThreads({ query: { resolved: false } });
  if (wide) return <AnchoredThreads editor={editor} threads={threads} components={THREAD_COMPONENTS} className="w-70" />;
  return (
    <FloatingThreads
      editor={editor}
      threads={threads}
      components={THREAD_COMPONENTS}
      className="w-80 max-w-[calc(100vw-2rem)]"
    />
  );
}

/** 글을 선택하면 그 위에 답글 버튼을 띄운다. */
function ReplyBubble({ editor }: { editor: Editor }) {
  const pending = useEditorState({
    editor,
    selector: ({ editor: current }) => Boolean(current.storage.liveblocksComments?.pendingComment),
  });
  // 답글 입력창이 열려 있는 동안에는 버튼을 숨긴다.
  if (pending) return null;

  return (
    <BubbleMenu
      editor={editor}
      className="z-30"
      // 첫 줄에서 위쪽 도구 막대를 가리지 않도록, 본문 위쪽에 자리가 없으면 아래로 띄운다.
      options={{ placement: "top", flip: { boundary: editor.view.dom } }}
      shouldShow={({ editor: current, state }) => !state.selection.empty && current.isEditable}
    >
      <Button
        variant="outline"
        className="rounded-full bg-background shadow-md"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => editor.chain().focus().addPendingComment().run()}
      >
        <MessageSquarePlus data-icon="inline-start" />
        답글
      </Button>
    </BubbleMenu>
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

type ColorMenuProps = {
  label: string;
  icon: LucideIcon;
  colors: NoteColor[];
  active: boolean;
  onPick: (color: string) => void;
  onClear: () => void;
};

function ColorMenu({ label, icon: Icon, colors, active, onPick, onClear }: ColorMenuProps) {
  const [open, setOpen] = useState(false);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label={label}
            className={cn(active && "bg-(--tab) text-(--on-tab) hover:bg-(--tab) hover:text-(--on-tab)")}
          />
        }
      >
        <Icon />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={4} className="z-50">
          <Popover.Popup finalFocus={false} aria-label={label} className="flex gap-1 rounded-md border bg-background p-1 shadow-md">
            {colors.map((color) => (
              <button
                key={color.value}
                type="button"
                aria-label={color.label}
                title={color.label}
                className="focus-inset flex size-9 items-center justify-center rounded-md hover:bg-muted"
                onClick={() => {
                  onPick(color.value);
                  setOpen(false);
                }}
              >
                <span className="size-5 rounded-full border" style={{ background: color.value }} />
              </button>
            ))}
            <button
              type="button"
              aria-label={`${label} 지우기`}
              title={`${label} 지우기`}
              className="focus-inset flex size-9 items-center justify-center rounded-md hover:bg-muted"
              onClick={() => {
                onClear();
                setOpen(false);
              }}
            >
              <Eraser className="size-4" aria-hidden />
            </button>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
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
      underline: current.isActive("underline"),
      color: Boolean(current.getAttributes("textStyle").color),
      font: (current.getAttributes("textStyle").fontFamily as string | undefined) ?? "",
      highlight: current.isActive("highlight"),
      bullet: current.isActive("bulletList"),
      ordered: current.isActive("orderedList"),
      quote: current.isActive("blockquote"),
    }),
  });
  const chain = () => editor.chain().focus();

  return (
    <div role="toolbar" aria-label="글자 서식" className="sticky top-0 z-10 flex flex-wrap items-center gap-1 border-b bg-background py-1">
      <select
        aria-label="글꼴"
        className="h-9 rounded-md border bg-background px-2 text-sm"
        value={state.font}
        onChange={(event) => {
          const font = event.target.value;
          if (font) chain().setFontFamily(font).run();
          else chain().unsetFontFamily().run();
        }}
      >
        {NOTE_FONTS.map((font) => (
          <option key={font.label} value={font.value}>{font.label}</option>
        ))}
      </select>
      <Tool label="제목" icon={Heading2} active={state.heading} run={() => chain().toggleHeading({ level: 2 }).run()} />
      <Tool label="굵게" icon={Bold} active={state.bold} run={() => chain().toggleBold().run()} />
      <Tool label="기울임" icon={Italic} active={state.italic} run={() => chain().toggleItalic().run()} />
      <Tool label="밑줄" icon={Underline} active={state.underline} run={() => chain().toggleUnderline().run()} />
      <ColorMenu
        label="글씨 색"
        icon={Baseline}
        colors={TEXT_COLORS}
        active={state.color}
        onPick={(color) => chain().setColor(color).run()}
        onClear={() => chain().unsetColor().run()}
      />
      <ColorMenu
        label="형광펜"
        icon={Highlighter}
        colors={HIGHLIGHT_COLORS}
        active={state.highlight}
        onPick={(color) => chain().setHighlight({ color }).run()}
        onClear={() => chain().unsetHighlight().run()}
      />
      <Tool label="글머리 목록" icon={List} active={state.bullet} run={() => chain().toggleBulletList().run()} />
      <Tool label="번호 목록" icon={ListOrdered} active={state.ordered} run={() => chain().toggleOrderedList().run()} />
      <Tool label="인용" icon={Quote} active={state.quote} run={() => chain().toggleBlockquote().run()} />
      <span role="status" className="ml-auto text-sm text-muted-foreground">
        <ConnectionStatus />
      </span>
    </div>
  );
}
