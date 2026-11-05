import { describe, expect, it } from "vitest";
import { dayCountLabel, monthCells, splitWeeks, upcomingEvents, weekSegments, type CalendarEvent } from "./calendar";

function event(id: string, startDate: string, endDate: string): CalendarEvent {
  return {
    id,
    tabId: "t",
    title: id,
    startDate,
    endDate,
    time: "",
    assignee: "",
    memo: "",
    color: null,
    linkedTabId: null,
  };
}

const november = splitWeeks(monthCells(2026, 11));
const thirdWeek = november[2];
const fourthWeek = november[3];

describe("월간 달력", () => {
  it("2026년 11월은 일요일에 시작하고 30일까지 있다", () => {
    const cells = monthCells(2026, 11);
    expect(cells[0]).toBe("2026-11-01");
    expect(cells[29]).toBe("2026-11-30");
    expect(cells).toHaveLength(35);
  });

  it("1일이 수요일이면 앞의 3칸을 비운다", () => {
    const cells = monthCells(2026, 7);
    expect(cells.slice(0, 4)).toEqual([null, null, null, "2026-07-01"]);
  });

  it("윤년 2월은 29일까지 있다", () => {
    expect(monthCells(2028, 2)).toContain("2028-02-29");
  });
});

describe("여러 날에 걸친 일정 막대", () => {
  it("같은 주의 일정은 칸마다 나뉘지 않고 막대 하나가 된다", () => {
    const [segment, ...rest] = weekSegments([event("행사", "2026-11-16", "2026-11-21")], thirdWeek);
    expect(rest).toEqual([]);
    expect(segment).toMatchObject({
      startColumn: 1,
      span: 6,
      continuesBefore: false,
      continuesAfter: false,
    });
  });

  it("주를 넘어가는 일정은 이어짐을 표시한 막대로 주마다 나뉜다", () => {
    const capture = event("캡처", "2026-11-16", "2026-11-22");
    expect(weekSegments([capture], thirdWeek)[0]).toMatchObject({
      startColumn: 1,
      span: 6,
      continuesBefore: false,
      continuesAfter: true,
    });
    expect(weekSegments([capture], fourthWeek)[0]).toMatchObject({
      startColumn: 0,
      span: 1,
      continuesBefore: true,
      continuesAfter: false,
    });
  });

  it("겹치는 일정은 다른 줄에, 겹치지 않는 일정은 같은 줄에 놓는다", () => {
    const segments = weekSegments(
      [
        event("긴 일정", "2026-11-16", "2026-11-18"),
        event("겹침", "2026-11-17", "2026-11-17"),
        event("뒤 일정", "2026-11-19", "2026-11-20"),
      ],
      thirdWeek,
    );
    expect(Object.fromEntries(segments.map((s) => [s.event.id, s.lane]))).toEqual({
      "긴 일정": 0,
      겹침: 1,
      "뒤 일정": 0,
    });
  });

  it("달을 넘어온 일정은 이번 달 칸에서만 그리고 이어짐을 표시한다", () => {
    const [segment] = weekSegments([event("월말", "2026-10-30", "2026-11-02")], november[0]);
    expect(segment).toMatchObject({ startColumn: 0, span: 2, continuesBefore: true });
  });

  it("그 주에 없는 일정은 그리지 않는다", () => {
    expect(weekSegments([event("다른 주", "2026-11-01", "2026-11-03")], thirdWeek)).toEqual([]);
  });
});

describe("upcomingEvents", () => {
  const make = (id: string, startDate: string, endDate: string, time = ""): CalendarEvent => ({
    id,
    tabId: "tab",
    title: id,
    startDate,
    endDate,
    time,
    assignee: "",
    memo: "",
    color: null,
    linkedTabId: null,
  });

  it("끝난 일정을 빼고 진행 중인 일정은 남긴다", () => {
    const events = [make("지난", "2026-11-01", "2026-11-05"), make("진행 중", "2026-11-05", "2026-11-06")];
    expect(upcomingEvents(events, "2026-11-06").map((event) => event.id)).toEqual(["진행 중"]);
  });

  it("시작일과 시간 순서로 정렬한다", () => {
    const events = [
      make("늦은 날", "2026-11-09", "2026-11-09"),
      make("오후", "2026-11-07", "2026-11-07", "14:00"),
      make("오전", "2026-11-07", "2026-11-07", "09:00"),
    ];
    expect(upcomingEvents(events, "2026-11-06").map((event) => event.id)).toEqual(["오전", "오후", "늦은 날"]);
  });
});

describe("dayCountLabel", () => {
  it("남은 날을 달이 바뀌어도 정확히 센다", () => {
    expect(dayCountLabel("2026-12-01", "2026-11-29")).toBe("D-2");
  });

  it("오늘이거나 이미 시작한 일정은 오늘로 표시한다", () => {
    expect(dayCountLabel("2026-11-06", "2026-11-06")).toBe("오늘");
    expect(dayCountLabel("2026-11-01", "2026-11-06")).toBe("오늘");
  });
});
