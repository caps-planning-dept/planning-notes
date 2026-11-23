import { describe, expect, it } from "vitest";
import {
  answersToSubmit,
  changeType,
  cleanQuestions,
  countChoices,
  type FormQuestion,
  formStatus,
  noticeSummary,
  moveQuestion,
  readFormAnswers,
  readFormQuestions,
  responsesToCsv,
  validateAnswers,
} from "./forms";

const q = (id: string, extra: Partial<FormQuestion> = {}): FormQuestion => ({
  id,
  type: "short",
  label: id,
  help: "",
  required: true,
  options: [],
  ...extra,
});

const party = q("party", { type: "single", label: "뒤풀이 참여 여부", options: ["총회만", "뒤풀이만", "둘 다"] });

describe("readFormQuestions", () => {
  it("모양이 맞는 질문만 남긴다", () => {
    const value = [
      { id: "name", type: "short", label: "이름", required: true },
      { id: "x", type: "date" },
      "이름",
      { id: "pick", type: "multiple", options: ["가", 3, "나"] },
    ];
    expect(readFormQuestions(value)).toEqual([
      q("name", { label: "이름" }),
      q("pick", { type: "multiple", label: "", required: false, options: ["가", "나"] }),
    ]);
    expect(readFormQuestions(null)).toEqual([]);
  });

  it("답은 글과 글 목록만 남긴다", () => {
    expect(readFormAnswers({ a: "가", b: ["나", 1], c: 3 })).toEqual({ a: "가", b: ["나"] });
  });
});

describe("질문 편집", () => {
  it("고르기 질문으로 바꾸면 항목이 하나는 생긴다", () => {
    expect(changeType(q("a"), "single").options).toEqual(["항목 1"]);
    expect(changeType(party, "multiple").options).toEqual(party.options);
  });

  it("질문을 위아래로 옮기고 끝에서는 그대로 둔다", () => {
    const list = [q("a"), q("b"), q("c")];
    expect(moveQuestion(list, "b", -1).map((item) => item.id)).toEqual(["b", "a", "c"]);
    expect(moveQuestion(list, "c", 1)).toBe(list);
  });

  it("저장 전에 빈 항목과 겹치는 항목을 뺀다", () => {
    const [cleaned] = cleanQuestions([q("a", { type: "single", options: [" 가 ", "", "가", "나"] })]);
    expect(cleaned.options).toEqual(["가", "나"]);
    expect(cleanQuestions([q("b", { options: ["남은 항목"] })])[0].options).toEqual([]);
  });
});

describe("validateAnswers", () => {
  const questions = [q("name", { label: "이름" }), party, q("memo", { type: "long", required: false })];

  it("필수 질문이 비면 알려 준다", () => {
    expect(validateAnswers(questions, { name: "  " })).toEqual({
      name: "필수 질문입니다.",
      party: "하나를 골라 주세요.",
    });
  });

  it("모두 답하면 문제가 없다", () => {
    expect(validateAnswers(questions, { name: "김캡스", party: "둘 다" })).toEqual({});
  });

  it("여러 개 고르기는 하나 이상 골라야 한다", () => {
    const pick = q("pick", { type: "multiple", options: ["가", "나"] });
    expect(validateAnswers([pick], { pick: [] })).toEqual({ pick: "하나 이상 골라 주세요." });
  });

  it("너무 긴 답을 막는다", () => {
    expect(validateAnswers([q("name")], { name: "가".repeat(301) }).name).toContain("300자");
  });
});

describe("answersToSubmit", () => {
  it("질문에 있는 답만 다듬어 보내고 고른 항목은 질문 순서로 둔다", () => {
    const pick = q("pick", { type: "multiple", options: ["가", "나", "다"] });
    expect(answersToSubmit([q("name"), pick], { name: " 김캡스 ", pick: ["다", "가"], old: "x" })).toEqual({
      name: "김캡스",
      pick: ["가", "다"],
    });
  });
});

describe("응답 정리", () => {
  const responses = [
    { id: "1", answers: { name: "가", party: "총회만" }, createdAt: "2026-11-23T01:00:00Z" },
    { id: "2", answers: { name: "나", party: "둘 다" }, createdAt: "2026-11-23T02:00:00Z" },
    { id: "3", answers: { name: "다", party: "옛 항목" }, createdAt: "2026-11-23T03:00:00Z" },
  ];

  it("고르기 질문의 항목별 인원을 센다", () => {
    expect(countChoices([q("name"), party], responses)).toEqual([
      {
        question: party,
        rows: [
          { label: "총회만", count: 1 },
          { label: "뒤풀이만", count: 0 },
          { label: "둘 다", count: 1 },
          { label: "옛 항목", count: 1 },
        ],
      },
    ]);
  });

  it("CSV는 순번을 붙이고 따옴표와 수식 시작 문자를 감싼다", () => {
    const csv = responsesToCsv(
      [q("name", { label: "이름" })],
      [{ id: "1", answers: { name: '=1+1, "따옴표"' }, createdAt: "t" }],
      () => "11/23 10:00",
    );
    expect(csv).toBe('﻿순번,신청 시간,이름\r\n1,11/23 10:00,"\'=1+1, ""따옴표"""');
  });
});

describe("formStatus", () => {
  const now = Date.parse("2026-12-01T00:00:00Z");
  it("닫힘, 마감, 정원을 차례로 확인한다", () => {
    expect(formStatus({ isOpen: false, closesAt: null, capacity: null }, 0, now).reason).toBe("닫힘");
    expect(formStatus({ isOpen: true, closesAt: "2026-11-30T00:00:00Z", capacity: null }, 0, now).reason).toBe("마감 시간 지남");
    expect(formStatus({ isOpen: true, closesAt: null, capacity: 40 }, 40, now).reason).toBe("정원 참");
    expect(formStatus({ isOpen: true, closesAt: null, capacity: 40 }, 39, now).open).toBe(true);
  });
});

describe("noticeSummary", () => {
  it("줄을 이어 붙이고 굵게 표시를 뺀다", () => {
    expect(noticeSummary("📢 **공지**📢\n\n일시: 12월 16일\n  장소: 미정  ")).toBe("📢 공지📢 일시: 12월 16일 장소: 미정");
  });

  it("길면 줄임표로 자른다", () => {
    expect(noticeSummary("가".repeat(10), 5)).toBe("가가가가…");
  });
});
