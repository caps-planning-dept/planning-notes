"use client";

import { ArrowDown, ArrowUp, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  changeType,
  type FormQuestion,
  isChoice,
  MAX_HELP,
  MAX_LABEL,
  MAX_OPTION,
  MAX_OPTIONS,
  MAX_QUESTIONS,
  moveQuestion,
  newQuestion,
  QUESTION_TYPES,
  type QuestionType,
} from "@/lib/forms";

type QuestionsBuilderProps = {
  /** 화면에 보이는 질문(입력 중인 내용 포함) */
  questions: FormQuestion[];
  /** 글자를 입력하는 중: 화면만 바꾸고 칸을 벗어날 때 저장한다. */
  onDraft: (questions: FormQuestion[]) => void;
  /** 바로 저장한다. */
  onSave: (questions: FormQuestion[]) => void;
};

/** 겹치지 않는 새 항목 이름. 겹치는 항목은 저장할 때 빠지므로 피한다. */
function nextOptionName(options: string[]): string {
  let number = options.length + 1;
  while (options.includes(`항목 ${number}`)) number += 1;
  return `항목 ${number}`;
}

/** 신청폼의 질문을 더하고, 고치고, 순서를 바꾼다. */
export function QuestionsBuilder({ questions, onDraft, onSave }: QuestionsBuilderProps) {
  const edit = (id: string, change: (question: FormQuestion) => FormQuestion) =>
    questions.map((question) => (question.id === id ? change(question) : question));
  const saveDraft = () => onSave(questions);

  return (
    <section className="flex flex-col gap-3 rounded-md border p-4">
      <h2 className="font-medium">질문</h2>
      <p className="text-sm text-muted-foreground">
        글자는 칸 밖을 누르면 저장되고, 종류·필수·순서는 바로 저장됩니다. 설명에는 공지처럼 줄바꿈과 **굵게**를 쓸 수
        있습니다.
      </p>
      <ol className="flex flex-col gap-3">
        {questions.map((question, index) => (
          <li key={question.id} className="flex flex-col gap-2 rounded-md bg-secondary/60 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">질문 {index + 1}</span>
              <select
                aria-label={`질문 ${index + 1} 종류`}
                className="h-8 rounded-md border bg-background px-2 text-sm"
                value={question.type}
                onChange={(e) => onSave(edit(question.id, (item) => changeType(item, e.target.value as QuestionType)))}
              >
                {QUESTION_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
              <label className="flex min-h-8 items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={question.required}
                  onChange={(e) => onSave(edit(question.id, (item) => ({ ...item, required: e.target.checked })))}
                />
                필수
              </label>
              <span className="flex-1" />
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`질문 ${index + 1} 위로`}
                disabled={index === 0}
                onClick={() => onSave(moveQuestion(questions, question.id, -1))}
              >
                <ArrowUp />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`질문 ${index + 1} 아래로`}
                disabled={index === questions.length - 1}
                onClick={() => onSave(moveQuestion(questions, question.id, 1))}
              >
                <ArrowDown />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`질문 ${index + 1} 삭제`}
                onClick={() => onSave(questions.filter((item) => item.id !== question.id))}
              >
                <Trash2 />
              </Button>
            </div>
            <Input
              aria-label={`질문 ${index + 1} 문장`}
              maxLength={MAX_LABEL}
              placeholder="질문 (예: 이름)"
              className="bg-background"
              value={question.label}
              onChange={(e) => onDraft(edit(question.id, (item) => ({ ...item, label: e.target.value })))}
              onBlur={saveDraft}
            />
            <Textarea
              aria-label={`질문 ${index + 1} 설명`}
              rows={1}
              className="min-h-9 bg-background text-sm"
              maxLength={MAX_HELP}
              placeholder="설명 (선택)"
              value={question.help}
              onChange={(e) => onDraft(edit(question.id, (item) => ({ ...item, help: e.target.value })))}
              onBlur={saveDraft}
            />
            {isChoice(question.type) && (
              <ul className="flex flex-col gap-1.5 pl-2" aria-label={`질문 ${index + 1} 항목`}>
                {question.options.map((option, optionIndex) => (
                  <li key={optionIndex} className="flex items-center gap-2">
                    <input
                      type={question.type === "multiple" ? "checkbox" : "radio"}
                      disabled
                      aria-hidden
                      className="size-4 shrink-0"
                    />
                    <Input
                      aria-label={`질문 ${index + 1} 항목 ${optionIndex + 1}`}
                      maxLength={MAX_OPTION}
                      className="h-8 bg-background"
                      value={option}
                      onChange={(e) =>
                        onDraft(
                          edit(question.id, (item) => ({
                            ...item,
                            options: item.options.map((value, at) => (at === optionIndex ? e.target.value : value)),
                          })),
                        )
                      }
                      onBlur={saveDraft}
                    />
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`항목 ${optionIndex + 1} 삭제`}
                      disabled={question.options.length === 1}
                      onClick={() =>
                        onSave(edit(question.id, (item) => ({ ...item, options: item.options.filter((_, at) => at !== optionIndex) })))
                      }
                    >
                      <X />
                    </Button>
                  </li>
                ))}
                <li>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={question.options.length >= MAX_OPTIONS}
                    onClick={() =>
                      onSave(
                        edit(question.id, (item) => ({ ...item, options: [...item.options, nextOptionName(item.options)] })),
                      )
                    }
                  >
                    <Plus data-icon="inline-start" />
                    항목 추가
                  </Button>
                </li>
              </ul>
            )}
          </li>
        ))}
      </ol>
      {questions.length === 0 && <p className="text-sm text-muted-foreground">질문이 없습니다. 아래에서 더해 주세요.</p>}
      <div className="flex flex-wrap gap-2">
        {QUESTION_TYPES.map((type) => (
          <Button
            key={type.value}
            variant="outline"
            disabled={questions.length >= MAX_QUESTIONS}
            onClick={() => onSave([...questions, newQuestion(type.value)])}
          >
            <Plus data-icon="inline-start" />
            {type.label}
          </Button>
        ))}
      </div>
    </section>
  );
}
