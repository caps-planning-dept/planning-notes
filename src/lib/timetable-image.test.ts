import { describe, expect, it } from "vitest";
import { correctTimesFromImage, findGrid, type Pixels } from "./timetable-image";

type Color = [number, number, number];

/** 에브리타임 모양의 시간표 그림을 만든다. 9시부터 한 시간에 hourPx씩, 요일 열 5개. */
function drawTimetable(options: {
  background: Color;
  line: Color;
  blocks: { day: number; start: number; end: number; color: Color }[];
  outerBorder?: boolean;
  rightBorder?: boolean;
}): Pixels {
  const hourPx = 60;
  const header = 30;
  const label = options.outerBorder ? 40 : 30;
  const left = options.outerBorder ? 10 : 0;
  const column = 100;
  const width = label + column * 5 + (options.rightBorder === false ? 0 : 2);
  const height = header + hourPx * 10;
  const data = new Uint8ClampedArray(width * height * 4);
  const paint = (x: number, y: number, [r, g, b]: Color) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    data.set([r, g, b, 255], (y * width + x) * 4);
  };
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) paint(x, y, options.background);
  // 가로줄: 머리줄 아래부터 한 시간마다
  for (let hour = 0; hour <= 9; hour++) for (let x = left; x < width; x++) paint(x, header + hour * hourPx, options.line);
  // 세로줄: 바깥 테두리, 시간 눈금 칸, 요일 열 사이
  const verticals = [...(options.outerBorder ? [left] : []), label, ...[1, 2, 3, 4].map((i) => label + column * i)];
  if (options.rightBorder !== false) verticals.push(label + column * 5);
  for (const x of verticals) for (let y = 0; y < height; y++) paint(x, y, options.line);
  // 수업 칸: 테두리 안쪽에 1px 띄우고, 흰 글자 줄을 몇 개 넣는다.
  for (const block of options.blocks) {
    const x0 = label + column * block.day + 2;
    const y0 = header + ((block.start - 540) / 60) * hourPx + 1;
    const y1 = header + ((block.end - 540) / 60) * hourPx - 1;
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x0 + column - 3; x++) {
        const text = (y - y0) % 14 < 3 && x % 3 === 0;
        paint(x, y, text ? [255, 255, 255] : block.color);
      }
    }
  }
  return { width, height, data };
}

const draft = (day: number, start: number, end: number, title: string) => ({ day, start, end, title, place: "" });

describe("시간표 그림에서 시간 재기", () => {
  const blocks = [
    { day: 0, start: 630, end: 810, color: [240, 128, 114] as Color },
    { day: 1, start: 540, end: 630, color: [168, 214, 114] as Color },
    // 틈 없이 이어진 다른 색 칸
    { day: 1, start: 630, end: 720, color: [127, 207, 197] as Color },
    { day: 4, start: 810, end: 990, color: [120, 200, 130] as Color },
  ];
  // AI가 시간을 틀리게 읽은 경우 (늘 1시간 반짜리로 읽음)
  const aiDrafts = [draft(0, 630, 720, "생성형AI"), draft(1, 540, 630, "글쓰기"), draft(1, 630, 720, "소셜"), draft(4, 780, 870, "재무관리")];
  const expected = [draft(0, 630, 810, "생성형AI"), draft(1, 540, 630, "글쓰기"), draft(1, 630, 720, "소셜"), draft(4, 810, 990, "재무관리")];

  it("밝은 화면: 칸 위치로 시간을 고친다", () => {
    const pixels = drawTimetable({ background: [255, 255, 255], line: [225, 225, 225], blocks });
    const result = correctTimesFromImage(aiDrafts, pixels);
    expect(result.drafts).toEqual(expected);
    expect(result.fixed).toBe(2);
  });

  it("어두운 화면, 바깥 테두리가 있어도 찾는다", () => {
    const pixels = drawTimetable({ background: [17, 17, 17], line: [52, 52, 52], blocks, outerBorder: true });
    expect(correctTimesFromImage(aiDrafts, pixels).drafts).toEqual(expected);
  });

  it("오른쪽 끝 테두리 없이 잘린 캡처도 마지막 요일을 찾는다", () => {
    const pixels = drawTimetable({ background: [255, 255, 255], line: [225, 225, 225], blocks, rightBorder: false });
    expect(findGrid(pixels)?.columns).toHaveLength(5);
    expect(correctTimesFromImage(aiDrafts, pixels).drafts).toEqual(expected);
  });

  it("칸 수가 AI와 다른 요일은 AI 시간을 그대로 둔다", () => {
    const pixels = drawTimetable({ background: [255, 255, 255], line: [225, 225, 225], blocks });
    const fewer = [draft(1, 540, 630, "글쓰기")];
    expect(correctTimesFromImage(fewer, pixels).drafts).toEqual(fewer);
  });

  it("시간표가 아닌 그림은 건드리지 않는다", () => {
    const blank: Pixels = { width: 50, height: 50, data: new Uint8ClampedArray(50 * 50 * 4).fill(255) };
    expect(correctTimesFromImage(aiDrafts, blank)).toEqual({ drafts: aiDrafts, fixed: 0, measured: false });
  });
});
