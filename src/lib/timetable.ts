/** 0 = 월요일 … 6 = 일요일 */
export const DAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"] as const;

/** 시간표에 이름으로 더한 사람. 앱 계정이 없어도 된다. */
export type TimetablePerson = {
  id: string;
  name: string;
  /** 이 사람을 더한 멤버. 그 멤버와 관리자만 고칠 수 있다. */
  createdBy: string | null;
};

export type TimetableClass = {
  id: string;
  personId: string;
  day: number;
  /** 자정부터 센 분 (9:30 = 570) */
  start: number;
  end: number;
  title: string;
  place: string;
};

/** 새로 넣거나 사진에서 읽은 수업. 아직 저장 전이라 id가 없다. */
export type ClassDraft = Omit<TimetableClass, "id" | "personId">;

/** 겹쳐 보기 칸의 크기(분) */
export const SLOT_MINUTES = 30;
/** 수업이 없을 때도 보여 줄 기본 시간 범위 */
export const DEFAULT_START_HOUR = 9;
export const DEFAULT_END_HOUR = 18;

/** "9:30", "09:30", "21:05" → 분. 잘못된 값이면 null */
export function parseTime(value: string): number | null {
  const match = /^\s*(\d{1,2}):(\d{2})\s*$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 24 || minutes > 59 || (hours === 24 && minutes > 0)) return null;
  return hours * 60 + minutes;
}

/** 분 → "09:30" (시간 입력칸 형식) */
export function formatTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/** 분 → "9:30" (화면에 보이는 짧은 형식) */
export function formatShortTime(minutes: number): string {
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;
}

/** 수업 하나가 저장해도 되는 값인지 확인하고, 문제가 있으면 안내 문구를 돌려준다. */
export function validateClass(draft: ClassDraft): string | null {
  if (!draft.title.trim()) return "수업 이름을 입력하세요.";
  if (draft.title.trim().length > 100) return "수업 이름은 100자까지 쓸 수 있습니다.";
  if (draft.place.trim().length > 200) return "강의실은 200자까지 쓸 수 있습니다.";
  if (!Number.isInteger(draft.day) || draft.day < 0 || draft.day > 6) return "요일을 고르세요.";
  if (draft.start < 0 || draft.end > 1440 || draft.end <= draft.start) return "끝나는 시간이 시작 시간보다 늦어야 합니다.";
  return null;
}

const DAY_NAMES: Record<string, number> = {
  월: 0, 화: 1, 수: 2, 목: 3, 금: 4, 토: 5, 일: 6,
  mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6,
};

/** 사진을 읽은 AI의 답을 믿지 않고 하나씩 확인해 쓸 수 있는 수업만 남긴다. 시간은 5분 단위로 맞춘다. */
export function normalizeReadClasses(raw: unknown): ClassDraft[] {
  const list = (raw as { classes?: unknown } | null)?.classes;
  if (!Array.isArray(list)) return [];
  const round = (minutes: number) => Math.round(minutes / 5) * 5;
  const drafts: ClassDraft[] = [];
  for (const item of list.slice(0, 60)) {
    if (!item || typeof item !== "object") continue;
    const value = item as Record<string, unknown>;
    const dayText = String(value.day ?? "").trim().toLowerCase();
    // "월", "월요일", "Mon", "monday", 0 모두 받는다.
    const day =
      typeof value.day === "number" ? value.day : (DAY_NAMES[dayText.slice(0, 3)] ?? DAY_NAMES[dayText.slice(0, 1)]);
    const start = parseTime(String(value.start ?? ""));
    const end = parseTime(String(value.end ?? ""));
    if (day === undefined || start === null || end === null) continue;
    const draft = {
      day,
      start: round(start),
      end: round(end),
      title: String(value.title ?? "").trim().slice(0, 100),
      place: String(value.place ?? "").trim().slice(0, 200),
    };
    if (validateClass(draft) === null) drafts.push(draft);
  }
  return drafts.sort((a, b) => a.day - b.day || a.start - b.start);
}

/** 화면에 보일 요일(월~금은 늘, 주말은 수업이 있을 때만)과 시간 범위(시 단위) */
export function visibleRange(classes: Pick<TimetableClass, "day" | "start" | "end">[]) {
  const days = [0, 1, 2, 3, 4];
  if (classes.some((item) => item.day === 5 || item.day === 6)) days.push(5);
  if (classes.some((item) => item.day === 6)) days.push(6);
  const startHour = Math.min(DEFAULT_START_HOUR, ...classes.map((item) => Math.floor(item.start / 60)));
  const endHour = Math.max(DEFAULT_END_HOUR, ...classes.map((item) => Math.ceil(item.end / 60)));
  return { days, startHour, endHour };
}

/** 그 칸(요일, 시작 분부터 SLOT_MINUTES 동안)에 수업이 있는 사람들의 id */
export function busyPeople(classes: TimetableClass[], day: number, slotStart: number): Set<string> {
  const slotEnd = slotStart + SLOT_MINUTES;
  return new Set(
    classes.filter((item) => item.day === day && item.start < slotEnd && item.end > slotStart).map((item) => item.personId),
  );
}

export type FreeWindow = { day: number; start: number; end: number };

/**
 * 시간표를 넣은 사람이 모두 비어 있는 시간을 요일별로 이어 붙여 돌려준다.
 * minMinutes보다 짧은 틈은 회의를 잡기 어려우므로 뺀다.
 */
export function commonFreeWindows(
  classes: TimetableClass[],
  days: number[],
  startHour: number,
  endHour: number,
  minMinutes = 60,
): FreeWindow[] {
  const windows: FreeWindow[] = [];
  for (const day of days) {
    let open: number | null = null;
    for (let slot = startHour * 60; slot <= endHour * 60; slot += SLOT_MINUTES) {
      const free = slot < endHour * 60 && busyPeople(classes, day, slot).size === 0;
      if (free && open === null) open = slot;
      if (!free && open !== null) {
        if (slot - open >= minMinutes) windows.push({ day, start: open, end: slot });
        open = null;
      }
    }
  }
  return windows;
}

/** 사람 이름을 다듬고 확인한다. 문제가 있으면 안내 문구를 돌려준다. */
export function validatePersonName(name: string, others: string[]): string | null {
  const trimmed = name.trim();
  if (!trimmed) return "이름을 입력하세요.";
  if (trimmed.length > 40) return "이름은 40자까지 쓸 수 있습니다.";
  if (others.includes(trimmed)) return "같은 이름이 이미 있습니다. 구분할 수 있게 바꿔 주세요(예: 김민지B).";
  return null;
}
