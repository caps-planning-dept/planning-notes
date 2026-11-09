import { describe, expect, it } from "vitest";
import {
  addTeamMembers,
  assignedDatesByStudent,
  type CaptureApplication,
  type CaptureFilter,
  type CaptureTeam,
  EMPTY_FILTER,
  filterApplicants,
  formatRoundDate,
  groupApplicants,
  numberTeams,
  removeTeamMember,
  summarizeApplications,
  teamBoard,
  noticeSegments,
  prizeValue,
  validateApplication,
} from "./capture";

function application(id: string, extra: Partial<CaptureApplication> = {}): CaptureApplication {
  return {
    id,
    name: id,
    studentId: id,
    cohort: "1기",
    major: "예시학과",
    preferredTeammate: "",
    dates: [],
    participation: "1회",
    drinking: "상관없음",
    activities: [],
    otherActivity: "",
    firstChoice: "",
    secondChoice: "",
    prize: "",
    createdAt: "2026-09-01T00:00:00Z",
    ...extra,
  };
}

const ids = (items: CaptureApplication[]) => items.map((item) => item.id);
const filtered = (items: CaptureApplication[], filter: CaptureFilter) =>
  filterApplicants(groupApplicants(items), filter).map((person) => person.applications[0].id);

describe("신청자 필터", () => {
  const a = application("a", { dates: ["2026-09-27"], activities: ["보드게임"] });
  const b = application("b", { dates: ["2026-09-28"], activities: ["보드게임", "축제 (9/29, 9/30, 10/1)"] });
  const c = application("c", { dates: ["2026-09-27", "2026-09-28"], activities: [], otherActivity: "자유 입력" });

  it("아무것도 고르지 않으면 모두 보여 준다", () => {
    expect(filtered([a, b, c], EMPTY_FILTER)).toEqual(["a", "b", "c"]);
  });

  it("같은 항목 안에서는 하나라도 해당하면 표시한다", () => {
    const filter = { ...EMPTY_FILTER, dates: ["2026-09-27", "2026-09-28"] };
    expect(filtered([a, b, c], filter)).toEqual(["a", "b", "c"]);
  });

  it("날짜와 활동은 둘 다 해당해야 표시한다", () => {
    const filter = { ...EMPTY_FILTER, dates: ["2026-09-27"], activities: ["보드게임"] };
    expect(filtered([a, b, c], filter)).toEqual(["a"]);
  });

  it("이름 안에 쉼표가 있는 활동도 하나의 활동으로 찾는다", () => {
    const filter = { ...EMPTY_FILTER, activities: ["축제 (9/29, 9/30, 10/1)"] };
    expect(filtered([a, b, c], filter)).toEqual(["b"]);
  });

  it("자유 입력한 활동은 기타로 찾는다", () => {
    expect(filtered([a, b, c], { ...EMPTY_FILTER, activities: ["기타"] })).toEqual(["c"]);
  });

  it("중복 신청은 날짜와 활동을 합쳐서 찾는다", () => {
    const first = application("first", { studentId: "1", dates: ["2026-09-27"], activities: ["보드게임"], createdAt: "2026-09-01T00:00:00Z" });
    const second = application("second", { studentId: "1", dates: ["2026-09-28"], activities: ["방탈출"], createdAt: "2026-09-02T00:00:00Z" });
    const filter = { ...EMPTY_FILTER, dates: ["2026-09-27"], activities: ["방탈출"] };
    expect(filtered([first, second], filter)).toEqual(["second"]);
  });

  it("횟수와 음주 여부는 최신 신청을 기준으로 한다", () => {
    const first = application("first", { studentId: "1", drinking: "음주", createdAt: "2026-09-01T00:00:00Z" });
    const second = application("second", { studentId: "1", drinking: "비음주", createdAt: "2026-09-02T00:00:00Z" });
    expect(filtered([first, second], { ...EMPTY_FILTER, drinking: ["음주"] })).toEqual([]);
    expect(filtered([first, second], { ...EMPTY_FILTER, drinking: ["비음주"] })).toEqual(["second"]);
  });
});

describe("중복 신청 묶기", () => {
  it("같은 학번의 신청을 한 사람으로 묶고 최신 신청의 이름을 쓴다", () => {
    const [person, ...rest] = groupApplicants([
      application("old", { studentId: "1", name: "옛 이름", createdAt: "2026-09-01T00:00:00Z" }),
      application("new", { studentId: "1", name: "새 이름", createdAt: "2026-09-02T00:00:00Z" }),
    ]);
    expect(rest).toEqual([]);
    expect(person.name).toBe("새 이름");
    expect(ids(person.applications)).toEqual(["new", "old"]);
  });
});

function team(id: string, eventDate: string, createdAt: string, extra: Partial<CaptureTeam> = {}): CaptureTeam {
  return { id, eventDate, activity: "보드게임", applicationIds: [], leaderId: null, note: "", createdAt, ...extra };
}

describe("조 번호", () => {
  it("앞 날짜부터, 같은 날짜는 만든 순서대로 겹치지 않게 매긴다", () => {
    const numbered = numberTeams([
      team("늦은 날", "2026-11-17", "2026-11-01T00:00:00Z"),
      team("같은 날 나중", "2026-11-16", "2026-11-03T00:00:00Z"),
      team("같은 날 먼저", "2026-11-16", "2026-11-02T00:00:00Z"),
    ]);
    expect(numbered.map((item) => [item.id, item.number])).toEqual([
      ["같은 날 먼저", 1],
      ["같은 날 나중", 2],
      ["늦은 날", 3],
    ]);
  });
});

describe("조장", () => {
  it("조장을 빼면 다음 사람이 조장이 되고, 다른 사람을 빼면 그대로다", () => {
    const current = team("t", "2026-11-16", "2026-11-01T00:00:00Z", { applicationIds: ["a", "b", "c"], leaderId: "a" });
    expect(removeTeamMember(current, "a")).toEqual({ applicationIds: ["b", "c"], leaderId: "b" });
    expect(removeTeamMember(current, "c")).toEqual({ applicationIds: ["a", "b"], leaderId: "a" });
  });

  it("마지막 사람을 빼면 조장도 비운다", () => {
    const current = team("t", "2026-11-16", "2026-11-01T00:00:00Z", { applicationIds: ["a"], leaderId: "a" });
    expect(removeTeamMember(current, "a")).toEqual({ applicationIds: [], leaderId: null });
  });
});

describe("공지용 표", () => {
  it("날짜별로 묶고 조장을 맨 위로 분리하며 이름만 넣는다", () => {
    const applications = [application("a", { name: "가" }), application("b", { name: "나" }), application("c", { name: "다" })];
    const board = teamBoard(
      [
        team("t1", "2026-11-16", "2026-11-01T00:00:00Z", { applicationIds: ["a", "b", "삭제됨"], leaderId: "b", note: "음주 X" }),
        team("t2", "2026-11-16", "2026-11-02T00:00:00Z", { applicationIds: ["c"], leaderId: null }),
        team("t3", "2026-11-17", "2026-11-03T00:00:00Z", { applicationIds: [] }),
      ],
      applications,
    );
    expect(board.map((day) => day.label)).toEqual(["11/16 (월)", "11/17 (화)"]);
    expect(board[0].teams[0]).toMatchObject({ number: 1, leader: "나", members: ["가"], note: "음주 X" });
    expect(board[0].teams[1]).toMatchObject({ number: 2, leader: null, members: ["다"] });
    expect(board[1].teams[0]).toMatchObject({ number: 3, leader: null, members: [] });
  });
});

describe("신청 현황 요약", () => {
  const round = {
    tabId: "t",
    publicToken: "x",
    isOpen: true,
    closesAt: null,
    dates: ["2026-11-16", "2026-11-17"],
    activities: ["보드게임"],
    notice: "",
    prizes: ["커피"],
    prizeNote: "",
  };

  it("중복 신청자는 한 명으로 세고 여러 날 신청자를 구분한다", () => {
    const summary = summarizeApplications(
      [
        application("a1", { studentId: "1", dates: ["2026-11-16"], activities: ["보드게임"] }),
        application("a2", { studentId: "1", dates: ["2026-11-17"], activities: ["보드게임"] }),
        application("b", { studentId: "2", dates: ["2026-11-16"], otherActivity: "자유 입력" }),
      ],
      round,
    );
    expect(summary).toMatchObject({ people: 2, applications: 3, repeatPeople: 1, multiDayPeople: 1 });
    expect(summary.byDate.map((row) => row.count)).toEqual([2, 1]);
    expect(summary.byActivity).toEqual([
      { label: "보드게임", count: 1 },
      { label: "기타", count: 1 },
    ]);
  });

  it("기타를 적은 사람이 없으면 활동표에서 기타 줄을 뺀다", () => {
    const summary = summarizeApplications([application("a", { activities: ["보드게임"] })], round);
    expect(summary.byActivity.map((row) => row.label)).toEqual(["보드게임"]);
  });

  it("1순위와 상품은 최신 신청 기준으로 한 사람을 한 번 센다", () => {
    const summary = summarizeApplications(
      [
        application("a1", { studentId: "1", firstChoice: "보드게임", prize: "커피", createdAt: "2026-11-01T00:00:00Z" }),
        application("a2", { studentId: "1", firstChoice: "보드게임", prize: "기타: 책", createdAt: "2026-11-02T00:00:00Z" }),
        application("b", { studentId: "2", firstChoice: "보드게임" }),
      ],
      round,
    );
    expect(summary.byFirstChoice).toEqual([{ label: "보드게임", count: 2 }]);
    expect(summary.byPrize).toEqual([
      { label: "커피", count: 0 },
      { label: "기타", count: 1 },
      { label: "고르지 않음", count: 1 },
    ]);
  });
});

describe("1순위만 보기", () => {
  const a = application("a", { activities: ["보드게임", "맛집"], firstChoice: "보드게임", secondChoice: "맛집" });
  const b = application("b", { activities: ["맛집", "보드게임"], firstChoice: "맛집", secondChoice: "보드게임" });

  it("끄면 1·2순위 어느 쪽이든 찾고, 켜면 1순위만 찾는다", () => {
    const filter = { ...EMPTY_FILTER, activities: ["보드게임"] };
    expect(filtered([a, b], filter)).toEqual(["a", "b"]);
    expect(filtered([a, b], { ...filter, firstOnly: true })).toEqual(["a"]);
  });
});

describe("조 배정 현황", () => {
  it("같은 사람의 다른 신청으로 배정해도 학번 기준으로 합쳐 센다", () => {
    const applications = [
      application("a1", { studentId: "1" }),
      application("a2", { studentId: "1" }),
    ];
    const assigned = assignedDatesByStudent(
      [
        team("t1", "2026-11-16", "2026-11-01T00:00:00Z", { applicationIds: ["a1"] }),
        team("t2", "2026-11-17", "2026-11-02T00:00:00Z", { applicationIds: ["a2", "삭제됨"] }),
      ],
      applications,
    );
    expect(assigned.get("1")).toEqual(["2026-11-16", "2026-11-17"]);
    expect(assigned.size).toBe(1);
  });
});

describe("날짜 표시", () => {
  it("요일을 포함해 표시한다", () => {
    expect(formatRoundDate("2026-10-01")).toBe("10/1 (목)");
  });
});

describe("신청 폼 검사", () => {
  const valid = {
    name: "예시",
    studentId: "1234567890",
    cohort: "1기",
    major: "예시학과",
    dates: ["2026-09-27"],
    firstChoice: "보드게임",
    secondChoice: "맛집",
    activityCount: 2,
    prize: "",
    prizeOther: "",
  };

  it("올바른 입력은 오류가 없다", () => {
    expect(validateApplication(valid)).toEqual({});
  });

  it("학번이 숫자가 아니거나 날짜를 고르지 않으면 해당 항목에 오류를 표시한다", () => {
    const errors = validateApplication({ ...valid, studentId: "abc", dates: [] });
    expect(Object.keys(errors).sort()).toEqual(["dates", "studentId"]);
  });

  it("테마가 2개 이상이면 서로 다른 1·2순위를 받는다", () => {
    expect(validateApplication({ ...valid, secondChoice: "" })).toHaveProperty("secondChoice");
    expect(validateApplication({ ...valid, secondChoice: "보드게임" })).toHaveProperty("secondChoice");
    expect(validateApplication({ ...valid, firstChoice: "" })).toHaveProperty("firstChoice");
  });

  it("테마가 1개면 1순위만, 없으면 순위를 받지 않는다", () => {
    expect(validateApplication({ ...valid, secondChoice: "", activityCount: 1 })).toEqual({});
    expect(validateApplication({ ...valid, firstChoice: "", secondChoice: "", activityCount: 0 })).toEqual({});
  });

  it("상품은 고르지 않아도 되지만, 기타를 골랐다면 내용을 적어야 한다", () => {
    expect(validateApplication({ ...valid, prize: "기타" })).toHaveProperty("prize");
    expect(validateApplication({ ...valid, prize: "기타", prizeOther: "책" })).toEqual({});
    expect(prizeValue("기타", " 책 ")).toBe("기타: 책");
    expect(prizeValue("커피", "무시")).toBe("커피");
  });
});

describe("공지 굵게 표시", () => {
  it("**로 감싼 부분만 굵게 나눈다", () => {
    expect(noticeSegments("일시: **11/16** 부터")).toEqual([
      { text: "일시: ", bold: false },
      { text: "11/16", bold: true },
      { text: " 부터", bold: false },
    ]);
  });
});

describe("조에 사람 더하기", () => {
  const application = (id: string, studentId: string) =>
    ({ id, studentId, name: id, cohort: "", major: "", preferredTeammate: "", dates: [], participation: "", drinking: "", activities: [], otherActivity: "", firstChoice: "", secondChoice: "", prize: "", createdAt: "" }) as CaptureApplication;
  const team = (applicationIds: string[], leaderId: string | null) =>
    ({ id: "t", eventDate: "2026-12-01", activity: "", applicationIds, leaderId, note: "", createdAt: "" }) as CaptureTeam;

  it("다시 신청한 사람의 새 신청을 같은 조에 또 넣지 않는다", () => {
    const applications = [application("old", "1"), application("new", "1"), application("other", "2")];
    expect(addTeamMembers(team(["old"], "old"), ["new", "other"], applications).applicationIds).toEqual(["old", "other"]);
  });

  it("조장이 없으면 첫 사람이 조장이 되고, 있으면 유지한다", () => {
    const applications = [application("a", "1"), application("b", "2")];
    expect(addTeamMembers(team([], null), ["a", "b"], applications).leaderId).toBe("a");
    expect(addTeamMembers(team(["a"], "a"), ["b"], applications).leaderId).toBe("a");
  });
});
