export type CalendarEvent = {
  id: string;
  tabId: string;
  title: string;
  startDate: string;
  endDate: string;
  time: string;
  assignee: string;
  memo: string;
  color: string | null;
  linkedTabId: string | null;
};

/** 한 주 안에서 일정이 차지하는 막대. 칸 번호는 0(일)~6(토)이다. */
export type EventSegment = {
  event: CalendarEvent;
  lane: number;
  startColumn: number;
  span: number;
  continuesBefore: boolean;
  continuesAfter: boolean;
};

const pad = (value: number) => String(value).padStart(2, "0");

export function toDateKey(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** 일요일로 시작하는 월간 달력 칸을 돌려준다. 다른 달의 칸은 null이다. month는 1~12이다. */
export function monthCells(year: number, month: number): (string | null)[] {
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const dayCount = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: (string | null)[] = Array(firstWeekday).fill(null);
  for (let day = 1; day <= dayCount; day += 1) cells.push(toDateKey(year, month, day));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function splitWeeks<T>(cells: T[]): T[][] {
  const weeks: T[][] = [];
  for (let index = 0; index < cells.length; index += 7) weeks.push(cells.slice(index, index + 7));
  return weeks;
}

/**
 * 한 주에 걸친 일정을 막대로 바꾸고, 겹치지 않도록 줄을 배정한다.
 * YYYY-MM-DD 형식은 문자열 순서가 날짜 순서와 같다.
 */
export function weekSegments(events: CalendarEvent[], week: (string | null)[]): EventSegment[] {
  const sorted = [...events].sort(
    (a, b) =>
      a.startDate.localeCompare(b.startDate) ||
      b.endDate.localeCompare(a.endDate) ||
      a.id.localeCompare(b.id),
  );
  const laneEnds: number[] = [];
  const segments: EventSegment[] = [];

  for (const event of sorted) {
    const columns = week.flatMap((date, column) =>
      date && event.startDate <= date && date <= event.endDate ? [column] : [],
    );
    if (columns.length === 0) continue;
    const startColumn = columns[0];
    const endColumn = columns[columns.length - 1];
    let lane = laneEnds.findIndex((end) => end < startColumn);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = endColumn;
    segments.push({
      event,
      lane,
      startColumn,
      span: endColumn - startColumn + 1,
      continuesBefore: event.startDate < (week[startColumn] as string),
      continuesAfter: event.endDate > (week[endColumn] as string),
    });
  }
  return segments;
}

/** 끝나지 않은 일정을 시작일과 시간 순서로 돌려준다. today는 YYYY-MM-DD 형식이다. */
export function upcomingEvents(events: CalendarEvent[], today: string): CalendarEvent[] {
  return events
    .filter((event) => event.endDate >= today)
    .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.time.localeCompare(b.time));
}

/** 일정까지 남은 날을 `오늘`, `D-3`처럼 돌려준다. 이미 시작한 일정은 `오늘`이다. */
export function dayCountLabel(startDate: string, today: string): string {
  const days = (Date.parse(`${startDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000;
  return days <= 0 ? "오늘" : `D-${days}`;
}
