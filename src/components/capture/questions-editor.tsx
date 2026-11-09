"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Capture } from "@/hooks/use-capture";
import {
  type CaptureQuestions,
  MAX_QUESTION_HELP,
  MAX_QUESTION_LABEL,
  QUESTIONS,
  type QuestionKey,
  type QuestionText,
} from "@/lib/capture";

type Field = keyof QuestionText;

/** 입력 중인 칸 하나. 칸을 벗어나면 저장하고 비운다. */
export type QuestionDraft = { key: QuestionKey; field: Field; value: string };

/** 저장된 질문에 입력 중인 칸을 겹쳐 미리보기에 쓴다. */
export function withDraft(questions: CaptureQuestions, draft: QuestionDraft | null): CaptureQuestions {
  if (!draft) return questions;
  return { ...questions, [draft.key]: { ...questions[draft.key], [draft.field]: draft.value } };
}

type QuestionsEditorProps = {
  capture: Capture;
  questions: CaptureQuestions;
  draft: QuestionDraft | null;
  onDraftChange: (draft: QuestionDraft | null) => void;
};

/** 신청 폼의 질문 문장과 보충 설명을 고친다. 칸을 벗어날 때 저장한다. */
export function QuestionsEditor({ capture, questions, draft, onDraftChange: setDraft }: QuestionsEditorProps) {
  const valueOf = (key: QuestionKey, field: Field) =>
    draft?.key === key && draft.field === field ? draft.value : (questions[key]?.[field] ?? "");

  function save() {
    if (!draft) return;
    const { key, field, value } = draft;
    setDraft(null);
    if (value === (questions[key]?.[field] ?? "")) return;
    capture.updateRound({ questions: withDraft(questions, draft) });
  }

  return (
    <section className="flex flex-col gap-3 rounded-md border p-4">
      <h2 className="font-medium">질문 문장</h2>
      <p className="text-sm text-muted-foreground">
        질문을 비워 두면 흐린 글씨의 기본 문장이 나옵니다. 설명은 질문 바로 아래에 작게 보이며, 공지처럼 줄바꿈과
        **굵게**를 쓸 수 있습니다. 칸 밖을 누르면 저장됩니다.
      </p>
      <ol className="flex flex-col divide-y">
        {QUESTIONS.map((question, index) => (
          <li key={question.key} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
            <span className="text-xs text-muted-foreground">질문 {index + 1}</span>
            <Input
              aria-label={`질문 ${index + 1} 문장`}
              maxLength={MAX_QUESTION_LABEL}
              placeholder={question.label}
              value={valueOf(question.key, "label")}
              onChange={(e) => setDraft({ key: question.key, field: "label", value: e.target.value })}
              onBlur={save}
            />
            <Textarea
              aria-label={`질문 ${index + 1} 설명`}
              rows={1}
              className="min-h-9 text-sm"
              maxLength={MAX_QUESTION_HELP}
              placeholder="설명 (선택)"
              value={valueOf(question.key, "help")}
              onChange={(e) => setDraft({ key: question.key, field: "help", value: e.target.value })}
              onBlur={save}
            />
          </li>
        ))}
      </ol>
    </section>
  );
}
