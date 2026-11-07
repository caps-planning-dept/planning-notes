import { describe, expect, it } from "vitest";
import {
  busyPeople,
  commonFreeWindows,
  formatShortTime,
  formatTime,
  normalizeReadClasses,
  parseTime,
  type TimetableClass,
  validateClass,
  validatePersonName,
  visibleRange,
} from "./timetable";
import { findReadResult } from "./timetable-read";

const lesson = (personId: string, day: number, start: string, end: string): TimetableClass => ({
  id: `${personId}-${day}-${start}`,
  personId,
  day,
  start: parseTime(start)!,
  end: parseTime(end)!,
  title: "수업",
  place: "",
});

describe("시간 바꾸기", () => {
  it("시:분을 분으로, 분을 시:분으로 바꾼다", () => {
    expect(parseTime("9:30")).toBe(570);
    expect(parseTime("13:05")).toBe(785);
    expect(parseTime("24:00")).toBe(1440);
    expect(parseTime("24:30")).toBeNull();
    expect(parseTime("9시")).toBeNull();
    expect(formatTime(570)).toBe("09:30");
    expect(formatShortTime(570)).toBe("9:30");
  });
});

describe("수업 확인", () => {
  it("이름이 없거나 시간이 거꾸로면 막는다", () => {
    expect(validateClass({ day: 0, start: 600, end: 690, title: "회계", place: "" })).toBeNull();
    expect(validateClass({ day: 0, start: 600, end: 690, title: " ", place: "" })).toMatch("이름");
    expect(validateClass({ day: 0, start: 690, end: 600, title: "회계", place: "" })).toMatch("늦어야");
    expect(validateClass({ day: 7, start: 600, end: 690, title: "회계", place: "" })).toMatch("요일");
  });
});

describe("사진에서 읽은 답 정리", () => {
  it("여러 요일 표기를 받고 시간을 5분 단위로 맞춘다", () => {
    const result = normalizeReadClasses({
      classes: [
        { day: "화요일", start: "9:00", end: "10:28", title: "디지털시대의글쓰기", place: "P301" },
        { day: "Mon", start: "10:30", end: "13:30", title: "생성형AI와데이터과학" },
        { day: 4, start: "13:30", end: "16:30", title: "재무관리", place: "L304" },
      ],
    });
    expect(result).toEqual([
      { day: 0, start: 630, end: 810, title: "생성형AI와데이터과학", place: "" },
      { day: 1, start: 540, end: 630, title: "디지털시대의글쓰기", place: "P301" },
      { day: 4, start: 810, end: 990, title: "재무관리", place: "L304" },
    ]);
  });

  it("쓸 수 없는 항목은 버린다", () => {
    expect(normalizeReadClasses(null)).toEqual([]);
    expect(normalizeReadClasses({ classes: "x" })).toEqual([]);
    expect(
      normalizeReadClasses({
        classes: [
          { day: "아무날", start: "9:00", end: "10:00", title: "a" },
          { day: "월", start: "11:00", end: "10:00", title: "b" },
          { day: "월", start: "9:00", end: "10:00", title: "" },
          "문자열",
        ],
      }),
    ).toEqual([]);
  });
});

describe("겹쳐 보기", () => {
  const classes = [lesson("a", 0, "9:00", "10:30"), lesson("b", 0, "10:00", "12:00"), lesson("a", 1, "13:00", "14:00")];

  it("칸마다 수업 있는 사람을 센다", () => {
    expect([...busyPeople(classes, 0, 540)]).toEqual(["a"]);
    expect([...busyPeople(classes, 0, 600)].sort()).toEqual(["a", "b"]);
    expect(busyPeople(classes, 0, 720).size).toBe(0);
  });

  it("모두 비는 시간을 1시간 이상만 이어 붙인다", () => {
    expect(commonFreeWindows(classes, [0, 1], 9, 18)).toEqual([
      { day: 0, start: 720, end: 1080 },
      { day: 1, start: 540, end: 780 },
      { day: 1, start: 840, end: 1080 },
    ]);
  });

  it("주말 수업이 있을 때만 주말을 보이고, 시간 범위를 넓힌다", () => {
    expect(visibleRange([])).toEqual({ days: [0, 1, 2, 3, 4], startHour: 9, endHour: 18 });
    expect(visibleRange([lesson("a", 5, "8:00", "19:30")])).toEqual({
      days: [0, 1, 2, 3, 4, 5],
      startHour: 8,
      endHour: 20,
    });
  });
});

describe("AI 답에서 결과 찾기", () => {
  const result = { classes: [{ day: "월", start: "9:00", end: "10:00", title: "a", place: "" }] };

  it("여러 모양의 답에서 classes JSON을 찾는다", () => {
    expect(findReadResult({ outputs: [{ type: "thought" }, { type: "text", text: JSON.stringify(result) }] })).toEqual(result);
    expect(findReadResult({ candidates: [{ content: { parts: [{ text: "```json\n" + JSON.stringify(result) + "\n```" }] } }] })).toEqual(result);
    expect(findReadResult({ output: result })).toEqual(result);
  });

  it("찾지 못하면 null을 돌려준다", () => {
    expect(findReadResult({ outputs: [{ text: "죄송합니다" }] })).toBeNull();
    expect(findReadResult(null)).toBeNull();
  });
});

describe("사람 이름", () => {
  it("빈 이름, 긴 이름, 같은 이름을 막는다", () => {
    expect(validatePersonName(" 정율 ", ["혜륜"])).toBeNull();
    expect(validatePersonName("  ", [])).toMatch("입력");
    expect(validatePersonName("가".repeat(41), [])).toMatch("40자");
    expect(validatePersonName("혜륜 ", ["혜륜"])).toMatch("같은 이름");
  });
});
