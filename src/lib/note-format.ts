export type NoteColor = { label: string; value: string };

/** 흰 배경 위에서 대비 4.5:1 이상인 글씨 색 */
export const TEXT_COLORS: NoteColor[] = [
  { label: "빨강", value: "#c92a2a" },
  { label: "주황", value: "#b54708" },
  { label: "초록", value: "#1f7a37" },
  { label: "파랑", value: "#1971c2" },
  { label: "보라", value: "#7048c8" },
];

/** 본문 글자(#2b2a27)와 대비 4.5:1 이상인 형광펜 색 */
export const HIGHLIGHT_COLORS: NoteColor[] = [
  { label: "노랑", value: "#fff3a3" },
  { label: "연두", value: "#c9f2c7" },
  { label: "하늘", value: "#cfe6ff" },
  { label: "분홍", value: "#ffd6e7" },
  { label: "살구", value: "#ffe0b8" },
];

export const NOTE_FONTS: { label: string; value: string }[] = [
  { label: "기본", value: "" },
  { label: "명조", value: "var(--font-note-serif)" },
  { label: "제목용", value: "var(--font-display)" },
];
