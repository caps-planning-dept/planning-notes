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
