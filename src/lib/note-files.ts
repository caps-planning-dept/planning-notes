export const NOTE_FILES_BUCKET = "note-files";

/** 한 파일의 최대 크기. 저장소 버킷에도 같은 제한을 둔다. */
export const MAX_NOTE_FILE_BYTES = 10 * 1024 * 1024;

/** 노트 안에 바로 보여 줄 사진 종류. 나머지는 파일로 첨부한다. */
const INLINE_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "image/avif"]);

export function isInlineImage(type: string): boolean {
  return INLINE_IMAGE_TYPES.has(type.toLowerCase());
}

/**
 * 저장소 경로를 만든다. 첫 폴더는 탭 ID라서 저장소 권한이 탭 권한을 그대로 따른다.
 * 원래 파일 이름은 한글이나 특수문자가 들어갈 수 있으므로 경로에는 넣지 않고 노트에만 적는다.
 */
export function noteFilePath(tabId: string, fileName: string, id: string): string {
  const extension = /\.([a-z0-9]{1,8})$/i.exec(fileName)?.[1]?.toLowerCase();
  return `${tabId}/${id}${extension ? `.${extension}` : ""}`;
}

/** 파일 크기를 읽기 쉬운 단위로 바꾼다. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/** 사진 너비(본문 폭에 대한 %)의 한계와 빠른 선택 값 */
export const MIN_IMAGE_WIDTH = 15;
export const MAX_IMAGE_WIDTH = 100;
export const IMAGE_WIDTH_PRESETS = [
  { label: "작게", value: 33 },
  { label: "중간", value: 50 },
  { label: "크게", value: 75 },
  { label: "꽉 차게", value: 100 },
] as const;

/** 사진 너비를 한계 안의 정수로 맞춘다. 숫자가 아니면 null(원래 크기)을 돌려준다. */
export function clampImageWidth(value: unknown): number | null {
  const number = typeof value === "string" ? Number(value) : value;
  if (typeof number !== "number" || !Number.isFinite(number) || number <= 0) return null;
  return Math.round(Math.min(MAX_IMAGE_WIDTH, Math.max(MIN_IMAGE_WIDTH, number)));
}

/** 올리기 전에 줄일 사진의 긴 쪽 최대 길이(px) */
export const MAX_IMAGE_EDGE = 2000;

/** 긴 쪽이 maxEdge를 넘으면 비율을 지켜 줄인 크기를, 아니면 원래 크기를 돌려준다. */
export function fitImageSize(width: number, height: number, maxEdge = MAX_IMAGE_EDGE) {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** 파일 이름의 확장자를 바꾼다. 줄인 사진은 형식이 바뀔 수 있다. */
export function replaceExtension(fileName: string, extension: string): string {
  const base = fileName.replace(/\.[^./\\]{1,8}$/, "");
  return `${base || "사진"}.${extension}`;
}
