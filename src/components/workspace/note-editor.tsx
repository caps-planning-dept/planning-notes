"use client";

import { Popover } from "@base-ui/react/popover";
import {
  ClientSideSuspense,
  LiveblocksProvider,
  RoomProvider,
  useClient,
  useErrorListener,
  useOthers,
  useSelf,
  useStatus,
  useThreads,
} from "@liveblocks/react/suspense";
import { AnchoredThreads, FloatingComposer, FloatingThreads, useLiveblocksExtension } from "@liveblocks/react-tiptap";
import { LiveblocksUiConfig, Thread, type ThreadProps } from "@liveblocks/react-ui";
import Highlight from "@tiptap/extension-highlight";
import Placeholder from "@tiptap/extension-placeholder";
import { TableKit } from "@tiptap/extension-table";
import { NodeSelection } from "@tiptap/pm/state";
import { CellSelection } from "@tiptap/pm/tables";
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
  ImagePlus,
  Italic,
  Link2,
  Link2Off,
  List,
  ListOrdered,
  MessageSquarePlus,
  Paperclip,
  Quote,
  Table,
  Underline,
  type LucideIcon,
} from "lucide-react";
import {
  type ChangeEvent,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Button } from "@/components/ui/button";
import type { Member } from "@/hooks/use-workspace";
import { cursorColor, noteRoomId } from "@/lib/collaboration";
import { HIGHLIGHT_COLORS, NOTE_FONTS, type NoteColor, TEXT_COLORS } from "@/lib/note-format";
import { isWebHref, tabIdFromHref, tabLinkHref } from "@/lib/note-links";
import { cn } from "@/lib/utils";
import { resolveTabColor, type Tab } from "@/lib/workspace";
import { insertNoteFiles, NoteFile, NoteImage } from "./note-attachments";
import { TabIcon } from "./tab-icon";

type NoteEditorProps = {
  tabId: string;
  userId: string;
  content: JSONContent | undefined;
  members: Member[];
  /** 탭 연결 목록에 보여 줄 탭들 */
  tabs: Tab[];
  onChange: (content: JSONContent) => void;
  /** 연결된 탭으로 이동한다. 탭이 휴지통에 있거나 없으면 false를 돌려준다. */
  onOpenTab: (tabId: string) => boolean;
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

const MembersContext = createContext<Member[]>([]);

type NoteTabs = { tabId: string; tabs: Tab[]; openTab: (tabId: string) => boolean };
const NoteTabsContext = createContext<NoteTabs>({ tabId: "", tabs: [], openTab: () => false });

export function NoteEditor({ tabId, userId, content, members, tabs, onChange, onOpenTab }: NoteEditorProps) {
  // 답글 이름을 다시 찾기 전에 최신 목록이 준비되도록 화면 반영 직전에 바꾼다.
  const membersRef = useRef(members);
  useLayoutEffect(() => {
    membersRef.current = members;
  }, [members]);
  const myName = members.find((member) => member.userId === userId)?.displayName;

  // 답글에는 사용자 번호만 저장되므로, 화면에 보일 이름은 멤버 목록에서 찾는다.
  const resolveUsers = useCallback(({ userIds }: { userIds: string[] }) => {
    return userIds.map((id) => {
      const member = membersRef.current.find((item) => item.userId === id);
      // Google 프로필 사진은 다른 사이트에서 깨지는 일이 있어 이름 첫 글자로 표시한다.
      return { name: member?.displayName ?? "이전 멤버", color: cursorColor(id) };
    });
  }, []);

  return (
    // 커서 이름은 입장 권한에 담겨 있으므로, 내 이름이 바뀌면 다시 입장해 새 이름을 받는다.
    <LiveblocksProvider key={myName} authEndpoint={authorize} resolveUsers={resolveUsers}>
      <LiveblocksUiConfig overrides={COMMENT_TEXT}>
        <MembersContext.Provider value={members}>
          <NoteTabsContext.Provider value={{ tabId, tabs, openTab: onOpenTab }}>
            <ReplyNameSync members={members} />
            <RoomProvider id={noteRoomId(tabId)}>
              <NoteRoomContent content={content} onChange={onChange} />
            </RoomProvider>
          </NoteTabsContext.Provider>
        </MembersContext.Provider>
      </LiveblocksUiConfig>
    </LiveblocksProvider>
  );
}

/** 멤버 이름이 바뀌면 답글에 저장해 둔 이름을 버리고 다시 찾게 한다. */
function ReplyNameSync({ members }: { members: Member[] }) {
  const client = useClient();
  const names = members.map((member) => `${member.userId}:${member.displayName}`).join();
  useEffect(() => {
    client.resolvers.invalidateUsers();
  }, [client, names]);
  return null;
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

const NOTICE_MS = 6000;

type Upload = (files: File[], position?: number) => void;

function CollaborativeEditor({ content, onChange }: NoteContentProps) {
  const [initialContent] = useState(content);
  const noteTabs = useContext(NoteTabsContext);
  const [notice, setNotice] = useState("");
  const [uploading, setUploading] = useState(0);
  // 편집기 설정은 처음 한 번만 만들어지므로, 그 안에서 쓰는 최신 값은 ref로 읽는다.
  const latest = useRef<{ noteTabs: NoteTabs; upload: Upload }>({ noteTabs, upload: () => {} });

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  const liveblocks = useLiveblocksExtension({
    initialContent,
    comments: true,
    mentions: false,
  });
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      liveblocks,
      // 링크는 아래 handleClick에서 직접 연다. 탭 연결은 새 창 대신 앱 안에서 이동해야 한다.
      StarterKit.configure({ undoRedo: false, link: { openOnClick: false } }),
      // 칸 경계를 끌어 칸 너비를 바꿀 수 있다. 사진을 칸에 넣어 표처럼 늘어놓을 수 있다.
      TableKit.configure({ table: { resizable: true, cellMinWidth: 48 } }),
      NoteImage,
      NoteFile,
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
      handleClick: (view, _pos, event) => {
        if (event.button !== 0) return false;
        const anchor = (event.target as HTMLElement | null)?.closest("a");
        if (!anchor || !view.dom.contains(anchor)) return false;
        const href = anchor.getAttribute("href");
        const linkedTab = tabIdFromHref(href);
        if (linkedTab) {
          event.preventDefault();
          if (!latest.current.noteTabs.openTab(linkedTab)) {
            setNotice("연결된 탭이 휴지통에 있거나 지워져서 열 수 없습니다.");
          }
          return true;
        }
        if (isWebHref(href)) {
          event.preventDefault();
          window.open(href, "_blank", "noopener,noreferrer");
          return true;
        }
        return false;
      },
      handlePaste: (_view, event) => {
        const data = event.clipboardData;
        // 글과 함께 복사된 사진(웹 페이지 등)은 글 붙여넣기로 두고, 사진만 복사했을 때 올린다.
        if (!data || data.files.length === 0 || data.getData("text/plain")) return false;
        event.preventDefault();
        latest.current.upload([...data.files]);
        return true;
      },
      handleDrop: (view, event, _slice, moved) => {
        const files = event.dataTransfer?.files;
        if (moved || !files || files.length === 0) return false;
        event.preventDefault();
        const position = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
        latest.current.upload([...files], position);
        return true;
      },
    },
  });

  const upload = useCallback(
    async (files: File[], position?: number) => {
      if (!editor || files.length === 0) return;
      setUploading((count) => count + files.length);
      try {
        const problem = await insertNoteFiles(editor, noteTabs.tabId, files, position);
        if (problem) setNotice(problem);
      } finally {
        setUploading((count) => count - files.length);
      }
    },
    [editor, noteTabs.tabId],
  );

  useLayoutEffect(() => {
    latest.current = { noteTabs, upload };
  }, [noteTabs, upload]);

  const wide = useIsWide();

  return (
    <div
      className={cn(
        "mx-auto grid w-full flex-1 grid-rows-[auto_1fr] gap-x-6 gap-y-3 px-6 pb-12",
        wide ? "max-w-260 grid-cols-[minmax(0,45rem)_17.5rem]" : "max-w-180 grid-cols-[minmax(0,1fr)]",
      )}
    >
      {editor && (
        <Toolbar
          editor={editor}
          notice={notice || (uploading > 0 ? `파일 ${uploading}개를 올리는 중입니다` : "")}
          onUpload={upload}
          onNotice={setNotice}
        />
      )}
      {wide && <div />}
      <EditorContent editor={editor} className="min-w-0" />
      {editor && (
        <>
          <ReplyBubble editor={editor} />
          <FloatingComposer editor={editor} showAttachments={false} />
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

/** 파일 첨부와 알림은 다음 버전 기능이므로 답글에서도 끈다. */
function ReplyThread(props: ThreadProps) {
  return <Thread {...props} showAttachments={false} showSubscription={false} />;
}

const THREAD_COMPONENTS = { Thread: ReplyThread };

function Threads({ editor, wide }: { editor: Editor; wide: boolean }) {
  const { threads } = useThreads({ query: { resolved: false } });
  if (wide) return <AnchoredThreads editor={editor} threads={threads} components={THREAD_COMPONENTS} className="w-70" />;
  return (
    <>
      <FloatingThreads editor={editor} threads={threads} components={THREAD_COMPONENTS} />
      {/* 옆에 칸을 둘 수 없는 화면에서는 본문 아래에 답글을 모아 보여 준다. */}
      {threads.length > 0 && (
        <section aria-label="답글" className="mt-6 flex flex-col gap-3 border-t pt-4">
          <h2 className="text-sm font-medium">답글</h2>
          {threads.map((thread) => (
            <ReplyThread key={thread.id} thread={thread} className="rounded-xl border border-border/70 shadow-soft" />
          ))}
        </section>
      )}
    </>
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
      // 사진이나 파일 칸, 표의 여러 칸을 골랐을 때는 답글 버튼을 띄우지 않는다.
      shouldShow={({ editor: current, state }) =>
        !state.selection.empty &&
        !(state.selection instanceof NodeSelection) &&
        !(state.selection instanceof CellSelection) &&
        current.isEditable
      }
    >
      <Button
        variant="outline"
        className="rounded-full border-border/70 bg-background shadow-float"
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
          <Popover.Popup finalFocus={false} aria-label={label} className="flex gap-1 rounded-lg border border-border/70 bg-background p-1 shadow-float">
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
  const myId = useSelf((self) => self.id);
  const members = useContext(MembersContext);

  if (status !== "connected") return <>연결 중</>;
  // 한 사람이 탭을 여러 개 열어도 한 명으로 세고, 내 다른 탭은 세지 않는다.
  const otherIds = [...new Set(others.map((other) => other.id))].filter((id) => id !== myId);
  if (otherIds.length === 0) return <>연결됨</>;
  const names = otherIds.map((id) => members.find((member) => member.userId === id)?.displayName ?? "멤버");
  return <>{names.slice(0, 2).join(", ")}{names.length > 2 && ` 외 ${names.length - 2}명`} 함께 편집 중</>;
}

type ToolbarProps = {
  editor: Editor;
  notice: string;
  onUpload: (files: File[]) => void;
  onNotice: (message: string) => void;
};

function Toolbar({ editor, notice, onUpload, onNotice }: ToolbarProps) {
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
      link: current.isActive("link"),
      table: current.isActive("table"),
      header: current.isActive("tableHeader"),
      merge: current.can().mergeOrSplit(),
    }),
  });
  const chain = () => editor.chain().focus();

  return (
    <div role="toolbar" aria-label="글자 서식" className="sticky top-0 z-10 flex flex-wrap items-center gap-1 border-b border-border/70 bg-background/90 py-1.5 backdrop-blur-sm">
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
      <TabLinkMenu editor={editor} active={state.link} onNotice={onNotice} />
      <TableMenu editor={editor} active={state.table} />
      <FilePickerTool label="사진 넣기" icon={ImagePlus} accept="image/*" onPick={onUpload} />
      <FilePickerTool label="파일 첨부" icon={Paperclip} onPick={onUpload} />
      <span role="status" className={cn("ml-auto text-sm", notice ? "text-foreground" : "text-muted-foreground")}>
        {notice || <ConnectionStatus />}
      </span>
      {state.table && <TableTools editor={editor} header={state.header} merge={state.merge} />}
    </div>
  );
}

const TABLE_PICKER_SIZE = 6;

/** 표 넣기. 마우스를 올린(또는 누른) 칸까지의 크기로 표를 만든다. */
function TableMenu({ editor, active }: { editor: Editor; active: boolean }) {
  const [open, setOpen] = useState(false);
  const [size, setSize] = useState({ rows: 2, cols: 2 });
  const cells = Array.from({ length: TABLE_PICKER_SIZE * TABLE_PICKER_SIZE }, (_, index) => ({
    row: Math.floor(index / TABLE_PICKER_SIZE) + 1,
    col: (index % TABLE_PICKER_SIZE) + 1,
  }));

  function insert(rows: number, cols: number) {
    // 사진을 늘어놓는 데도 쓰므로 제목 줄 없이 만든다. 필요하면 표 도구에서 켠다.
    editor.chain().focus().insertTable({ rows, cols, withHeaderRow: false }).run();
    setOpen(false);
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label="표 넣기"
            title="표 넣기"
            className={cn(active && "bg-(--tab) text-(--on-tab) hover:bg-(--tab) hover:text-(--on-tab)")}
          />
        }
      >
        <Table />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={4} className="z-50">
          <Popover.Popup
            finalFocus={false}
            aria-label="표 크기 고르기"
            className="flex flex-col gap-2 rounded-lg border border-border/70 bg-background p-2 shadow-float"
          >
            <div className="grid grid-cols-6 gap-1" onMouseLeave={() => setSize({ rows: 2, cols: 2 })}>
              {cells.map(({ row, col }) => {
                const on = row <= size.rows && col <= size.cols;
                return (
                  <button
                    key={`${row}-${col}`}
                    type="button"
                    aria-label={`${row}줄 ${col}칸 표 넣기`}
                    className={cn(
                      "size-6 rounded-sm border",
                      on ? "border-(--tab) bg-(--tab)/25" : "border-border bg-background hover:bg-muted",
                    )}
                    onMouseEnter={() => setSize({ rows: row, cols: col })}
                    onFocus={() => setSize({ rows: row, cols: col })}
                    onClick={() => insert(row, col)}
                  />
                );
              })}
            </div>
            <p className="text-center text-xs text-muted-foreground">
              {size.rows}줄 × {size.cols}칸
            </p>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

type TableToolsProps = { editor: Editor; header: boolean; merge: boolean };

/** 커서가 표 안에 있을 때 도구 막대 아래에 나오는 표 도구 */
function TableTools({ editor, header, merge }: TableToolsProps) {
  const chain = () => editor.chain().focus();
  const actions: { label: string; run: () => void; danger?: boolean; pressed?: boolean; disabled?: boolean }[] = [
    { label: "아래에 줄 추가", run: () => chain().addRowAfter().run() },
    { label: "오른쪽에 칸 추가", run: () => chain().addColumnAfter().run() },
    { label: "줄 지우기", run: () => chain().deleteRow().run() },
    { label: "칸 지우기", run: () => chain().deleteColumn().run() },
    { label: "칸 합치기·나누기", run: () => chain().mergeOrSplit().run(), disabled: !merge },
    { label: "제목 줄", run: () => chain().toggleHeaderRow().run(), pressed: header },
    { label: "표 지우기", run: () => chain().deleteTable().run(), danger: true },
  ];

  return (
    <div role="group" aria-label="표 도구" className="flex basis-full flex-wrap gap-1 border-t border-border/70 pt-1.5">
      {actions.map((action) => (
        <Button
          key={action.label}
          variant="ghost"
          disabled={action.disabled}
          aria-pressed={action.pressed}
          className={cn(
            action.danger && "text-destructive hover:text-destructive",
            action.pressed && "bg-(--tab) text-(--on-tab) hover:bg-(--tab) hover:text-(--on-tab)",
          )}
          onMouseDown={(event) => event.preventDefault()}
          onClick={action.run}
        >
          {action.label}
        </Button>
      ))}
    </div>
  );
}

type FilePickerToolProps = {
  label: string;
  icon: LucideIcon;
  accept?: string;
  onPick: (files: File[]) => void;
};

function FilePickerTool({ label, icon: Icon, accept, onPick }: FilePickerToolProps) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <Button variant="ghost" size="icon" aria-label={label} title={label} onClick={() => input.current?.click()}>
        <Icon />
      </Button>
      <input
        ref={input}
        type="file"
        multiple
        accept={accept}
        tabIndex={-1}
        aria-hidden
        className="hidden"
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          const files = [...(event.target.files ?? [])];
          // 같은 파일을 다시 고를 수 있게 비운다.
          event.target.value = "";
          onPick(files);
        }}
      />
    </>
  );
}

type TabLinkMenuProps = { editor: Editor; active: boolean; onNotice: (message: string) => void };

/** 선택한 글자를 다른 탭으로 가는 연결로 만든다. 글자를 고르지 않았으면 탭 이름을 넣는다. */
function TabLinkMenu({ editor, active, onNotice }: TabLinkMenuProps) {
  const { tabId, tabs } = useContext(NoteTabsContext);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const keyword = query.trim().toLowerCase();
  const choices = tabs
    .filter((tab) => tab.deletedAt === null && tab.id !== tabId)
    .filter((tab) => !keyword || (tab.title || "제목 없음").toLowerCase().includes(keyword))
    .sort((a, b) => (a.title || "").localeCompare(b.title || "", "ko"));

  function link(target: Tab) {
    const href = tabLinkHref(target.id);
    const name = target.title || "제목 없음";
    if (editor.state.selection.empty && !active) {
      editor
        .chain()
        .focus()
        .insertContent({ type: "text", text: name, marks: [{ type: "link", attrs: { href, target: null } }] })
        // 이어서 쓰는 글자까지 연결되지 않게 한다.
        .unsetMark("link")
        // 공백만 담은 문자열은 HTML로 읽히며 사라지므로 글자 조각으로 넣는다.
        .insertContent({ type: "text", text: " " })
        .run();
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href, target: null }).run();
    }
    setOpen(false);
    onNotice(`${name} 탭을 연결했습니다`);
  }

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setQuery("");
      }}
    >
      <Popover.Trigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label="다른 탭 연결"
            title="다른 탭 연결"
            className={cn(active && "bg-(--tab) text-(--on-tab) hover:bg-(--tab) hover:text-(--on-tab)")}
          />
        }
      >
        <Link2 />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={4} align="start" className="z-50">
          <Popover.Popup
            finalFocus={false}
            aria-label="연결할 탭"
            className="flex w-72 flex-col gap-1 rounded-xl border border-border/70 bg-background p-2 shadow-float"
          >
            <input
              aria-label="탭 이름 검색"
              placeholder="탭 이름 검색"
              value={query}
              className="h-9 rounded-md border bg-background px-2 text-sm"
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && choices[0]) {
                  event.preventDefault();
                  link(choices[0]);
                }
              }}
            />
            <div className="flex max-h-64 flex-col overflow-y-auto">
              {choices.length === 0 && <p className="p-2 text-sm text-muted-foreground">연결할 탭이 없습니다.</p>}
              {choices.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className="focus-inset flex min-h-9 shrink-0 items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-muted"
                  onClick={() => link(tab)}
                >
                  <TabIcon
                    template={tab.template}
                    className="size-4 shrink-0"
                    style={{ color: resolveTabColor(tabs, tab.id) }}
                    aria-hidden
                  />
                  <span className="truncate">{tab.title || "제목 없음"}</span>
                </button>
              ))}
            </div>
            {active && (
              <button
                type="button"
                className="focus-inset flex min-h-9 items-center gap-2 rounded-md border-t px-2 text-left text-sm hover:bg-muted"
                onClick={() => {
                  editor.chain().focus().extendMarkRange("link").unsetLink().run();
                  setOpen(false);
                }}
              >
                <Link2Off className="size-4 shrink-0" aria-hidden />
                연결 끊기
              </button>
            )}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
