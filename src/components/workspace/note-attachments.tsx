"use client";

import { mergeAttributes, Node } from "@tiptap/core";
import { type Editor, NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";
import { Download, FileText } from "lucide-react";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  formatBytes,
  isInlineImage,
  MAX_NOTE_FILE_BYTES,
  NOTE_FILES_BUCKET,
  noteFilePath,
} from "@/lib/note-files";
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

function ImageView({ node, selected }: ReactNodeViewProps) {
  const path = node.attrs.path as string | null;
  const alt = (node.attrs.alt as string) || "첨부한 사진";
  const { url, failed } = useSignedUrl(path);

  return (
    <NodeViewWrapper className="note-image my-2" data-drag-handle>
      {url ? (
        // 비공개 저장소의 임시 주소라서 Next.js 이미지 최적화를 거치지 않는다.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={alt}
          draggable={false}
          className={cn("max-h-128 max-w-full rounded-md", selected && "ring-2 ring-ring ring-offset-2")}
        />
      ) : (
        <div
          role="img"
          aria-label={alt}
          className={cn(
            "flex h-40 max-w-md items-center justify-center rounded-md bg-muted text-sm text-muted-foreground",
            selected && "ring-2 ring-ring ring-offset-2",
          )}
        >
          {failed ? "사진을 불러오지 못했습니다" : "사진을 불러오는 중"}
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
    };
  },
  parseHTML() {
    return [{ tag: "img[data-note-image]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["img", mergeAttributes({ "data-note-image": "" }, HTMLAttributes)];
  },
  addNodeView() {
    return ReactNodeViewRenderer(ImageView);
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
  const tooLarge = files.filter((file) => file.size > MAX_NOTE_FILE_BYTES);
  const failed: string[] = [];
  let at = position;

  for (const file of files) {
    if (tooLarge.includes(file)) continue;
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
      ? { type: NoteImage.name, attrs: { path, alt: file.name } }
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
    notes.push(`${tooLarge.map((file) => file.name).join(", ")}: 10MB보다 커서 올리지 않았습니다.`);
  }
  if (failed.length > 0) notes.push(`${failed.join(", ")}: 올리지 못했습니다. 다시 시도해 주세요.`);
  return notes.length > 0 ? notes.join(" ") : null;
}
