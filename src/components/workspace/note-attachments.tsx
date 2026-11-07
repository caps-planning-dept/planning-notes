"use client";

import { mergeAttributes, Node } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { type Editor, NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";
import { Download, FileText, MoveDiagonal2 } from "lucide-react";
import { type PointerEvent, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  clampImageWidth,
  formatBytes,
  IMAGE_WIDTH_PRESETS,
  isInlineImage,
  MAX_IMAGE_WIDTH,
  MAX_NOTE_FILE_BYTES,
  NOTE_FILES_BUCKET,
  noteFilePath,
} from "@/lib/note-files";
import { shrinkImage } from "@/lib/shrink-image";
import { cn } from "@/lib/utils";

// 버킷은 비공개라서 멤버에게만 잠시 쓰는 주소를 받아 보여 준다.
const SIGNED_URL_SECONDS = 60 * 60;
const signedUrls = new Map<string, { url: string; expiresAt: number }>();

async function signedUrl(path: string): Promise<string | null> {
  const cached = signedUrls.get(path);
  if (cached && cached.expiresAt > Date.now()) return cached.url;
  const { data, error } = await createClient().storage.from(NOTE_FILES_BUCKET).createSignedUrl(path, SIGNED_URL_SECONDS);
  if (error || !data) return null;
  // 만료 직전 주소를 쓰지 않도록 5분 일찍 새로 받는다.
  signedUrls.set(path, { url: data.signedUrl, expiresAt: Date.now() + (SIGNED_URL_SECONDS - 5 * 60) * 1000 });
  return data.signedUrl;
}

function useSignedUrl(path: string | null) {
  const [state, setState] = useState<{ path: string | null; url: string | null; failed: boolean }>({
    path: null,
    url: null,
    failed: false,
  });
  useEffect(() => {
    if (!path) return;
    let cancelled = false;
    signedUrl(path).then((url) => {
      if (!cancelled) setState({ path, url, failed: !url });
    });
    return () => {
      cancelled = true;
    };
  }, [path]);
  return state.path === path ? state : { url: null, failed: !path };
}

function ImageView({ node, selected, editor, updateAttributes }: ReactNodeViewProps) {
  const path = node.attrs.path as string | null;
  const alt = (node.attrs.alt as string) || "첨부한 사진";
  const width = clampImageWidth(node.attrs.width);
  const { url, failed } = useSignedUrl(path);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const editable = editor.isEditable;

  const startResize = (event: PointerEvent<HTMLButtonElement>) => {
    // 너비는 편집기가 사진마다 만든 바깥 칸에 걸려 있다(아래 imageBoxAttributes).
    const box = wrapperRef.current?.parentElement;
    // 표 칸 안의 사진은 칸 너비를, 본문의 사진은 본문 너비를 기준으로 %를 잰다.
    const container = box?.parentElement;
    if (!box || !container) return;
    // 기본 동작을 막아야 사진 끌어 옮기기가 시작되지 않는다.
    event.preventDefault();
    event.stopPropagation();
    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);
    const startX = event.clientX;
    const startPx = box.getBoundingClientRect().width;
    const contentPx = container.clientWidth || startPx;
    let next = clampImageWidth((startPx / contentPx) * 100) ?? MAX_IMAGE_WIDTH;
    setDragging(true);
    box.setAttribute("data-sized", "true");

    // 끄는 동안에는 화면에서만 바꾸고, 손을 뗄 때 한 번 저장해 다른 사람에게 보낸다.
    const move = (moveEvent: globalThis.PointerEvent) => {
      next = clampImageWidth(((startPx + moveEvent.clientX - startX) / contentPx) * 100) ?? MAX_IMAGE_WIDTH;
      box.style.width = `${next}%`;
    };
    const end = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", end);
      handle.removeEventListener("pointercancel", end);
      setDragging(false);
      updateAttributes({ width: next });
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", end);
  };

  return (
    <NodeViewWrapper
      ref={wrapperRef}
      className="note-image group/image"
      data-drag-handle
    >
      <div className="relative">
        {url ? (
          // 비공개 저장소의 임시 주소라서 Next.js 이미지 최적화를 거치지 않는다.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={alt}
            draggable={false}
            loading="lazy"
            decoding="async"
            className={cn(
              "block rounded-md",
              width !== null ? "w-full" : "max-h-128 max-w-full",
              selected && "ring-2 ring-ring ring-offset-2",
            )}
          />
        ) : (
          <div
            role="img"
            aria-label={alt}
            className={cn(
              "flex h-40 items-center justify-center rounded-md bg-muted text-sm text-muted-foreground",
              width === null && "max-w-md",
              selected && "ring-2 ring-ring ring-offset-2",
            )}
          >
            {failed ? "사진을 불러오지 못했습니다" : "사진을 불러오는 중"}
          </div>
        )}
        {editable && (
          <button
            type="button"
            contentEditable={false}
            aria-label="사진 크기 조절 (끌어서 바꾸기)"
            title="끌어서 크기 바꾸기"
            className={cn(
              "absolute right-1 bottom-1 flex size-7 cursor-ew-resize touch-none items-center justify-center rounded-full border border-border/70 bg-background/90 text-foreground shadow-float transition-opacity",
              selected || dragging ? "opacity-100" : "opacity-0 group-hover/image:opacity-100 focus-visible:opacity-100",
            )}
            onPointerDown={startResize}
          >
            <MoveDiagonal2 className="size-4" aria-hidden />
          </button>
        )}
      </div>
      {editable && selected && (
        <div
          contentEditable={false}
          role="group"
          aria-label="사진 크기"
          className="mt-1.5 flex w-max max-w-full flex-wrap gap-1 rounded-lg border border-border/70 bg-background p-1 text-xs shadow-float"
        >
          {IMAGE_WIDTH_PRESETS.map((preset) => (
            <button
              key={preset.value}
              type="button"
              aria-pressed={width === preset.value}
              className={cn(
                "focus-inset h-7 rounded-md px-2 hover:bg-muted",
                width === preset.value && "bg-(--tab) text-(--on-tab) hover:bg-(--tab)",
              )}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => updateAttributes({ width: preset.value })}
            >
              {preset.label}
            </button>
          ))}
          <button
            type="button"
            aria-pressed={width === null}
            className={cn(
              "focus-inset h-7 rounded-md px-2 hover:bg-muted",
              width === null && "bg-(--tab) text-(--on-tab) hover:bg-(--tab)",
            )}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => updateAttributes({ width: null })}
          >
            원래대로
          </button>
        </div>
      )}
    </NodeViewWrapper>
  );
}

async function downloadFile(path: string, name: string) {
  // 내려받기용 주소는 파일 이름을 담아야 해서 보기용 주소와 따로 받는다.
  const { data, error } = await createClient()
    .storage.from(NOTE_FILES_BUCKET)
    .createSignedUrl(path, 60, { download: name || true });
  if (error || !data) return false;
  window.location.assign(data.signedUrl);
  return true;
}

function FileView({ node, selected }: ReactNodeViewProps) {
  const path = node.attrs.path as string | null;
  const name = (node.attrs.name as string) || "첨부 파일";
  const size = node.attrs.size as number | null;
  const [failed, setFailed] = useState(false);

  return (
    <NodeViewWrapper className="my-2" data-drag-handle>
      <div
        contentEditable={false}
        className={cn(
          "flex max-w-md items-center gap-3 rounded-lg border border-border/70 bg-background p-2 pl-3 shadow-soft",
          selected && "ring-2 ring-ring ring-offset-2",
        )}
      >
        <FileText className="size-5 shrink-0 text-muted-foreground" aria-hidden />
        <span className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className="truncate text-sm font-medium">{name}</span>
          <span className="text-xs text-muted-foreground">
            {failed ? "내려받지 못했습니다" : size !== null ? formatBytes(size) : "파일"}
          </span>
        </span>
        <button
          type="button"
          aria-label={`${name} 내려받기`}
          title="내려받기"
          disabled={!path}
          className="focus-inset flex size-9 shrink-0 items-center justify-center rounded-md hover:bg-muted"
          onClick={async () => {
            if (path) setFailed(!(await downloadFile(path, name)));
          }}
        >
          <Download className="size-4" aria-hidden />
        </button>
      </div>
    </NodeViewWrapper>
  );
}

/**
 * 편집기가 사진마다 만드는 바깥 칸에 너비를 건다. 너비를 정한 사진끼리는 옆으로 이어 붙는다.
 * 값은 늘 두 개 다 돌려준다. 빠진 값은 지워지지 않고 남기 때문이다.
 */
function imageBoxAttributes({ node }: { node: ProseMirrorNode }): Record<string, string> {
  const width = clampImageWidth(node.attrs.width);
  return { "data-sized": width !== null ? "true" : "false", style: width !== null ? `width: ${width}%` : "" };
}

const pathAttribute = {
  default: null,
  parseHTML: (element: HTMLElement) => element.getAttribute("data-path"),
  renderHTML: (attributes: Record<string, unknown>) => ({ "data-path": attributes.path }),
};

/** 노트 안에 바로 보이는 사진. 사진 파일은 비공개 저장소에 두고 경로만 노트에 적는다. */
export const NoteImage = Node.create({
  name: "noteImage",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      path: pathAttribute,
      alt: { default: "" },
      // 본문 폭에 대한 %. 비어 있으면 원래 크기(본문 폭까지)로 보인다.
      width: {
        default: null,
        parseHTML: (element: HTMLElement) => clampImageWidth(element.getAttribute("data-width")),
        renderHTML: (attributes: Record<string, unknown>) =>
          attributes.width ? { "data-width": attributes.width } : {},
      },
    };
  },
  parseHTML() {
    return [{ tag: "img[data-note-image]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["img", mergeAttributes({ "data-note-image": "" }, HTMLAttributes)];
  },
  addNodeView() {
    return ReactNodeViewRenderer(ImageView, { attrs: imageBoxAttributes });
  },
});

/** 노트에 첨부한 파일. 이름과 크기를 보여 주고 누르면 내려받는다. */
export const NoteFile = Node.create({
  name: "noteFile",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      path: pathAttribute,
      name: {
        default: "",
        parseHTML: (element: HTMLElement) => element.getAttribute("data-name") ?? "",
        renderHTML: (attributes: Record<string, unknown>) => ({ "data-name": attributes.name }),
      },
      size: {
        default: null,
        parseHTML: (element: HTMLElement) => Number(element.getAttribute("data-size")) || null,
        renderHTML: (attributes: Record<string, unknown>) => ({ "data-size": attributes.size }),
      },
    };
  },
  parseHTML() {
    return [{ tag: "div[data-note-file]" }];
  },
  renderHTML({ HTMLAttributes, node }) {
    return ["div", mergeAttributes({ "data-note-file": "" }, HTMLAttributes), node.attrs.name || "첨부 파일"];
  },
  addNodeView() {
    return ReactNodeViewRenderer(FileView);
  },
});

/**
 * 파일을 저장소에 올리고 노트에 넣는다. 사진은 바로 보이게, 나머지는 파일 칸으로 넣는다.
 * position을 주면 그 자리(끌어다 놓은 곳)에, 없으면 커서 자리에 넣는다.
 * 실패한 파일이 있으면 안내 문구를 돌려준다.
 */
export async function insertNoteFiles(
  editor: Editor,
  tabId: string,
  files: File[],
  position?: number,
): Promise<string | null> {
  const tooLarge: string[] = [];
  const failed: string[] = [];
  let at = position;

  for (const original of files) {
    // 사진은 줄인 뒤의 크기로 따진다. 10MB가 넘는 휴대폰 사진도 줄이면 올릴 수 있다.
    const file = await shrinkImage(original);
    if (file.size > MAX_NOTE_FILE_BYTES) {
      tooLarge.push(original.name);
      continue;
    }
    const path = noteFilePath(tabId, file.name, crypto.randomUUID());
    const { error } = await createClient()
      .storage.from(NOTE_FILES_BUCKET)
      .upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
    if (error) {
      failed.push(file.name);
      continue;
    }
    if (editor.isDestroyed) return null;
    const content = isInlineImage(file.type)
      ? { type: NoteImage.name, attrs: { path, alt: original.name } }
      : { type: NoteFile.name, attrs: { path, name: file.name, size: file.size } };
    // 커서 자리에 넣되 고른 내용을 덮어쓰지 않도록 선택 끝에 넣는다.
    // 방금 넣은 사진이 선택된 채로 다음 파일을 넣어도 사진이 사라지지 않는다.
    const target = at !== undefined ? Math.min(at, editor.state.doc.content.size) : editor.state.selection.to;
    editor.chain().focus().insertContentAt(target, content).run();
    // 여러 파일을 놓으면 놓은 순서대로 이어서 넣는다.
    at = undefined;
  }

  const notes: string[] = [];
  if (tooLarge.length > 0) {
    notes.push(`${tooLarge.join(", ")}: 10MB보다 커서 올리지 않았습니다.`);
  }
  if (failed.length > 0) notes.push(`${failed.join(", ")}: 올리지 못했습니다. 다시 시도해 주세요.`);
  return notes.length > 0 ? notes.join(" ") : null;
}
