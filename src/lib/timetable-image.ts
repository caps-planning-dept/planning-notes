import type { ClassDraft } from "./timetable";

/**
 * 시간표 캡처에서 색 칸의 위치를 재어 수업 시간을 정확히 구한다.
 *
 * AI는 수업 이름과 요일은 잘 읽지만, 칸의 위·아래 끝으로 시간을 정하는 일은 자주 틀린다
 * (2026-11-07 시험: 어두운 화면 캡처에서 7개 중 7개의 시간이 틀림).
 * 그래서 글은 AI에게 맡기고, 시간은 그림에서 직접 잰다.
 *
 * 1. 왼쪽 시간 눈금 칸에서 가로줄(한 시간 간격)을 찾는다.
 * 2. 맨 위 요일 머리줄에서 세로줄을 찾아 요일 열을 나눈다.
 * 3. 열마다 색이 칠해진 줄을 이어 칸(수업)을 찾는다.
 * 4. 요일마다 AI가 읽은 수업과 위에서부터 차례로 짝지어 시간을 바꾼다.
 */

export type Pixels = { width: number; height: number; data: Uint8ClampedArray | number[] };

export type Block = { column: number; top: number; bottom: number; color: [number, number, number] };

export type Grid = {
  /** 한 시간 간격으로 놓인 가로줄의 y 좌표 */
  hourLines: number[];
  /** 요일 열의 [왼쪽, 오른쪽] x 좌표. 첫 열이 월요일이다. */
  columns: [number, number][];
};

function rgb(pixels: Pixels, x: number, y: number): [number, number, number] {
  const index = (y * pixels.width + x) * 4;
  return [pixels.data[index], pixels.data[index + 1], pixels.data[index + 2]];
}

/** 색 칸에 칠해진 픽셀인가 (회색·흰색·검은색이 아닌 뚜렷한 색) */
function isColored([r, g, b]: [number, number, number]): boolean {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max > 70 && (max - min) / max > 0.22;
}

const luminance = ([r, g, b]: [number, number, number]) => 0.299 * r + 0.587 * g + 0.114 * b;

/** 바탕색의 밝기. 색이 없는 픽셀 가운데 가장 흔한 밝기다. */
function backgroundLuminance(pixels: Pixels): number {
  const counts = new Array<number>(256).fill(0);
  const step = Math.max(1, Math.floor(Math.sqrt((pixels.width * pixels.height) / 40_000)));
  for (let y = 0; y < pixels.height; y += step) {
    for (let x = 0; x < pixels.width; x += step) {
      const color = rgb(pixels, x, y);
      if (!isColored(color)) counts[Math.round(luminance(color))] += 1;
    }
  }
  return counts.indexOf(Math.max(...counts));
}

/** 격자선 픽셀인가 (바탕과 조금 다른 무채색) */
function isLine(color: [number, number, number], background: number): boolean {
  if (isColored(color)) return false;
  const difference = Math.abs(luminance(color) - background);
  return difference >= 6 && difference <= 100;
}

/** 값이 threshold를 넘는 연속 구간의 가운데 위치들 */
function peaks(values: number[], threshold: number): number[] {
  const found: number[] = [];
  let start = -1;
  values.forEach((value, index) => {
    if (value >= threshold && start < 0) start = index;
    if ((value < threshold || index === values.length - 1) && start >= 0) {
      const end = value >= threshold ? index : index - 1;
      found.push((start + end) / 2);
      start = -1;
    }
  });
  return found;
}

const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

/** 간격이 거의 같은 줄이 가장 길게 이어진 묶음 */
function longestEvenRun(lines: number[]): number[] {
  if (lines.length < 3) return [];
  const gaps = lines.slice(1).map((line, index) => line - lines[index]);
  const spacing = median(gaps);
  let best: number[] = [];
  let run = [lines[0]];
  for (let index = 1; index < lines.length; index += 1) {
    const gap = lines[index] - lines[index - 1];
    if (Math.abs(gap - spacing) <= spacing * 0.06) run.push(lines[index]);
    else {
      if (run.length > best.length) best = run;
      run = [lines[index]];
    }
  }
  return run.length > best.length ? run : best;
}

/** 격자(시간 가로줄과 요일 열)를 찾는다. 찾지 못하면 null */
export function findGrid(pixels: Pixels): Grid | null {
  const { width, height } = pixels;
  const background = backgroundLuminance(pixels);

  // 세로줄: 위에서 아래까지 격자선 색이 많이 이어진 x
  const verticalScore = Array.from({ length: width }, (_, x) => {
    let count = 0;
    for (let y = 0; y < height; y += 2) if (isLine(rgb(pixels, x, y), background)) count += 1;
    return count / Math.ceil(height / 2);
  });
  const verticals = peaks(verticalScore, 0.3).filter((x) => x > 2 && x < width - 3);
  if (verticals.length < 3) return null;

  // 시간 눈금 칸 안에서 가로로 격자선 색이 이어진 y를 찾는다. 숫자는 짧아서 걸리지 않는다.
  const hourLinesIn = (left: number, right: number) => {
    if (right - left < 8) return [];
    const score = Array.from({ length: height }, (_, y) => {
      let count = 0;
      let total = 0;
      for (let x = Math.ceil(left) + 2; x < right - 1; x += 1) {
        total += 1;
        if (isLine(rgb(pixels, x, y), background)) count += 1;
      }
      return total > 0 ? count / total : 0;
    });
    return longestEvenRun(peaks(score, 0.6));
  };
  // 시간 눈금 칸은 맨 왼쪽 칸이거나, 바깥 테두리가 따로 있으면 그다음 칸이다. 가로줄이 더 많이 보이는 쪽을 고른다.
  const candidates: [number, number][] = [
    [0, verticals[0]],
    [verticals[0], verticals[1]],
  ];
  const [labelRight, hourLines] = candidates
    .map(([left, right]) => [right, hourLinesIn(left, right)] as const)
    .reduce((best, next) => (next[1].length > best[1].length ? next : best));
  if (hourLines.length < 3) return null;

  // 요일 열: 시간 눈금 칸 오른쪽의 세로줄 사이. 너비가 고른 것만 남긴다.
  const borders = verticals.filter((x) => x >= labelRight - 1);
  const spans: [number, number][] = borders.slice(1).map((x, index) => [borders[index], x]);
  const typical = median(spans.map(([left, right]) => right - left));
  const columns = spans.filter(([left, right]) => Math.abs(right - left - typical) <= typical * 0.15);
  // 캡처가 오른쪽 끝 테두리 없이 잘렸으면, 남은 폭이 한 열만 할 때 마지막 열로 더한다.
  const last = borders[borders.length - 1];
  if (Math.abs(width - last - typical) <= typical * 0.15) columns.push([last, width - 1]);
  if (columns.length === 0 || columns.length > 7) return null;

  return { hourLines, columns };
}

/** 열마다 색이 칠해진 칸을 찾는다. 붙어 있는 두 칸은 사이의 틈이나 색 차이로 나눈다. */
export function findBlocks(pixels: Pixels, grid: Grid): Block[] {
  const lines = grid.hourLines;
  const spacing = (lines[lines.length - 1] - lines[0]) / (lines.length - 1);
  const blocks: Block[] = [];
  grid.columns.forEach(([left, right], column) => {
    const from = Math.ceil(left + (right - left) * 0.1);
    const to = Math.floor(right - (right - left) * 0.1);
    const found: Block[] = [];
    let start = -1;
    let sum: [number, number, number] = [0, 0, 0];
    let rows = 0;
    let previous: [number, number, number] | null = null;
    const close = (end: number) => {
      // 너무 얇은 것은 칸이 아니라 잡티로 본다.
      if (start >= 0 && end - start >= 6) {
        found.push({ column, top: start, bottom: end, color: [sum[0] / rows, sum[1] / rows, sum[2] / rows] });
      }
      start = -1;
      sum = [0, 0, 0];
      rows = 0;
    };
    for (let y = Math.floor(lines[0]); y < pixels.height; y += 1) {
      let colored = 0;
      let row: [number, number, number] = [0, 0, 0];
      for (let x = from; x <= to; x += 1) {
        const color = rgb(pixels, x, y);
        if (isColored(color)) {
          colored += 1;
          row = [row[0] + color[0], row[1] + color[1], row[2] + color[2]];
        }
      }
      // 칸 안의 흰 글자 때문에 색이 덜 칠한 줄도 칸으로 본다.
      const filled = colored / (to - from + 1) > 0.25;
      const mean: [number, number, number] | null = colored > 0 ? [row[0] / colored, row[1] / colored, row[2] / colored] : null;
      if (!filled || !mean) {
        close(y);
        previous = null;
        continue;
      }
      if (start >= 0 && previous && distance(mean, previous) > 40) close(y);
      if (start < 0) start = y;
      sum = [sum[0] + mean[0], sum[1] + mean[1], sum[2] + mean[2]];
      rows += 1;
      previous = mean;
    }
    close(pixels.height);

    // 글자 줄 때문에 잠깐 끊긴 같은 색 칸은 다시 잇는다. 수업 사이의 틈은 보통 색이 다르다.
    const merged: Block[] = [];
    for (const block of found) {
      const last = merged[merged.length - 1];
      if (last && block.top - last.bottom <= spacing * 0.08 && distance(block.color, last.color) <= 25) {
        last.bottom = block.bottom;
      } else {
        merged.push({ ...block });
      }
    }
    blocks.push(...merged);
  });
  return blocks;
}

function distance(a: [number, number, number], b: [number, number, number]) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/** y 좌표를 시간(분)으로 바꾼다. firstHour는 첫 가로줄의 시각이다. */
function minuteAt(y: number, grid: Grid, firstHour: number): number {
  const lines = grid.hourLines;
  const spacing = (lines[lines.length - 1] - lines[0]) / (lines.length - 1);
  const hours = firstHour + (y - lines[0]) / spacing;
  return Math.round((hours * 60) / 5) * 5;
}

/**
 * AI가 읽은 수업의 시간을 그림에서 잰 시간으로 바꾼다.
 * 요일마다 칸 수와 AI 수업 수가 같을 때만 위에서부터 짝짓는다. 다르면 그 요일은 AI 시간을 그대로 둔다.
 * 첫 가로줄이 몇 시인지는, 짝지은 수업들이 AI 시간과 가장 잘 맞는 시각으로 정한다.
 * 고친 수업 수를 함께 돌려준다.
 */
export function applyMeasuredTimes(drafts: ClassDraft[], blocks: Block[], grid: Grid): { drafts: ClassDraft[]; fixed: number } {
  const pairs: { index: number; block: Block }[] = [];
  grid.columns.forEach((_, column) => {
    const dayBlocks = blocks.filter((block) => block.column === column).sort((a, b) => a.top - b.top);
    const dayDrafts = drafts
      .map((draft, index) => ({ draft, index }))
      .filter(({ draft }) => draft.day === column)
      .sort((a, b) => a.draft.start - b.draft.start);
    if (dayBlocks.length === 0 || dayBlocks.length !== dayDrafts.length) return;
    dayDrafts.forEach(({ index }, order) => pairs.push({ index, block: dayBlocks[order] }));
  });
  if (pairs.length === 0) return { drafts, fixed: 0 };

  let bestHour = 0;
  let bestError = Infinity;
  for (let hour = 0; hour <= 14; hour += 1) {
    const error = pairs.reduce(
      (sum, { index, block }) => sum + Math.abs(minuteAt(block.top, grid, hour) - drafts[index].start),
      0,
    );
    if (error < bestError) {
      bestError = error;
      bestHour = hour;
    }
  }
  // AI 시간과 평균 1시간 넘게 어긋나면 격자를 잘못 찾은 것으로 보고 쓰지 않는다.
  if (bestError / pairs.length > 60) return { drafts, fixed: 0 };

  const next = drafts.map((draft) => ({ ...draft }));
  let fixed = 0;
  for (const { index, block } of pairs) {
    const start = minuteAt(block.top, grid, bestHour);
    const end = minuteAt(block.bottom, grid, bestHour);
    if (end <= start || start < 0 || end > 1440) continue;
    if (start !== next[index].start || end !== next[index].end) fixed += 1;
    next[index].start = start;
    next[index].end = end;
  }
  return { drafts: next, fixed };
}

/** 한 번에: 격자를 찾고, 칸을 찾고, 시간을 바꾼다. 어느 단계든 실패하면 AI 시간을 그대로 돌려준다. */
export function correctTimesFromImage(drafts: ClassDraft[], pixels: Pixels) {
  const grid = findGrid(pixels);
  if (!grid) return { drafts, fixed: 0, measured: false };
  const blocks = findBlocks(pixels, grid);
  const result = applyMeasuredTimes(drafts, blocks, grid);
  return { ...result, measured: result.fixed > 0 || blocks.length > 0 };
}
