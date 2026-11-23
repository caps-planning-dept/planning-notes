/** 신청폼 탭: 질문을 직접 만드는 로그인 없는 신청 폼. DB 검사는 public.submit_form_response와 같다. */

export type QuestionType = "short" | "long" | "single" | "multiple";

export type FormQuestion = {
  id: string;
  type: QuestionType;
  label: string;
  help: string;
  required: boolean;
  /** 하나 고르기, 여러 개 고르기의 항목 */
  options: string[];
};

/** 질문 id → 글(짧은 답, 긴 답, 하나 고르기) 또는 고른 항목들(여러 개 고르기) */
export type FormAnswers = Record<string, string | string[]>;

export type FormSettings = {
  tabId: string;
  publicToken: string;
  isOpen: boolean;
  closesAt: string | null;
  /** 선착순 정원. 없으면 제한 없음 */
  capacity: number | null;
  notice: string;
  questions: FormQuestion[];
};

export type FormResponse = { id: string; answers: FormAnswers; createdAt: string };

export const QUESTION_TYPES: { value: QuestionType; label: string }[] = [
  { value: "short", label: "짧은 답" },
  { value: "long", label: "긴 답" },
  { value: "single", label: "하나 고르기" },
  { value: "multiple", label: "여러 개 고르기" },
];

export const MAX_ANSWER_LENGTH: Record<"short" | "long", number> = { short: 300, long: 3000 };
export const MAX_QUESTIONS = 50;
export const MAX_OPTIONS = 50;
export const MAX_LABEL = 200;
export const MAX_HELP = 1000;
export const MAX_OPTION = 200;
export const MAX_CAPACITY = 2000;

export const isChoice = (type: QuestionType) => type === "single" || type === "multiple";

const TYPES = new Set<string>(QUESTION_TYPES.map((item) => item.value));

/** DB에서 읽은 질문 목록을 확인한다. 모양이 다른 항목은 버린다. */
export function readFormQuestions(value: unknown): FormQuestion[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): FormQuestion[] => {
    if (!item || typeof item !== "object") return [];
    const raw = item as Record<string, unknown>;
    if (typeof raw.id !== "string" || !raw.id || typeof raw.type !== "string" || !TYPES.has(raw.type)) return [];
    return [
      {
        id: raw.id,
        type: raw.type as QuestionType,
        label: typeof raw.label === "string" ? raw.label : "",
        help: typeof raw.help === "string" ? raw.help : "",
        required: raw.required === true,
        options: Array.isArray(raw.options) ? raw.options.filter((option): option is string => typeof option === "string") : [],
      },
    ];
  });
}

export function readFormAnswers(value: unknown): FormAnswers {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const answers: FormAnswers = {};
  for (const [key, answer] of Object.entries(value as Record<string, unknown>)) {
    if (typeof answer === "string") answers[key] = answer;
    else if (Array.isArray(answer)) answers[key] = answer.filter((item): item is string => typeof item === "string");
  }
  return answers;
}

export function newQuestion(type: QuestionType = "short"): FormQuestion {
  return {
    id: crypto.randomUUID().slice(0, 8),
    type,
    label: "",
    help: "",
    required: true,
    options: isChoice(type) ? ["항목 1"] : [],
  };
}

/** 질문 종류를 바꾼다. 고르기 질문이 되면 항목이 하나는 있게 한다. */
export function changeType(question: FormQuestion, type: QuestionType): FormQuestion {
  const options = isChoice(type) && question.options.length === 0 ? ["항목 1"] : question.options;
  return { ...question, type, options };
}

/** 질문을 위(-1)나 아래(+1)로 옮긴다. 끝에서는 그대로 둔다. */
export function moveQuestion(questions: FormQuestion[], id: string, step: -1 | 1): FormQuestion[] {
  const from = questions.findIndex((item) => item.id === id);
  const to = from + step;
  if (from < 0 || to < 0 || to >= questions.length) return questions;
  const next = [...questions];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

/** 저장 전에 질문을 다듬는다. 항목의 앞뒤 빈칸과 빈 항목, 겹치는 항목을 뺀다. */
export function cleanQuestions(questions: FormQuestion[]): FormQuestion[] {
  return questions.map((question) => ({
    ...question,
    options: isChoice(question.type)
      ? [...new Set(question.options.map((option) => option.trim()).filter(Boolean))]
      : [],
  }));
}

export const questionTitle = (question: FormQuestion, index: number) => question.label.trim() || `질문 ${index + 1}`;

/** 신청자가 낸 답을 확인한다. 문제가 있는 질문 id → 안내 문구 */
export function validateAnswers(questions: FormQuestion[], answers: FormAnswers): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const question of questions) {
    const answer = answers[question.id];
    if (question.type === "short" || question.type === "long") {
      const text = typeof answer === "string" ? answer.trim() : "";
      if (text.length > MAX_ANSWER_LENGTH[question.type]) {
        errors[question.id] = `${MAX_ANSWER_LENGTH[question.type]}자까지 쓸 수 있습니다.`;
      } else if (question.required && !text) {
        errors[question.id] = "필수 질문입니다.";
      }
    } else if (question.type === "single") {
      if (question.required && (typeof answer !== "string" || !answer)) errors[question.id] = "하나를 골라 주세요.";
    } else {
      if (question.required && (!Array.isArray(answer) || answer.length === 0)) {
        errors[question.id] = "하나 이상 골라 주세요.";
      }
    }
  }
  return errors;
}

/** 질문 순서와 항목 순서에 맞춰 보낼 답만 남긴다. */
export function answersToSubmit(questions: FormQuestion[], answers: FormAnswers): FormAnswers {
  const result: FormAnswers = {};
  for (const question of questions) {
    const answer = answers[question.id];
    if (question.type === "multiple") {
      const picked = question.options.filter((option) => Array.isArray(answer) && answer.includes(option));
      if (picked.length > 0) result[question.id] = picked;
    } else if (typeof answer === "string" && answer.trim()) {
      result[question.id] = question.type === "single" ? answer : answer.trim();
    }
  }
  return result;
}

export function formatAnswer(answer: string | string[] | undefined): string {
  if (answer === undefined) return "";
  return Array.isArray(answer) ? answer.join(", ") : answer;
}

/** 고르기 질문마다 항목별 인원을 센다. 지금 목록에 없는 옛 항목도 따로 센다. */
export function countChoices(
  questions: FormQuestion[],
  responses: FormResponse[],
): { question: FormQuestion; rows: { label: string; count: number }[] }[] {
  return questions.filter((question) => isChoice(question.type)).map((question) => {
    const counts = new Map(question.options.map((option) => [option, 0]));
    for (const response of responses) {
      const answer = response.answers[question.id];
      const picked = Array.isArray(answer) ? answer : answer ? [answer] : [];
      for (const option of picked) counts.set(option, (counts.get(option) ?? 0) + 1);
    }
    return { question, rows: [...counts].map(([label, count]) => ({ label, count })) };
  });
}

function csvCell(value: string): string {
  // 엑셀이 =, +, -, @로 시작하는 칸을 수식으로 읽지 않게 앞에 '를 붙인다.
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

/** 응답을 먼저 낸 순서로 CSV로 만든다. 엑셀에서 한글이 깨지지 않게 BOM을 붙인다. */
export function responsesToCsv(questions: FormQuestion[], responses: FormResponse[], formatTime: (iso: string) => string): string {
  const header = ["순번", "신청 시간", ...questions.map(questionTitle)];
  const rows = responses.map((response, index) => [
    String(index + 1),
    formatTime(response.createdAt),
    ...questions.map((question) => formatAnswer(response.answers[question.id])),
  ]);
  return "﻿" + [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
}

/** 공개 폼이 지금 신청을 받는지와 받지 않는 까닭 */
export function formStatus(settings: Pick<FormSettings, "isOpen" | "closesAt" | "capacity">, count: number, now: number) {
  if (!settings.isOpen) return { open: false, reason: "닫힘" } as const;
  if (settings.closesAt && Date.parse(settings.closesAt) <= now) return { open: false, reason: "마감 시간 지남" } as const;
  if (settings.capacity !== null && count >= settings.capacity) return { open: false, reason: "정원 참" } as const;
  return { open: true, reason: "" } as const;
}
